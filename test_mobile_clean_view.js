const { chromium } = require('playwright');
const BASE_URL = 'http://localhost:8080';

async function verifyMobileCleanView() {
  console.log("============================================================");
  console.log("TARGETED AUDIT: MOBILE DELEGATE VIEW & AUDITORIUM HUD");
  console.log("============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone 12/13/14 size
  const page = await context.newPage();

  // Test 1: On #hunt, ensure no leaderboard links exist anywhere in the view
  await page.goto(`${BASE_URL}/#hunt`);
  await page.waitForTimeout(300);

  const hasHeaderViewToggle = await page.$('#btn-view-toggle');
  const hasStageBoardBtn = await page.$('#btn-view-stage-board');
  const hasResetBtnInDelegateView = await page.$('#delegate-view #btn-reset-leaderboard');
  const isResetBtnVisibleOnHunt = await page.isVisible('#btn-reset-leaderboard');

  console.log("Checking Mobile Delegate Screen Elements:");
  console.log(`  #btn-view-toggle in Header: ${hasHeaderViewToggle ? 'PRESENT ❌' : 'ABSENT (Clean) ✅'}`);
  console.log(`  #btn-view-stage-board in Stage 5: ${hasStageBoardBtn ? 'PRESENT ❌' : 'ABSENT (Clean) ✅'}`);
  console.log(`  #btn-reset-leaderboard in delegate view: ${hasResetBtnInDelegateView ? 'PRESENT ❌' : 'ABSENT (Clean) ✅'}`);
  console.log(`  #btn-reset-leaderboard visible on #hunt: ${isResetBtnVisibleOnHunt ? 'VISIBLE ❌' : 'HIDDEN ✅'}`);

  const delegateViewVisible = await page.isVisible('#delegate-view');
  const leaderboardViewHidden = !(await page.isVisible('#leaderboard-view'));
  console.log(`  Delegate View visible: ${delegateViewVisible}`);
  console.log(`  Leaderboard View hidden on #hunt: ${leaderboardViewHidden}`);

  // Test 2: Navigate to #leaderboard
  await page.goto(`${BASE_URL}/#leaderboard`);
  await page.waitForTimeout(400);

  const leaderboardViewVisible = await page.isVisible('#leaderboard-view');
  const delegateViewHidden = !(await page.isVisible('#delegate-view'));
  const regModalHidden = !(await page.isVisible('#registration-modal'));

  console.log("\nChecking Auditorium Projector Screen (#leaderboard):");
  console.log(`  Leaderboard View visible: ${leaderboardViewVisible}`);
  console.log(`  Delegate View hidden: ${delegateViewHidden}`);
  console.log(`  Registration Modal hidden: ${regModalHidden}`);

  const hasResetInHud = await page.$('#btn-reset-leaderboard');
  const hasFreezeInHud = await page.isVisible('#btn-freeze-toggle');
  const hasConfettiInHud = await page.isVisible('#btn-confetti');
  const hasExportInHud = await page.isVisible('#btn-export-csv');

  console.log(`  Reset Leaderboard button in HUD (Presenter only): ${hasResetInHud ? 'RESTORED ✅' : 'MISSING ❌'}`);
  console.log(`  Freeze Board (F) button present: ${hasFreezeInHud ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  Confetti (C) button present: ${hasConfettiInHud ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  Export CSV button present: ${hasExportInHud ? 'YES ✅' : 'NO ❌'}`);

  let confirmDialogMsg = "";
  page.once('dialog', async dialog => {
    confirmDialogMsg = dialog.message();
    await dialog.dismiss();
  });
  await page.click('#btn-reset-leaderboard');
  await page.waitForTimeout(200);

  const confirmMsgMatches = confirmDialogMsg === "Are you sure you want to clear all scores?";
  console.log(`  Reset Leaderboard clicked prompts confirm(): ${confirmMsgMatches ? 'YES ✅' : 'NO ❌'}`);

  const allPassed = (
    !hasHeaderViewToggle &&
    !hasStageBoardBtn &&
    !hasResetBtnInDelegateView &&
    !isResetBtnVisibleOnHunt &&
    delegateViewVisible &&
    leaderboardViewHidden &&
    leaderboardViewVisible &&
    delegateViewHidden &&
    regModalHidden &&
    hasResetInHud &&
    hasFreezeInHud &&
    hasConfettiInHud &&
    hasExportInHud &&
    confirmMsgMatches
  );

  console.log("\n============================================================");
  if (allPassed) {
    console.log("🎉 ALL MOBILE CLEAN VIEW & AUDITORIUM HUD CHECKS PASSED (100% SUCCESS)!\n");
  } else {
    console.log("❌ Mobile clean view audit failed.\n");
    process.exit(1);
  }

  await browser.close();
}

verifyMobileCleanView();
