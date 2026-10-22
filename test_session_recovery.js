/**
 * Automated Verification for Phone-Number Session Recovery in KICS 2026
 * 
 * Verifies:
 * 1. State Restoration:
 *    - Matching phone number fetches cloud record and restores score, time, completed stages.
 *    - Stages 1..N are marked completed and locked/solved.
 *    - User is routed directly to active hunt screen (Stage N+1), NOT Stage 1 blank.
 *    - Toast notification: "Welcome back, Dr. [Name]! Restored progress: [N]/5 stages completed."
 *    - LocalStorage is re-hydrated.
 * 2. Failsafe:
 *    - If cloud lookup times out (over 2 seconds) or fails, registration completes normally.
 *    - User is never blocked.
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';

async function runSessionRecoveryTests() {
  console.log("============================================================");
  console.log("TEST SUITE: PHONE-NUMBER SESSION RECOVERY & RE-HYDRATION");
  console.log("============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let test1Pass = false;
  let test2Pass = false;

  try {
    // ------------------------------------------------------------
    // TEST 1: SESSION RESTORATION FOR EXISTING PHONE NUMBER
    // ------------------------------------------------------------
    console.log("------------------------------------------------------------");
    console.log("TEST 1: State Restoration for Existing Phone Number (2 Stages Solved)");
    console.log("------------------------------------------------------------");

    // Intercept GET requests to CONFIG.WEBHOOK_URL to provide a deterministic mock record
    await page.route('https://script.google.com/macros/s/**', async route => {
      if (route.request().method() === 'GET') {
        const mockCloudData = [
          {
            name: "Dr. Sandeep Shenoy",
            hospital: "Manipal Hospital Sarjapur Road",
            mobile: "+91 98450 11223",
            score: 1950,
            stages: 2,
            totalTimeTaken: 25,
            timestamp: "2026-10-22T20:00:00.000Z"
          }
        ];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCloudData)
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success' })
        });
      }
    });

    await page.goto(`${BASE_URL}/#hunt`);
    await page.waitForTimeout(400);

    // Delegate enters registration with phone matching the cloud record (without spaces/country code)
    console.log("  Entering registration form with phone '9845011223'...");
    await page.fill('#reg-name', 'Dr. Sandeep Shenoy');
    await page.fill('#reg-hospital', 'Manipal Hospital');
    await page.fill('#reg-mobile', '9845011223');

    await page.click('#btn-start-hunt');
    await page.waitForTimeout(600);

    // Verify modal is closed
    const modalHidden = !(await page.isVisible('#registration-modal'));
    console.log(`  Registration modal closed: ${modalHidden}`);

    // Check AppState restoration
    const restoredState = await page.evaluate(() => {
      return {
        score: AppState.score,
        currentStage: AppState.currentStage,
        unlockedStages: AppState.unlockedStages,
        stage1Submitted: AppState.stageSubmissions[1]?.submitted,
        stage2Submitted: AppState.stageSubmissions[2]?.submitted,
        stage3Submitted: AppState.stageSubmissions[3]?.submitted,
        userName: AppState.user?.name,
        userMobile: AppState.user?.mobile
      };
    });

    console.log(`  Restored Score: ${restoredState.score} Pts (Expected: 1950)`);
    console.log(`  Current Stage routed to: ${restoredState.currentStage} (Expected: 3, not Stage 1 blank)`);
    console.log(`  Stage 1 completed & locked: ${restoredState.stage1Submitted}`);
    console.log(`  Stage 2 completed & locked: ${restoredState.stage2Submitted}`);
    console.log(`  Stage 3 submitted: ${restoredState.stage3Submitted || false} (Expected: false / active)`);

    // Verify Stage 1 and Stage 2 stepper visual status
    const st1StepClass = await page.locator("#step-nav-1").getAttribute("class");
    const st2StepClass = await page.locator("#step-nav-2").getAttribute("class");
    const st3CardVisible = await page.isVisible("#stage-card-3");
    const st1CardVisible = await page.isVisible("#stage-card-1");

    console.log(`  Stepper Stage 1 has 'completed-correct': ${st1StepClass.includes('completed-correct')}`);
    console.log(`  Stepper Stage 2 has 'completed-correct': ${st2StepClass.includes('completed-correct')}`);
    console.log(`  Stage 3 Card is active in DOM: ${st3CardVisible} (Expected: true)`);
    console.log(`  Stage 1 Card is hidden: ${!st1CardVisible} (Expected: true)`);

    // Verify Toast Notification
    const toastText = await page.evaluate(() => {
      const t = document.getElementById('session-recovery-toast');
      const p = document.getElementById('auto-unlock-pill');
      return (t ? t.textContent : "") || (p ? p.textContent : "");
    });
    console.log(`  Recovery Toast Text: '${toastText}'`);
    const expectedToast = "Welcome back, Dr. Sandeep Shenoy! Restored progress: 2/5 stages completed.";
    const toastPass = toastText.includes("Welcome back, Dr. Sandeep Shenoy") && toastText.includes("Restored progress: 2/5");

    // Verify localStorage re-hydration
    const localSaved = await page.evaluate(() => {
      const raw = localStorage.getItem("kics_app_state");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        score: parsed.score,
        userName: parsed.user?.name,
        stage1Done: parsed.stageSubmissions?.[1]?.submitted
      };
    });
    console.log(`  LocalStorage re-hydrated: score=${localSaved?.score}, user=${localSaved?.userName}`);

    test1Pass = (
      modalHidden &&
      restoredState.score === 1950 &&
      restoredState.currentStage === 3 &&
      restoredState.stage1Submitted &&
      restoredState.stage2Submitted &&
      !st1CardVisible &&
      st3CardVisible &&
      toastPass &&
      localSaved?.score === 1950
    );

    // ------------------------------------------------------------
    // TEST 2: FAILSAFE VERIFICATION (TIMEOUT / NETWORK ERROR)
    // ------------------------------------------------------------
    console.log("\n------------------------------------------------------------");
    console.log("TEST 2: Failsafe on Timeout / Network Error (User Never Blocked)");
    console.log("------------------------------------------------------------");

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();

    // Route webhook to simulate a hanging connection (>3500ms delay, exceeds 2s timeout)
    await page2.route('https://script.google.com/macros/s/**', async route => {
      // Intentionally delay longer than the 2000ms failsafe timeout
      await new Promise(r => setTimeout(r, 4000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page2.goto(`${BASE_URL}/#hunt`);
    await page2.waitForTimeout(300);

    console.log("  Submitting registration with slow network connection (>2s)...");
    const tStart = Date.now();
    await page2.fill('#reg-name', 'Dr. Failsafe Tester');
    await page2.fill('#reg-hospital', 'Emergency Hospital');
    await page2.fill('#reg-mobile', '9111122222');

    await page2.click('#btn-start-hunt');

    // Wait up to 2.5s for failsafe to fire and proceed with fresh registration
    await page2.waitForTimeout(2500);
    const elapsedMs = Date.now() - tStart;
    console.log(`  Registration processed in ${elapsedMs}ms (Failsafe timeout is 2000ms)`);

    const modal2Hidden = !(await page2.isVisible('#registration-modal'));
    const freshUser = await page2.evaluate(() => AppState.user);
    const freshScore = await page2.evaluate(() => AppState.score);
    const freshStage = await page2.evaluate(() => AppState.currentStage);

    console.log(`  Registration modal dismissed: ${modal2Hidden}`);
    console.log(`  User registered successfully: '${freshUser?.name}'`);
    console.log(`  Score is initialized fresh: ${freshScore} Pts`);
    console.log(`  Current stage is Quest 1: ${freshStage}`);

    test2Pass = (modal2Hidden && freshUser?.name === 'Dr. Failsafe Tester' && freshScore === 0 && freshStage === 1);

    await ctx2.close();

    // ------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------
    console.log("\n============================================================");
    console.log("SESSION RECOVERY AUDIT SUMMARY");
    console.log("============================================================");
    console.log(`  Test 1: Existing Session Restoration & Routing : ${test1Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  Test 2: Failsafe Timeout & Non-Blocking Fallback: ${test2Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log("============================================================");

    if (test1Pass && test2Pass) {
      console.log("🎉 ALL SESSION RECOVERY TESTS PASSED (100% SUCCESS)!\n");
    } else {
      console.log("❌ Some session recovery tests failed.\n");
      process.exit(1);
    }

  } catch (err) {
    console.error("Test failed with exception:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runSessionRecoveryTests();
