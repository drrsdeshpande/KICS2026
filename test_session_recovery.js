/**
 * Automated Verification for Dual-Match Session Recovery in KICS 2026
 * 
 * Verifies:
 * 1. Dual Match Check (Phone OR Name):
 *    - Phone match: Strips non-digits from entered phone and matches cloud record.
 *    - Name match (when phone is empty): Matches by name when phone is not provided.
 * 2. Full State Re-hydration:
 *    - Restores AppState.score = match.score and AppState.totalTimeTaken = match.totalTimeTaken.
 *    - Sets completed stages up to match.stages (stages 1..N marked completed & locked).
 *    - Sets current active stage to match.stages + 1.
 *    - For match.stages === 3, sets active stage to 4, displaying the Day 2 locked padlock screen.
 *    - Saves restored state into localStorage.
 *    - Displays notification: "Welcome back, Dr. [Name]! Resuming at Stage [match.stages + 1] with [match.score] pts."
 * 3. Failsafe:
 *    - If cloud lookup times out (over 2 seconds) or fails, registration completes normally without blocking.
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';

async function runSessionRecoveryTests() {
  console.log("============================================================");
  console.log("TEST SUITE: DUAL-MATCH SESSION RECOVERY & RE-HYDRATION");
  console.log("============================================================\n");

  const browser = await chromium.launch({ headless: true });

  let test1Pass = false;
  let test2Pass = false;
  let test3Pass = false;

  try {
    // ------------------------------------------------------------
    // TEST 1: SESSION RESTORATION BY PHONE NUMBER (2 STAGES SOLVED)
    // ------------------------------------------------------------
    console.log("------------------------------------------------------------");
    console.log("TEST 1: State Restoration by Phone (match.stages = 2 -> Stage 3)");
    console.log("------------------------------------------------------------");

    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();

    // Mock cloud webhook
    await page1.route('https://script.google.com/macros/s/**', async route => {
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

    await page1.goto(`${BASE_URL}/#hunt`);
    await page1.waitForTimeout(400);

    console.log("  Entering registration form with phone '9845011223'...");
    await page1.fill('#reg-name', 'Dr. Sandeep Shenoy');
    await page1.fill('#reg-hospital', 'Manipal Hospital');
    await page1.fill('#playerPhone', '9845011223');

    await page1.click('#btn-start-hunt');
    await page1.waitForTimeout(600);

    const modal1Hidden = !(await page1.isVisible('#registration-modal'));
    console.log(`  Registration modal closed: ${modal1Hidden}`);

    const restoredState1 = await page1.evaluate(() => {
      return {
        score: AppState.score,
        totalTimeTaken: AppState.totalTimeTaken,
        currentStage: AppState.currentStage,
        unlockedStages: AppState.unlockedStages,
        stage1Submitted: AppState.stageSubmissions[1]?.submitted,
        stage2Submitted: AppState.stageSubmissions[2]?.submitted,
        stage3Submitted: AppState.stageSubmissions[3]?.submitted,
        userName: AppState.user?.name,
        userMobile: AppState.user?.mobile
      };
    });

    console.log(`  Restored Score: ${restoredState1.score} Pts (Expected: 1950)`);
    console.log(`  Restored Total Time Taken: ${restoredState1.totalTimeTaken}s (Expected: 25)`);
    console.log(`  Current Stage routed to: ${restoredState1.currentStage} (Expected: 3)`);
    console.log(`  Stage 1 completed: ${restoredState1.stage1Submitted}`);
    console.log(`  Stage 2 completed: ${restoredState1.stage2Submitted}`);

    const toast1Text = await page1.evaluate(() => {
      const t = document.getElementById('session-recovery-toast');
      const p = document.getElementById('auto-unlock-pill');
      return (t ? t.textContent : "") || (p ? p.textContent : "");
    });
    console.log(`  Recovery Toast Text: '${toast1Text}'`);
    const expectedToast1 = "Welcome back, Dr. Sandeep Shenoy! Resuming at Stage 3 with 1950 pts.";
    const toast1Matches = toast1Text.includes("Welcome back, Dr. Sandeep Shenoy! Resuming at Stage 3 with 1950 pts.");

    const localSaved1 = await page1.evaluate(() => {
      const raw = localStorage.getItem("kics_app_state");
      if (!raw) return null;
      return JSON.parse(raw);
    });
    console.log(`  LocalStorage score: ${localSaved1?.score}, totalTimeTaken: ${localSaved1?.totalTimeTaken}`);

    test1Pass = (
      modal1Hidden &&
      restoredState1.score === 1950 &&
      restoredState1.totalTimeTaken === 25 &&
      restoredState1.currentStage === 3 &&
      restoredState1.stage1Submitted &&
      restoredState1.stage2Submitted &&
      toast1Matches &&
      localSaved1?.score === 1950 &&
      localSaved1?.totalTimeTaken === 25
    );
    console.log(`  Test 1 Result: ${test1Pass ? 'PASSED ✅' : 'FAILED ❌'}`);

    await ctx1.close();

    // ------------------------------------------------------------
    // TEST 2: DUAL MATCH BY NAME WHEN PHONE IS EMPTY (3 STAGES SOLVED)
    // ------------------------------------------------------------
    console.log("\n------------------------------------------------------------");
    console.log("TEST 2: State Restoration by Name (Phone Empty, match.stages = 3 -> Stage 4 Locked)");
    console.log("------------------------------------------------------------");

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();

    await page2.route('https://script.google.com/macros/s/**', async route => {
      if (route.request().method() === 'GET') {
        const mockCloudData = [
          {
            name: "Dr. Anita Desai",
            hospital: "Apollo Hospitals Bengaluru",
            mobile: "+91 99887 76655",
            score: 2900,
            stages: 3,
            totalTimeTaken: 45,
            timestamp: "2026-10-22T21:00:00.000Z"
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

    await page2.goto(`${BASE_URL}/#hunt`);
    await page2.waitForTimeout(400);

    console.log("  Entering registration form with name 'Dr. Anita Desai' and EMPTY phone...");
    await page2.fill('#reg-name', 'Dr. Anita Desai');
    await page2.fill('#reg-hospital', 'Apollo Hospitals');
    await page2.fill('#playerPhone', ''); // Strictly empty phone

    await page2.click('#btn-start-hunt');
    await page2.waitForTimeout(600);

    const modal2Hidden = !(await page2.isVisible('#registration-modal'));
    console.log(`  Registration modal closed: ${modal2Hidden}`);

    const restoredState2 = await page2.evaluate(() => {
      return {
        score: AppState.score,
        totalTimeTaken: AppState.totalTimeTaken,
        currentStage: AppState.currentStage,
        unlockedStages: AppState.unlockedStages,
        stage1Submitted: AppState.stageSubmissions[1]?.submitted,
        stage2Submitted: AppState.stageSubmissions[2]?.submitted,
        stage3Submitted: AppState.stageSubmissions[3]?.submitted,
        stage4Submitted: AppState.stageSubmissions[4]?.submitted
      };
    });

    console.log(`  Restored Score: ${restoredState2.score} Pts (Expected: 2900)`);
    console.log(`  Restored Total Time Taken: ${restoredState2.totalTimeTaken}s (Expected: 45)`);
    console.log(`  Current Stage routed to: ${restoredState2.currentStage} (Expected: 4)`);
    console.log(`  Stages 1, 2, 3 submitted: ${restoredState2.stage1Submitted && restoredState2.stage2Submitted && restoredState2.stage3Submitted}`);
    console.log(`  Stage 4 submitted: ${restoredState2.stage4Submitted || false} (Expected: false)`);

    // Verify Stage 4 is in Locked View (Day 2 locked padlock screen)
    const st4CardVisible = await page2.isVisible("#stage-card-4");
    const st4LockedVisible = await page2.isVisible("#stage4-locked");
    const st4ContentVisible = await page2.isVisible("#stage4-content");
    const st4StatusPillText = await page2.locator("#stage-4-status-pill").textContent();

    console.log(`  Stage 4 Card is visible: ${st4CardVisible} (Expected: true)`);
    console.log(`  Stage 4 Locked padlock screen is visible: ${st4LockedVisible} (Expected: true)`);
    console.log(`  Stage 4 Content is hidden: ${!st4ContentVisible} (Expected: true)`);
    console.log(`  Stage 4 Status Pill: '${st4StatusPillText}' (Expected: 'Locked')`);

    // Verify Toast Notification
    const toast2Text = await page2.evaluate(() => {
      const t = document.getElementById('session-recovery-toast');
      const p = document.getElementById('auto-unlock-pill');
      return (t ? t.textContent : "") || (p ? p.textContent : "");
    });
    console.log(`  Recovery Toast Text: '${toast2Text}'`);
    const expectedToast2 = "Welcome back, Dr. Anita Desai! Resuming at Stage 4 with 2900 pts.";
    const toast2Matches = toast2Text.includes("Welcome back, Dr. Anita Desai! Resuming at Stage 4 with 2900 pts.");

    const localSaved2 = await page2.evaluate(() => {
      const raw = localStorage.getItem("kics_app_state");
      if (!raw) return null;
      return JSON.parse(raw);
    });
    console.log(`  LocalStorage score: ${localSaved2?.score}, totalTimeTaken: ${localSaved2?.totalTimeTaken}`);

    test2Pass = (
      modal2Hidden &&
      restoredState2.score === 2900 &&
      restoredState2.totalTimeTaken === 45 &&
      restoredState2.currentStage === 4 &&
      restoredState2.stage1Submitted &&
      restoredState2.stage2Submitted &&
      restoredState2.stage3Submitted &&
      st4CardVisible &&
      st4LockedVisible &&
      !st4ContentVisible &&
      st4StatusPillText.includes("Locked") &&
      toast2Matches &&
      localSaved2?.score === 2900 &&
      localSaved2?.totalTimeTaken === 45
    );
    console.log(`  Test 2 Result: ${test2Pass ? 'PASSED ✅' : 'FAILED ❌'}`);

    await ctx2.close();

    // ------------------------------------------------------------
    // TEST 3: FAILSAFE ON TIMEOUT / NETWORK ERROR (USER NEVER BLOCKED)
    // ------------------------------------------------------------
    console.log("\n------------------------------------------------------------");
    console.log("TEST 3: Failsafe on Timeout / Network Error (User Never Blocked)");
    console.log("------------------------------------------------------------");

    const ctx3 = await browser.newContext();
    const page3 = await ctx3.newPage();

    // Route webhook to simulate a hanging connection (>3500ms delay, exceeds 2s timeout)
    await page3.route('https://script.google.com/macros/s/**', async route => {
      await new Promise(r => setTimeout(r, 4000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page3.goto(`${BASE_URL}/#hunt`);
    await page3.waitForTimeout(300);

    console.log("  Submitting registration with slow network connection (>2s)...");
    const tStart = Date.now();
    await page3.fill('#reg-name', 'Dr. Failsafe Tester');
    await page3.fill('#reg-hospital', 'Emergency Hospital');
    await page3.fill('#playerPhone', '9111122222');

    await page3.click('#btn-start-hunt');

    // Wait up to 2.5s for failsafe to fire and proceed with fresh registration
    await page3.waitForTimeout(2500);
    const elapsedMs = Date.now() - tStart;
    console.log(`  Registration processed in ${elapsedMs}ms (Failsafe timeout is 2000ms)`);

    const modal3Hidden = !(await page3.isVisible('#registration-modal'));
    const freshUser = await page3.evaluate(() => AppState.user);
    const freshScore = await page3.evaluate(() => AppState.score);
    const freshStage = await page3.evaluate(() => AppState.currentStage);

    console.log(`  Registration modal dismissed: ${modal3Hidden}`);
    console.log(`  User registered successfully: '${freshUser?.name}'`);
    console.log(`  Score is initialized fresh: ${freshScore} Pts`);
    console.log(`  Current stage is Quest 1: ${freshStage}`);

    test3Pass = (modal3Hidden && freshUser?.name === 'Dr. Failsafe Tester' && freshScore === 0 && freshStage === 1);
    console.log(`  Test 3 Result: ${test3Pass ? 'PASSED ✅' : 'FAILED ❌'}`);

    await ctx3.close();

    // ------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------
    console.log("\n============================================================");
    console.log("SESSION RECOVERY AUDIT SUMMARY");
    console.log("============================================================");
    console.log(`  Test 1: Phone Match Restoration & Routing (N=2 -> Stage 3)     : ${test1Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  Test 2: Name Match Restoration (Phone Empty, N=3 -> Day 2 Lock): ${test2Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  Test 3: Failsafe Timeout & Non-Blocking Fallback               : ${test3Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log("============================================================");

    if (test1Pass && test2Pass && test3Pass) {
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
