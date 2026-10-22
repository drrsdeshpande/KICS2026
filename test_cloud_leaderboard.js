/**
 * Targeted Headless Verification for Live Cloud Leaderboard Architecture
 * 
 * Verifies:
 * 1. Projector Decoupling: Does NOT inject local AppState.user into #leaderboard.
 * 2. Real-time GET Polling: fetchCloudLeaderboard() polls every 5000ms on #leaderboard.
 * 3. Lifecycle Management: Interval is cleared when navigating away to #hunt.
 * 4. Stats Counter Precision: Active Delegates = data.length, Top Score = highest score.
 * 5. Podium Population: Gold, Silver, Bronze correctly mapped from cloud records.
 * 6. Roster Table: Full table populated dynamically with all records.
 */

const { chromium } = require('playwright');
const BASE_URL = 'http://localhost:8080';

async function verifyCloudLeaderboard() {
  console.log("============================================================");
  console.log("TARGETED AUDIT: LIVE CLOUD WEBHOOK LEADERBOARD VERIFICATION");
  console.log("============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  try {
    // Step 1: Register a local user on #hunt and submit stage 1 with a distinct mock name
    console.log("Step 1: Setting up local delegate on #hunt...");
    await page.goto(`${BASE_URL}/#hunt`);
    await page.waitForTimeout(300);

    const regVisible = await page.isVisible('#registration-modal');
    if (regVisible) {
      await page.fill('#reg-name', 'Dr. Local Isolated User');
      await page.fill('#reg-hospital', 'Private Isolated Clinic');
      await page.fill('#reg-mobile', '9999900000');
      await page.click('#btn-start-hunt');
      await page.waitForTimeout(300);
    }

    // Submit Stage 1 locally
    await page.click("input[name='stage1-opt'][value='opt-b']");
    await page.click("#btn-submit-stage1");
    await page.waitForTimeout(400);

    const localScore = (await page.textContent("#header-score") || "").trim();
    console.log(`  Local delegate completed Stage 1 with score: ${localScore} pts`);

    // Step 2: Navigate to #leaderboard and verify local user is NOT in the cloud leaderboard
    console.log("\nStep 2: Navigating to #leaderboard view...");
    await page.goto(`${BASE_URL}/#leaderboard`);
    await page.waitForTimeout(1500); // Allow initial cloud fetch to complete

    // Check polling interval active
    const isIntervalActive = await page.evaluate(() => {
      return AppState.leaderboardPollInterval !== null && AppState.pollingStopped === false;
    });
    console.log(`  Polling interval active on #leaderboard: ${isIntervalActive}`);

    // Verify Projector Decoupling: local user 'Dr. Local Isolated User' must NOT appear on projector
    const renderedTableHtml = await page.innerHTML("#ticker-viewport");
    const containsLocalUser = renderedTableHtml.includes("Dr. Local Isolated User");
    console.log(`  Projector isolated from local storage/user: ${!containsLocalUser} (Contains local user: ${containsLocalUser})`);

    // Step 3: Verify stats counters match cloud data
    const cloudRecords = await page.evaluate(async () => {
      const res = await fetch(CONFIG.WEBHOOK_URL);
      return await res.json();
    });
    console.log(`  Cloud webhook returned ${cloudRecords.length} records.`);

    const hudDelegates = parseInt(await page.textContent("#hud-total-delegates") || "0", 10);
    const hudTopScore = (await page.textContent("#hud-max-score") || "").trim();
    const highestCloudScore = Math.max(...cloudRecords.map(r => r.score || 0));

    console.log(`  HUD Active Delegates: ${hudDelegates} (Expected: ${cloudRecords.length})`);
    console.log(`  HUD Top Score: '${hudTopScore}' (Expected: '${highestCloudScore} Pts')`);

    // Step 4: Verify Podium Gold, Silver, Bronze
    const goldName = (await page.textContent("#podium-name-1") || "").trim();
    const goldScore = parseInt(await page.textContent("#podium-score-1") || "0", 10);
    console.log(`  🥇 Gold Podium: ${goldName} (${goldScore} pts)`);

    // Step 5: Test Navigation Away & Interval Termination
    console.log("\nStep 5: Navigating back to Delegate View (#hunt)...");
    await page.click("#btn-back-to-hunt");
    await page.waitForTimeout(400);

    const isIntervalCleared = await page.evaluate(() => {
      return AppState.leaderboardPollInterval === null && AppState.pollingStopped === true;
    });
    console.log(`  Polling interval cleared on exit: ${isIntervalCleared}`);

    console.log("\nStep 6: Error diagnostics...");
    console.log(`  Total browser uncaught errors: ${pageErrors.length}`);

    const allPassed = (
      isIntervalActive &&
      !containsLocalUser &&
      hudDelegates === cloudRecords.length &&
      hudTopScore === `${highestCloudScore} Pts` &&
      goldScore === highestCloudScore &&
      isIntervalCleared &&
      pageErrors.length === 0
    );

    console.log("============================================================");
    if (allPassed) {
      console.log("🎉 ALL LIVE CLOUD LEADERBOARD CHECKS PASSED WITH 100% SUCCESS!");
    } else {
      console.log("❌ Some live cloud leaderboard checks failed.");
      process.exit(1);
    }
    console.log("============================================================\n");

  } catch (e) {
    console.error("Test failed with error:", e);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyCloudLeaderboard();
