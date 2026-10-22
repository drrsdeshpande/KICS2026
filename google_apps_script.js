/**
 * ============================================================================
 * KICS 2026 Live Scavenger Hunt Webhook Backend (Google Apps Script)
 * ============================================================================
 * Endpoint:
 * https://script.google.com/macros/s/AKfycbw1z87eFcp6suL4PH2IKMKdNy7FMpnrMzkWvGCLD5NIXr9tmPVYJGsvwWQEsbHe9yts/exec
 * 
 * Features:
 * 1. LockService concurrency protection: prevents millisecond race-condition writes
 *    and mobile double-submissions using a 10-second script lock.
 * 2. Mobile Delegate Push (POST): Upserts records based on mobile number or doctor name.
 * 3. Auditorium Projector Polling (GET): Serves live leaderboard array sorted by
 *    Score (DESC) and Total Time Taken (ASC).
 */

const SHEET_NAME = "Leaderboard";

/**
 * Returns active spreadsheet sheet or initializes with standard schema.
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "Doctor Name",
      "Hospital / Institution",
      "Mobile",
      "Score",
      "Stages Completed",
      "Total Time Taken (s)",
      "Timestamp"
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 7).setFontWeight("bold");
  }
  return sheet;
}

/**
 * Handle GET requests: Polled by Auditorium Projector Leaderboard (#leaderboard)
 */
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const rows = data.slice(1);
    const participants = rows.map(r => ({
      name: String(r[0] || "").trim(),
      hospital: String(r[1] || "").trim(),
      mobile: String(r[2] || "").trim(),
      score: Number(r[3] || 0),
      stages: Number(r[4] || 0),
      totalTimeTaken: Number(r[5] || 0),
      timestamp: r[6] instanceof Date ? r[6].toISOString() : String(r[6] || "")
    })).filter(p => p.name || p.mobile);

    // Sort primarily by Score (Descending), secondarily by Total Time Taken (Ascending)
    participants.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.totalTimeTaken || 0) - (b.totalTimeTaken || 0);
    });

    return ContentService.createTextOutput(JSON.stringify(participants))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests: Pushed by Delegate Mobile Phones
 * Concurrency Protection: Uses LockService to prevent millisecond race-condition writes.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Acquire exclusive script lock with 10-second wait timeout
    lock.waitLock(10000);

    const sheet = getOrCreateSheet();
    let body = {};

    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        body = {};
      }
    } else if (e && e.parameter) {
      body = e.parameter;
    }

    const user = body.user || {};
    const name = String(user.name || body.name || "Delegate").trim();
    const hospital = String(user.hospital || body.hospital || "Institution").trim();
    const mobile = String(user.mobile || body.mobile || "").trim();
    const score = Number(body.score !== undefined ? body.score : 0);
    const stages = Number(body.stages !== undefined ? body.stages : (body.stagesCompleted || 0));
    const totalTimeTaken = Number(body.totalTimeTaken !== undefined ? body.totalTimeTaken : 0);
    const timestamp = body.timestamp || new Date().toISOString();

    if (!name && !mobile) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Missing user information"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    // Search for existing participant by Mobile or Doctor Name to prevent duplicate rows
    for (let i = 1; i < data.length; i++) {
      const rowMobile = String(data[i][2] || "").trim();
      const rowName = String(data[i][0] || "").trim();
      if ((mobile && rowMobile === mobile) || (!mobile && rowName === name)) {
        rowIndex = i + 1; // 1-based index in Google Sheets
        break;
      }
    }

    if (rowIndex > 0) {
      // Update existing delegate row
      sheet.getRange(rowIndex, 1, 1, 7).setValues([[
        name,
        hospital,
        mobile,
        score,
        stages,
        totalTimeTaken,
        timestamp
      ]]);
    } else {
      // Append new delegate row
      sheet.appendRow([
        name,
        hospital,
        mobile,
        score,
        stages,
        totalTimeTaken,
        timestamp
      ]);
    }

    SpreadsheetApp.flush();

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Delegate progress saved successfully",
      record: { name, hospital, mobile, score, stages, totalTimeTaken, timestamp }
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    // Release the script lock unconditionally
    lock.releaseLock();
  }
}
