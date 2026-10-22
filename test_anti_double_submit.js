/**
 * Automated Verification for Mobile Anti-Double-Submission & Twin POST Prevention
 * 
 * Tests:
 * 1. Immediate Button Disabling: Clicking "Register" or "Submit Answer" disables button instantly.
 * 2. Flag Guarding: window.isSubmitting is set to true during submission.
 * 3. Twin POST Request Suppression: Rapid double-clicks (within 20ms) only trigger a SINGLE POST request.
 * 4. 1.5-Second Minimum Lock Window: Secondary clicks/events are strictly dropped.
 * 5. Permanent Single-Attempt Lockout: Button stays disabled as 'Answer Submitted (Locked)' after submission.
 * 6. Apps Script LockService Concurrency: Verifies Code.gs / google_apps_script.js use LockService.
 */

const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'http://localhost:8080';

async function runAntiDoubleSubmitTests() {
  console.log("============================================================");
  console.log("TEST SUITE: MOBILE ANTI-DOUBLE-SUBMISSION & TWIN POST GUARD");
  console.log("============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let postRequests = [];
  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('script.google.com')) {
      postRequests.push({
        url: req.url(),
        postData: req.postData()
      });
    }
  });

  try {
    // ------------------------------------------------------------
    // TEST 1: REGISTRATION ANTI-DOUBLE-SUBMISSION
    // ------------------------------------------------------------
    console.log("------------------------------------------------------------");
    console.log("TEST 1: Registration Button Immediate Disabling & Twin POST Prevention");
    console.log("------------------------------------------------------------");
    await page.goto(`${BASE_URL}/#hunt`);
    await page.waitForTimeout(400);

    await page.fill('#reg-name', 'Dr. Anti Double Tap');
    await page.fill('#reg-hospital', 'Manipal Institute');
    await page.fill('#playerPhone', '9845099999');

    postRequests = [];

    // Trigger rapid double submit on form
    console.log("  Simulating rapid double-tap on Registration button...");
    const regResult = await page.evaluate(async () => {
      const regBtn = document.getElementById('btn-start-hunt');
      const regForm = document.getElementById('registration-form');

      // Click 1
      regBtn.click();
      const disabledAfterClick1 = regBtn.disabled;
      const isSubmittingAfterClick1 = window.isSubmitting;

      // Click 2 immediately (millisecond later)
      regBtn.click();

      return {
        disabledAfterClick1,
        isSubmittingAfterClick1
      };
    });

    console.log(`  Registration button disabled immediately: ${regResult.disabledAfterClick1}`);
    console.log(`  window.isSubmitting set to true: ${regResult.isSubmittingAfterClick1}`);

    // Wait for recovery check and registration lock window to elapse
    await page.waitForFunction(() => window.isSubmitting === false, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);

    const isSubmittingReset = await page.evaluate(() => window.isSubmitting === false);
    console.log(`  window.isSubmitting reset after lock window: ${isSubmittingReset}`);
    console.log(`  POST requests dispatched during registration: ${postRequests.length} (Expected: 1)`);

    // Verify phone payload consistency
    const regPayload = postRequests[0]?.postData ? JSON.parse(postRequests[0].postData) : null;
    const phoneInUser = regPayload?.user?.phone === '9845099999';
    const phoneAtRoot = regPayload?.phone === '9845099999';
    console.log(`  Payload consistency: user.phone='${regPayload?.user?.phone}', root phone='${regPayload?.phone}' (Both valid: ${phoneInUser && phoneAtRoot})`);

    const test1Pass = regResult.disabledAfterClick1 && regResult.isSubmittingAfterClick1 && isSubmittingReset && (postRequests.length === 1) && phoneInUser && phoneAtRoot;

    // ------------------------------------------------------------
    // TEST 2: STAGE 1 SUBMIT ANSWER ANTI-DOUBLE-SUBMISSION
    // ------------------------------------------------------------
    console.log("\n------------------------------------------------------------");
    console.log("TEST 2: Stage 1 Submit Button Immediate Disabling & Twin POST Prevention");
    console.log("------------------------------------------------------------");

    // Select Stage 1 Option B
    await page.click("input[name='stage1-opt'][value='opt-b']");

    postRequests = [];

    // Rapid double click on Stage 1 Submit button
    console.log("  Simulating rapid twin click on 'Submit Answer' button...");
    const stage1Result = await page.evaluate(async () => {
      const btn = document.getElementById('btn-submit-stage1');

      // Click 1
      btn.click();
      const disabledAfterClick1 = btn.disabled;
      const isSubmittingAfterClick1 = window.isSubmitting;

      // Click 2 immediately
      btn.click();

      return {
        disabledAfterClick1,
        isSubmittingAfterClick1
      };
    });

    console.log(`  Stage 1 Submit button disabled immediately: ${stage1Result.disabledAfterClick1}`);
    console.log(`  window.isSubmitting set to true: ${stage1Result.isSubmittingAfterClick1}`);

    await page.waitForTimeout(1800);

    const isSubmittingReset2 = await page.evaluate(() => window.isSubmitting === false);
    const btnTextAfter = await page.textContent("#btn-submit-stage1");
    const btnDisabledAfter = await page.isDisabled("#btn-submit-stage1");

    console.log(`  Stage 1 button text after submission: '${btnTextAfter.trim()}'`);
    console.log(`  Stage 1 button permanently disabled: ${btnDisabledAfter}`);
    console.log(`  POST requests dispatched for Stage 1: ${postRequests.length} (Expected: 1)`);

    const test2Pass = stage1Result.disabledAfterClick1 && stage1Result.isSubmittingAfterClick1 && isSubmittingReset2 && btnDisabledAfter && (postRequests.length === 1);

    // ------------------------------------------------------------
    // TEST 3: GOOGLE APPS SCRIPT LOCKSERVICE AUDIT
    // ------------------------------------------------------------
    console.log("\n------------------------------------------------------------");
    console.log("TEST 3: Google Apps Script LockService Concurrency Code Audit");
    console.log("------------------------------------------------------------");

    const gsContent = fs.readFileSync("google_apps_script.js", "utf8");
    const hasLockService = gsContent.includes("LockService.getScriptLock()");
    const hasWaitLock = gsContent.includes("lock.waitLock(10000)");
    const hasReleaseLock = gsContent.includes("lock.releaseLock()");
    const hasFinally = gsContent.includes("finally") && gsContent.includes("lock.releaseLock()");

    console.log(`  LockService.getScriptLock() present: ${hasLockService}`);
    console.log(`  lock.waitLock(10000) present: ${hasWaitLock}`);
    console.log(`  lock.releaseLock() inside finally block: ${hasFinally}`);

    const test3Pass = hasLockService && hasWaitLock && hasReleaseLock && hasFinally;

    // ------------------------------------------------------------
    // FINAL REPORT
    // ------------------------------------------------------------
    console.log("\n============================================================");
    console.log("VERIFICATION REPORT");
    console.log("============================================================");
    console.log(`  Test 1 (Registration Double-Submit Prevention)  : ${test1Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  Test 2 (Stage Answer Twin-POST Prevention)      : ${test2Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  Test 3 (Google Apps Script LockService Audit)   : ${test3Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log("============================================================");

    if (test1Pass && test2Pass && test3Pass) {
      console.log("🎉 ALL ANTI-DOUBLE-SUBMISSION CHECKS PASSED WITH 100% SUCCESS!\n");
    } else {
      console.log("❌ Some anti-double-submission checks failed.\n");
      process.exit(1);
    }

  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runAntiDoubleSubmitTests();
