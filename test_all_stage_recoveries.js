const { chromium } = require('playwright');
const BASE_URL = 'http://localhost:8080';

async function verifyAllStageRecoveries() {
  console.log("============================================================");
  console.log("TARGETED AUDIT: ALL 5 STAGE RECOVERY ROUTING CHECKS");
  console.log("============================================================\n");

  const browser = await chromium.launch({ headless: true });

  const testCases = [
    { stages: 1, expectedStage: 2, label: "stages=1 -> Stage 2", isFinal: false, isDay2Locked: false },
    { stages: 2, expectedStage: 3, label: "stages=2 -> Stage 3", isFinal: false, isDay2Locked: false },
    { stages: 3, expectedStage: 4, label: "stages=3 -> Day 1 Completed / Day 2 Locked", isFinal: false, isDay2Locked: true },
    { stages: 4, expectedStage: 5, label: "stages=4 -> Stage 5", isFinal: false, isDay2Locked: false },
    { stages: 5, expectedStage: 5, label: "stages=5 -> Final Completed Screen", isFinal: true, isDay2Locked: false }
  ];

  let allPassed = true;

  for (const tc of testCases) {
    console.log(`Testing Case: ${tc.label}...`);
    const context = await browser.newContext();
    const page = await context.newPage();

    let postDispatched = false;
    let alertsTriggered = false;
    page.on('request', req => {
      if (req.method() === 'POST' && req.url().includes('script.google.com')) postDispatched = true;
    });
    page.on('dialog', async dialog => {
      alertsTriggered = true;
      await dialog.dismiss();
    });

    await page.route('https://script.google.com/macros/s/**', async route => {
      if (route.request().method() === 'GET') {
        const mockData = [{
          name: `Dr. Tester ${tc.stages}`,
          hospital: "City Hospital",
          phone: `900000000${tc.stages}`,
          score: tc.stages * 900,
          stages: tc.stages,
          totalTimeTaken: tc.stages * 15,
          timestamp: new Date().toISOString()
        }];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockData)
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
    await page.waitForTimeout(300);

    await page.fill('#reg-name', `Dr. Tester ${tc.stages}`);
    await page.fill('#reg-hospital', 'City Hospital');
    await page.fill('#playerPhone', `900000000${tc.stages}`);

    await page.click('#btn-start-hunt');
    await page.waitForTimeout(500);

    const modalHidden = !(await page.isVisible('#registration-modal'));
    const currentStage = await page.evaluate(() => AppState.currentStage);
    const score = await page.evaluate(() => AppState.score);
    const stagesCompleted = await page.evaluate(() => AppState.stagesCompleted);

    let screenCheckPassed = false;
    if (tc.isDay2Locked) {
      const st4Visible = await page.isVisible('#stage-card-4');
      const st4Locked = await page.isVisible('#stage4-locked');
      const st4Content = await page.isVisible('#stage4-content');
      screenCheckPassed = st4Visible && st4Locked && !st4Content;
      console.log(`  Day 2 Locked Screen verified: ${screenCheckPassed}`);
    } else if (tc.isFinal) {
      const st5Visible = await page.isVisible('#stage-card-5');
      const st5Result = await page.isVisible('#stage5-result');
      const clinicalCardVisible = await page.isVisible('#stage5-clinical-card');
      const hasCompletedHeader = (await page.textContent('#stage5-result') || '').includes('Treasure Hunt Completed!');
      screenCheckPassed = st5Visible && st5Result && clinicalCardVisible && hasCompletedHeader;
      console.log(`  Final Completed Screen verified: ${screenCheckPassed}`);
    } else {
      const cardVisible = await page.isVisible(`#stage-card-${tc.expectedStage}`);
      screenCheckPassed = cardVisible && (currentStage === tc.expectedStage);
      console.log(`  Stage ${tc.expectedStage} Card visible: ${screenCheckPassed}`);
    }

    const toastText = await page.evaluate(() => {
      const t = document.getElementById('session-recovery-toast');
      const p = document.getElementById('auto-unlock-pill');
      return (t ? t.textContent : "") || (p ? p.textContent : "");
    });
    const toastValid = toastText.includes(`Welcome back, Dr. Tester ${tc.stages}!`);

    const pass = modalHidden && !postDispatched && !alertsTriggered && screenCheckPassed && toastValid && score === tc.stages * 900 && stagesCompleted === tc.stages;
    console.log(`  Result for stages=${tc.stages}: ${pass ? 'PASSED ✅' : 'FAILED ❌'}\n`);
    if (!pass) allPassed = false;

    await context.close();
  }

  await browser.close();

  if (allPassed) {
    console.log("🎉 ALL 5 STAGE RECOVERY ROUTING CASES VERIFIED (100% SUCCESS)!\n");
  } else {
    console.log("❌ Some routing test cases failed.\n");
    process.exit(1);
  }
}

verifyAllStageRecoveries();
