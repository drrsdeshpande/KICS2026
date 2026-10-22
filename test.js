/**
 * KICS 2026 End-to-End Headless Verification Test Suite
 * Automated Playwright Test Script (Node.js)
 * 
 * Verifies:
 * 1. Passcode Lockdown Test (Anti-Auto-Progression: completing Stage 1 does not open Stage 2)
 * 2. QR Code / URL Parameter Auto-Unlock Test (?unlock=VIDHANA1956)
 * 3. Strict Single-Attempt & Zero-Mark Penalty Test (0 pts on wrong + reload persistence)
 * 4. Dynamic Time-Decay Scoring Test (~950 pts after 5s wait)
 * 5. Zero-Spoiler DOM Test (Stage 5 free of "kala" / "leishmania", empty text box)
 * 6. Production Roster Purity (0 rows on clean instance) & 100-Delegate Scale Test
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';

// Mock Generator for 100 Delegates (STRICTLY residing inside test script only)
function generate100TestDelegates() {
  const names = [
    "Dr. Raghavendra", "Dr. Nanditha Rao", "Dr. Prathap Kumar", "Dr. Sowmya Swaminathan", "Dr. Anand Joshi",
    "Dr. Deepa Hegde", "Dr. Karthik Bhat", "Dr. Manjunath Shetty", "Dr. Ramesh Babu", "Dr. Shilpa Kulkarni",
    "Dr. Vikram Patil", "Dr. Ananya Murthy", "Dr. Chetan Gowda", "Dr. Divya Kamath", "Dr. Girish Deshpande",
    "Dr. Harish Nayak", "Dr. Jyothi Prasad", "Dr. Kiran Pai", "Dr. Madhavi Reddy", "Dr. Naveen Acharya",
    "Dr. Pallavi Shastry", "Dr. Rajeshwar Rao", "Dr. Sandeep Shenoy", "Dr. Tejaswini Holla", "Dr. Umashankar S",
    "Dr. Vinayaka Prabhu", "Dr. Yashaswini K", "Dr. Bheemasen Rao", "Dr. Chandrashekhar", "Dr. Dayanand Sagar"
  ];
  const hospitals = [
    "Manipal Hospital Sarjapur Road", "Narayana Institute of Cardiac Sciences", "Aster CMI Hospital Hebbal",
    "St. John's Medical College Hospital", "Apollo Hospital Bannerghatta", "Fortis Hospital Cunningham Road",
    "Bapuji Hospital Davangere", "KLE Academy of Higher Education Belagavi", "KMC Hospital Mangaluru",
    "Ramaiah Memorial Hospital", "Columbia Asia / Manipal Whitefield", "JSS Medical College Mysuru"
  ];

  const list = [];
  for (let i = 0; i < 100; i++) {
    const name = names[i % names.length];
    const hospital = hospitals[i % hospitals.length];
    const stages = Math.min(5, Math.floor(5 - (i / 22)));
    const timeTaken = 30 + (i * 10);
    const score = Math.max(150, 4850 - (i * 42));
    list.push({
      id: `test-del-${i + 1}`,
      name: `${name} ${i >= 30 ? '(' + (i + 1) + ')' : ''}`.trim(),
      hospital: hospital,
      mobile: `+91 98450 ${String(10000 + i).slice(-5)}`,
      stagesCompleted: stages,
      score: score,
      totalTimeTaken: timeTaken,
      timestamp: new Date(Date.now() - timeTaken * 1000).toISOString(),
      isCurrentUser: false
    });
  }
  return list;
}

async function runTests() {
  console.log("============================================================");
  console.log("KICS 2026 TREASURE HUNT PROGRESSIVE WEB APP TEST SUITE");
  console.log("Target Server:", BASE_URL);
  console.log("============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    // ------------------------------------------------------------
    // TEST 1: PASSCODE LOCKDOWN & ANTI-AUTO-PROGRESSION
    // ------------------------------------------------------------
    console.log("------------------------------------------------------------");
    console.log("TEST 1: Passcode Lockdown Test (Anti-Auto-Progression)");
    console.log("------------------------------------------------------------");
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await page1.goto(`${BASE_URL}/#hunt`);

    // Complete Registration if modal is open
    const regVisible = await page1.isVisible('#registration-modal');
    if (regVisible) {
      await page1.fill('#reg-name', 'Dr. Test Examiner');
      await page1.fill('#reg-hospital', 'Narayana Institute of Cardiac Sciences');
      await page1.fill('#reg-mobile', '9845012345');
      await page1.click('#btn-start-hunt');
      await page1.waitForTimeout(300);
    }

    // Solve Stage 1 with correct answer Option B
    console.log("  Step 1a: Submitting Stage 1 Correct Option B (Vascular Waterfall)...");
    await page1.click("input[name='stage1-opt'][value='opt-b']");
    await page1.click("#btn-submit-stage1");
    await page1.waitForTimeout(400);

    const scoreSt1 = await page1.textContent("#header-score");
    console.log(`  Stage 1 score awarded: ${scoreSt1} pts`);

    // Verify Stage 2 is strictly LOCKED
    const st2LockedClass = await page1.locator("#step-nav-2").getAttribute("class");
    const isSt2LockedInNav = st2LockedClass.includes("locked");
    console.log(`  Stage 2 in Stepper is locked: ${isSt2LockedInNav} (Expected: true)`);

    // Click Stage 2 in Stepper
    console.log("  Step 1b: Clicking locked Stage 2 in Stepper...");
    await page1.click("#step-nav-2");
    await page1.waitForTimeout(300);

    // Assert Passcode Modal opens and Stage 2 content is 100% hidden
    const modalVisible = await page1.isVisible("#passcode-modal");
    const st2ContentVisible = await page1.isVisible("#stage2-content");
    console.log(`  Passcode modal opened: ${modalVisible} (Expected: true)`);
    console.log(`  Stage 2 content is hidden: ${!st2ContentVisible} (Expected: true)`);

    // Enter WRONGCODE
    console.log("  Step 1c: Entering incorrect passcode 'WRONGCODE'...");
    await page1.fill("#modal-passcode-input", "WRONGCODE");
    await page1.click("#btn-modal-unlock");
    await page1.waitForTimeout(300);

    const errorMsg = await page1.textContent("#modal-passcode-error");
    const st2StillContentHidden = !(await page1.isVisible("#stage2-content"));
    console.log(`  Error message displayed: '${errorMsg.trim()}'`);
    console.log(`  Stage 2 remains locked after wrong code: ${st2StillContentHidden}`);

    // Enter correct code LALBAGH1760 (case-insensitive test: lalbagh1760)
    console.log("  Step 1d: Entering valid passcode 'lalbagh1760'...");
    await page1.fill("#modal-passcode-input", "lalbagh1760");
    await page1.click("#btn-modal-unlock");
    await page1.waitForTimeout(500);

    const modalClosed = !(await page1.isVisible("#passcode-modal"));
    const st2NowUnlocked = await page1.isVisible("#stage2-content");
    console.log(`  Passcode modal closed: ${modalClosed}`);
    console.log(`  Stage 2 content now visible: ${st2NowUnlocked}`);

    const test1Pass = (
      isSt2LockedInNav &&
      modalVisible &&
      !st2ContentVisible &&
      errorMsg.includes("Invalid passcode") &&
      modalClosed &&
      st2NowUnlocked
    );
    results.push(["Passcode Lockdown & Anti-Auto-Progression", test1Pass]);
    await ctx1.close();

    // ------------------------------------------------------------
    // TEST 2: QR CODE / URL PARAMETER AUTO-UNLOCK TEST
    // ------------------------------------------------------------
    console.log("\n------------------------------------------------------------");
    console.log("TEST 2: URL Parameter Auto-Unlock Test (?unlock=VIDHANA1956)");
    console.log("------------------------------------------------------------");
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(`${BASE_URL}/?unlock=VIDHANA1956#hunt`);
    await page2.waitForTimeout(500);

    const st3ContentVisible = await page2.isVisible("#stage3-content");
    const st3LockedHidden = !(await page2.isVisible("#stage3-locked"));
    const modalPromptHidden = !(await page2.isVisible("#passcode-modal"));
    const autoPillText = (await page2.textContent("#auto-unlock-pill") || "").trim();

    console.log(`  Stage 3 content unlocked automatically: ${st3ContentVisible && st3LockedHidden}`);
    console.log(`  No manual passcode modal prompted: ${modalPromptHidden}`);
    console.log(`  Auto-unlock notification pill text: '${autoPillText}'`);

    const test2Pass = (st3ContentVisible && st3LockedHidden && modalPromptHidden && autoPillText.includes("Stage 3 unlocked"));
    results.push(["URL Parameter Auto-Unlock (?unlock=VIDHANA1956)", test2Pass]);

    // ------------------------------------------------------------
    // TEST 3: STRICT SINGLE-ATTEMPT & ZERO-MARK PENALTY TEST
    // ------------------------------------------------------------
    console.log("\n------------------------------------------------------------");
    console.log("TEST 3: Strict Single-Attempt & Zero-Mark Penalty Test");
    console.log("------------------------------------------------------------");
    // Ensure registered if modal is up
    if (await page2.isVisible('#registration-modal')) {
      await page2.fill('#reg-name', 'Dr. Bengaluru Tester');
      await page2.fill('#reg-hospital', 'Aster CMI Hospital Hebbal');
      await page2.fill('#reg-mobile', '9845077777');
      await page2.click('#btn-start-hunt');
      await page2.waitForTimeout(300);
    }

    // On the same page2 (already on Stage 3), select WRONG Option A
    console.log("  Step 3a: Submitting WRONG Option A on Stage 3...");
    await page2.click("input[name='stage3-opt'][value='opt-a']");
    await page2.click("#btn-submit-stage3");
    await page2.waitForTimeout(400);

    const st3OptionsDisabled = await page2.locator("input[name='stage3-opt']").first().isDisabled();
    const st3BtnDisabled = await page2.locator("#btn-submit-stage3").isDisabled();
    const scoreAfterWrong = await page2.textContent("#header-score");
    const feedbackBannerText = (await page2.textContent("#stage3-feedback-banner") || "").trim();

    console.log(`  Radios disabled: ${st3OptionsDisabled}, Submit button disabled: ${st3BtnDisabled}`);
    console.log(`  Score awarded: ${scoreAfterWrong} pts (Expected: 0)`);
    console.log(`  Feedback banner: '${feedbackBannerText.slice(0, 35)}...'`);

    console.log("  Step 3b: Reloading page to test persistence of locked zero score...");
    await page2.reload();
    await page2.waitForTimeout(500);
    await page2.click("#step-nav-3");
    await page2.waitForTimeout(300);

    const scoreAfterReload = await page2.textContent("#header-score");
    const st3StillDisabled = await page2.locator("input[name='stage3-opt']").first().isDisabled();
    const st3BtnStillDisabled = await page2.locator("#btn-submit-stage3").isDisabled();

    console.log(`  Score after reload: ${scoreAfterReload} pts (Expected: 0)`);
    console.log(`  Stage 3 still permanently disabled: ${st3StillDisabled && st3BtnStillDisabled}`);

    const test3Pass = (
      st3OptionsDisabled &&
      st3BtnDisabled &&
      scoreAfterWrong === "0" &&
      scoreAfterReload === "0" &&
      st3StillDisabled &&
      st3BtnStillDisabled
    );
    results.push(["Single-Attempt Lockout & Zero-Mark Penalty", test3Pass]);
    await ctx2.close();

    // ------------------------------------------------------------
    // TEST 4: DYNAMIC TIME-DECAY SCORING TEST (~950 pts after 5s)
    // ------------------------------------------------------------
    console.log("\n------------------------------------------------------------");
    console.log("TEST 4: Dynamic Time-Decay Scoring Test (~950 pts after 5s)");
    console.log("------------------------------------------------------------");
    const ctx4 = await browser.newContext();
    const page4 = await ctx4.newPage();
    await page4.goto(`${BASE_URL}/#hunt`);

    const reg4Visible = await page4.isVisible('#registration-modal');
    if (reg4Visible) {
      await page4.fill('#reg-name', 'Dr. Speed Tester');
      await page4.fill('#reg-hospital', 'Manipal Hospital Sarjapur Road');
      await page4.fill('#reg-mobile', '9845099999');
      await page4.click('#btn-start-hunt');
      await page4.waitForTimeout(200);
    }

    console.log("  Waiting exactly 5 seconds on Stage 1 to test decay formula: max(200, 1000 - 5*10)...");
    await page4.waitForTimeout(5000);

    await page4.click("input[name='stage1-opt'][value='opt-b']");
    await page4.click("#btn-submit-stage1");
    await page4.waitForTimeout(400);

    const scoreAwarded = parseInt(await page4.textContent("#header-score") || "0", 10);
    console.log(`  Score awarded after ~5s delay: ${scoreAwarded} pts (Expected: 930 - 970 pts)`);

    const test4Pass = (scoreAwarded >= 930 && scoreAwarded <= 970);
    results.push(["Dynamic Time-Decay Scoring (5s Delay)", test4Pass]);
    await ctx4.close();

    // ------------------------------------------------------------
    // TEST 5: ZERO-SPOILER DOM TEST ON STAGE 5
    // ------------------------------------------------------------
    console.log("\n------------------------------------------------------------");
    console.log("TEST 5: Zero-Spoiler DOM Test on Stage 5");
    console.log("------------------------------------------------------------");
    const ctx5 = await browser.newContext();
    const page5 = await ctx5.newPage();
    await page5.goto(`${BASE_URL}/#hunt`);

    // Check DOM of Stage 5 on clean load
    const st5Text = (await page5.locator("#stage-card-5").innerText() || "").toLowerCase();
    const hasKala = st5Text.includes("kala");
    const hasLeish = st5Text.includes("leishmania");
    console.log(`  Stage 5 DOM contains 'kala': ${hasKala} (Must be false)`);
    console.log(`  Stage 5 DOM contains 'leishmania': ${hasLeish} (Must be false)`);

    // Check text input field
    const st5Input = page5.locator("#stage5-answer");
    const val = await st5Input.inputValue();
    const placeholder = await st5Input.getAttribute("placeholder");
    console.log(`  #stage5-answer value: '${val}' (Expected: '')`);
    console.log(`  #stage5-answer placeholder: '${placeholder}' (Expected: 'Type disease name here...')`);

    // Check Stages 1 to 4 are MCQs with 4 unselected options
    let mcqPass = true;
    for (let s = 1; s <= 4; s++) {
      const radios = await page5.locator(`#stage-card-${s} input[type='radio']`).count();
      const checkedRadios = await page5.locator(`#stage-card-${s} input[type='radio']:checked`).count();
      if (radios !== 4 || checkedRadios !== 0) mcqPass = false;
      console.log(`  Stage ${s} MCQ verification: ${radios} radios, ${checkedRadios} checked by default`);
    }

    const test5Pass = (!hasKala && !hasLeish && val === "" && placeholder === "Type disease name here..." && mcqPass);
    results.push(["Zero-Spoiler DOM & Strict MCQ Configuration", test5Pass]);
    await ctx5.close();

    // ------------------------------------------------------------
    // TEST 6: PRODUCTION ROSTER PURITY & 100-DELEGATE SCALE TEST
    // ------------------------------------------------------------
    console.log("\n------------------------------------------------------------");
    console.log("TEST 6: Production Roster Purity & 100-Delegate Scale Test");
    console.log("------------------------------------------------------------");
    const ctx6 = await browser.newContext();
    const page6 = await ctx6.newPage();
    await page6.goto(`${BASE_URL}/#leaderboard`);
    await page6.waitForTimeout(500);

    // Initial clean load purity check
    const initialRows = await page6.locator(".ticker-row").count();
    const initialHudCount = (await page6.textContent("#hud-total-delegates") || "").trim();
    console.log(`  Clean instance initial ticker rows: ${initialRows} (Expected: 0)`);
    console.log(`  Clean instance HUD delegate count: ${initialHudCount} (Expected: '0')`);
    const purityPass = (initialRows === 0 && initialHudCount === "0");

    // Inject 100 mock delegates (from test script only)
    console.log("  Injecting 100 simulated participants into production leaderboard...");
    const mock100 = generate100TestDelegates();
    await page6.evaluate((data) => {
      if (window.stopLeaderboardPolling) window.stopLeaderboardPolling();
      window.participants = data;
      window.renderLeaderboard();
    }, mock100);
    await page6.waitForTimeout(400);

    const scaledRows = await page6.locator(".ticker-row").count();
    const scaledHudCount = (await page6.textContent("#hud-total-delegates") || "").trim();
    console.log(`  Scaled ticker rows rendered: ${scaledRows} (Expected: 100)`);
    console.log(`  Scaled HUD delegate count: ${scaledHudCount} (Expected: '100')`);

    // Verify podium sorting
    const p1Score = parseInt(await page6.textContent("#podium-score-1") || "0", 10);
    const p2Score = parseInt(await page6.textContent("#podium-score-2") || "0", 10);
    const p3Score = parseInt(await page6.textContent("#podium-score-3") || "0", 10);
    console.log(`  Podium scores: 🥇 Gold=${p1Score}, 🥈 Silver=${p2Score}, 🥉 Bronze=${p3Score}`);
    const sortedPodium = (p1Score >= p2Score && p2Score >= p3Score);

    // Verify Presenter hotkeys
    console.log("  Testing Presenter Hotkey 'F' (Freeze Ticker)...");
    await page6.keyboard.press("f");
    await page6.waitForTimeout(200);
    const isFrozen = (await page6.locator("#btn-freeze-toggle").getAttribute("class") || "").includes("active-freeze");
    await page6.keyboard.press("f");
    await page6.waitForTimeout(200);

    console.log("  Testing Presenter Hotkey 'C' (Celebration Confetti)...");
    await page6.keyboard.press("c");
    await page6.waitForTimeout(300);

    const test6Pass = (purityPass && scaledRows === 100 && scaledHudCount === "100" && sortedPodium && isFrozen);
    results.push(["Production Roster Purity & 100-Delegate Scale Test", test6Pass]);

    // ------------------------------------------------------------
    // TEST 7: HIDDEN PRESENTER SHORTCUT (SHIFT + X) & RESET MODAL
    // ------------------------------------------------------------
    console.log("\n------------------------------------------------------------");
    console.log("TEST 7: Presenter Shortcut (Shift + X) & Leaderboard Reset Modal");
    console.log("------------------------------------------------------------");

    // Test Shift + X keyboard shortcut to open confirmation modal
    console.log("  Step 7a: Pressing Shift + X on #leaderboard...");
    await page6.keyboard.down("Shift");
    await page6.keyboard.press("KeyX");
    await page6.keyboard.up("Shift");
    await page6.waitForTimeout(300);

    const resetModalVisible1 = await page6.isVisible("#reset-confirm-modal");
    const confirmTitle = (await page6.textContent("#reset-confirm-title") || "").trim();
    console.log(`  Reset confirmation modal opened via Shift+X: ${resetModalVisible1} (Expected: true)`);
    console.log(`  Modal prompt title: '${confirmTitle}' (Expected: 'Clear all leaderboard data?')`);

    // Test Cancel button preserves data
    console.log("  Step 7b: Clicking Cancel button...");
    await page6.click("#btn-reset-cancel");
    await page6.waitForTimeout(200);
    const resetModalHidden = !(await page6.isVisible("#reset-confirm-modal"));
    const rowsPreserved = await page6.locator(".ticker-row").count();
    console.log(`  Modal closed on cancel: ${resetModalHidden}, Rows preserved: ${rowsPreserved} (Expected: 100)`);

    // Test discreet button click & confirm reset
    console.log("  Step 7c: Clicking discreet 'Reset Leaderboard' button...");
    await page6.click("#btn-reset-leaderboard");
    await page6.waitForTimeout(200);
    const resetModalVisible2 = await page6.isVisible("#reset-confirm-modal");
    console.log(`  Reset modal opened via button: ${resetModalVisible2}`);

    console.log("  Step 7d: Confirming reset action...");
    await page6.click("#btn-reset-confirm");
    await page6.waitForTimeout(300);

    const resetModalClosedFinal = !(await page6.isVisible("#reset-confirm-modal"));
    const clearedRows = await page6.locator(".ticker-row").count();
    const clearedHudCount = (await page6.textContent("#hud-total-delegates") || "").trim();
    const emptyRosterShown = await page6.isVisible("#empty-roster");
    const storageCleared = await page6.evaluate(() => localStorage.getItem('participants') === null);

    console.log(`  Modal closed: ${resetModalClosedFinal}`);
    console.log(`  localStorage.getItem('participants') is null: ${storageCleared}`);
    console.log(`  Instant empty table re-rendered: ${clearedRows} ticker rows (Expected: 0)`);
    console.log(`  HUD total delegates: ${clearedHudCount} (Expected: '0')`);
    console.log(`  Empty roster placeholder rendered: ${emptyRosterShown}`);

    const test7Pass = (
      resetModalVisible1 &&
      confirmTitle.includes("Clear all leaderboard data?") &&
      resetModalHidden &&
      rowsPreserved === 100 &&
      resetModalVisible2 &&
      resetModalClosedFinal &&
      clearedRows === 0 &&
      clearedHudCount === "0" &&
      storageCleared
    );
    results.push(["Shift + X Presenter Reset Modal & Instant Clear", test7Pass]);
    await ctx6.close();

    // ------------------------------------------------------------
    // TEST 8: LIVE CLOUD WEBHOOK BACKEND & POLLING TEST
    // ------------------------------------------------------------
    console.log("\n------------------------------------------------------------");
    console.log("TEST 8: Live Cloud Webhook Backend Integration & Polling Test");
    console.log("------------------------------------------------------------");
    const ctx8 = await browser.newContext();
    const page8 = await ctx8.newPage();

    let pageErrors = 0;
    page8.on('pageerror', (e) => {
      console.error("  Browser Page Error:", e.message);
      pageErrors++;
    });

    await page8.goto(`${BASE_URL}/#leaderboard`);
    await page8.waitForTimeout(1500);

    // Verify polling function exists and executed
    const pollingActive = await page8.evaluate(() => {
      return typeof window.startLeaderboardPolling === 'function' && typeof window.fetchCloudLeaderboard === 'function';
    });
    console.log(`  Leaderboard polling functions registered: ${pollingActive}`);

    // Verify fetch to Google Apps Script works without CORS error
    const cloudFetchResult = await page8.evaluate(async () => {
      try {
        const url = 'https://script.google.com/macros/s/AKfycbw1z87eFcp6suL4PH2IKMKdNy7FMpnrMzkWvGCLD5NIXr9tmPVYJGsvwWQEsbHe9yts/exec';
        const res = await fetch(url);
        const data = await res.json();
        return { ok: res.ok, status: res.status, isArray: Array.isArray(data), length: data.length };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
    console.log(`  Live Cloud Webhook GET response: status=${cloudFetchResult.status}, isArray=${cloudFetchResult.isArray}, records=${cloudFetchResult.length}`);

    // Verify empty state text if records is 0, or verify rows if > 0
    let emptyStatePass = true;
    if (cloudFetchResult.length === 0) {
      const emptyText = (await page8.textContent("#empty-roster") || "").trim();
      console.log(`  Empty state text: '${emptyText}'`);
      emptyStatePass = emptyText.includes("Awaiting delegate submissions... Scan Quest 1 to begin!");
    } else {
      const renderedRows = await page8.locator(".ticker-row").count();
      console.log(`  Live cloud rows rendered on leaderboard: ${renderedRows}`);
      emptyStatePass = (renderedRows > 0);
    }

    const test8Pass = (pollingActive && cloudFetchResult.ok && cloudFetchResult.isArray && emptyStatePass && pageErrors === 0);
    results.push(["Live Cloud Webhook Backend & Polling Integration", test8Pass]);
    await ctx8.close();

  } catch (err) {
    console.error("Test execution encountered an exception:", err);
  } finally {
    await browser.close();
  }

  // ------------------------------------------------------------
  // FINAL SUMMARY REPORT
  // ------------------------------------------------------------
  console.log("\n============================================================");
  console.log("FINAL AUDIT & VERIFICATION REPORT SUMMARY");
  console.log("============================================================");
  let allPassed = true;
  for (const [name, passed] of results) {
    console.log(`  ${name.padEnd(52)}: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
    if (!passed) allPassed = false;
  }
  console.log("============================================================");
  if (allPassed && results.length === 8) {
    console.log("🎉 ALL 8 AUDIT & END-TO-END TEST SUITES PASSED FLAWLESSLY (100% SUCCESS)!");
  } else {
    console.log("⚠️ Some test suites failed or were skipped.");
    process.exit(1);
  }
  console.log("============================================================\n");
}

runTests();
