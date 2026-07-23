/**
 * =============================================================================
 *  SHEET LAYER
 * =============================================================================
 *  Creates the destination sheet and appends parsed records to it.
 *  The sheet is created automatically — no manual setup required.
 * =============================================================================
 */

/** Column order of the Transactions sheet. Index = column number - 1. */
const COLUMNS = [
  'Date',
  'Type',
  'Merchant',
  'Category',
  'Payment Method',
  'Amount',
  'Currency',
  'Needs Review',
  'Message ID',
  'Logged At'
];

/**
 * Creates the Transactions sheet with headers and formatting if it does not
 * exist yet. Safe to run repeatedly — it never overwrites existing data.
 *
 * @return {Sheet} The destination sheet.
 */
function setupSheet() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = book.insertSheet(CONFIG.SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  }

  var header = sheet.getRange(1, 1, 1, COLUMNS.length);
  header.setFontWeight('bold')
        .setBackground('#1f2937')
        .setFontColor('#ffffff')
        .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);
  sheet.getRange('A2:A').setNumberFormat('yyyy-mm-dd');
  sheet.getRange('F2:F').setNumberFormat('#,##0.00');
  sheet.getRange('J2:J').setNumberFormat('yyyy-mm-dd hh:mm');

  for (var i = 1; i <= COLUMNS.length; i++) {
    sheet.autoResizeColumn(i);
  }

  return sheet;
}

/**
 * Appends a parsed record to the sheet.
 *
 * @param {Sheet} sheet Destination sheet.
 * @param {Object} record Output of parseEmailBody().
 * @param {string} messageId Gmail message ID, stored for traceability.
 */
function appendRecord(sheet, record, messageId) {
  sheet.appendRow([
    record.date,
    record.type,
    record.merchant,
    record.category,
    record.method,
    record.amount,
    record.currency,
    record.needsReview ? CONFIG.REVIEW_FLAG : '',
    messageId,
    new Date()
  ]);
}

/**
 * Second-layer duplicate guard: returns true if a row with the same date,
 * amount and merchant already exists. Protects against re-processed emails
 * even if the message-ID memory was cleared.
 *
 * @return {boolean}
 */
function recordExists(sheet, record) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  for (var i = 0; i < values.length; i++) {
    var rowDate = values[i][0];
    if (!(rowDate instanceof Date)) continue;
    if (!isSameDay(rowDate, record.date)) continue;
    if (Math.round(Number(values[i][5]) * 100) !== Math.round(record.amount * 100)) continue;
    if (String(values[i][2]).trim() !== String(record.merchant).trim()) continue;
    return true;
  }
  return false;
}

/** True when two dates fall on the same calendar day. */
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}
