/**
 * =============================================================================
 *  TRANSACTIONAL EMAIL PARSER — MAIN
 * =============================================================================
 *  Reads transactional notification emails from Gmail, extracts structured
 *  data (date, merchant, amount, payment method, category) and appends each
 *  one as a row in a Google Sheet.
 *
 *  Entry points:
 *    onOpen()             — adds the custom menu to the spreadsheet.
 *    runParser()          — scans Gmail and writes new transactions.
 *    installTrigger()     — schedules runParser() to run automatically.
 *    removeTrigger()      — cancels the scheduled run.
 *    runSampleData()      — parses bundled sample emails (no Gmail access).
 *
 *  Configuration lives in Config.gs.
 * =============================================================================
 */

/** Adds the custom menu when the spreadsheet is opened. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Email Parser')
    .addItem('1. Set up sheet', 'setupSheet')
    .addItem('2. Run now', 'runParser')
    .addSeparator()
    .addItem('Enable hourly automation', 'installTrigger')
    .addItem('Disable automation', 'removeTrigger')
    .addSeparator()
    .addItem('Run with sample data', 'runSampleData')
    .addItem('Reset duplicate memory', 'resetProcessedIds')
    .addToUi();
}

/**
 * Main routine. Scans Gmail for unprocessed notification emails, parses them
 * and appends new transactions to the sheet.
 *
 * @return {number} Number of transactions written.
 */
function runParser() {
  var sheet = setupSheet();
  var label = getOrCreateLabel(CONFIG.PROCESSED_LABEL);
  var processed = loadProcessedIds();
  var newIds = [];
  var written = 0;
  var skipped = 0;

  var threads = GmailApp.search(buildQuery());

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      var id = message.getId();
      if (processed[id]) return;

      processed[id] = true;
      newIds.push(id);

      var record = parseEmailBody(message.getPlainBody());
      if (!record) return;

      if (recordExists(sheet, record)) {
        skipped++;
        return;
      }

      appendRecord(sheet, record, id);
      written++;

      if (CONFIG.VERBOSE) Logger.log(JSON.stringify(record));
    });
    thread.addLabel(label);
  });

  saveProcessedIds(newIds);

  Logger.log('Transactions written: ' + written +
             ' | duplicates skipped: ' + skipped +
             ' | threads scanned: ' + threads.length);
  return written;
}

/** Builds the Gmail search query from CONFIG. */
function buildQuery() {
  var senders = CONFIG.SENDERS.join(' OR ');
  var query = 'from:(' + senders + ')' +
              ' newer_than:' + CONFIG.LOOKBACK_DAYS + 'd' +
              ' -label:"' + CONFIG.PROCESSED_LABEL + '"';
  if (CONFIG.EXTRA_QUERY) query += ' ' + CONFIG.EXTRA_QUERY;
  return query;
}

/** Returns the Gmail label, creating it if necessary. */
function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}


/* ----------------------------- Duplicate memory ---------------------------- */

/** Loads the set of already-processed message IDs. */
function loadProcessedIds() {
  var raw = PropertiesService.getScriptProperties().getProperty('PROCESSED_IDS') || '';
  var map = {};
  raw.split(',').forEach(function (id) { if (id) map[id] = true; });
  return map;
}

/** Persists newly processed IDs, keeping the list bounded. */
function saveProcessedIds(newIds) {
  if (!newIds.length) return;
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('PROCESSED_IDS') || '';
  var all = raw ? raw.split(',') : [];
  all = all.concat(newIds);
  if (all.length > CONFIG.MAX_TRACKED_IDS) {
    all = all.slice(all.length - CONFIG.MAX_TRACKED_IDS);
  }
  props.setProperty('PROCESSED_IDS', all.join(','));
}

/** Clears the duplicate memory. Useful when re-testing. */
function resetProcessedIds() {
  PropertiesService.getScriptProperties().deleteProperty('PROCESSED_IDS');
  Logger.log('Duplicate memory cleared.');
}


/* -------------------------------- Triggers -------------------------------- */

/** Installs (or reinstalls) the time-driven trigger for runParser(). */
function installTrigger() {
  removeTrigger();
  ScriptApp.newTrigger('runParser')
    .timeBased()
    .everyHours(CONFIG.TRIGGER_INTERVAL_HOURS)
    .create();
  Logger.log('Automation enabled: runs every ' +
             CONFIG.TRIGGER_INTERVAL_HOURS + ' hour(s).');
}

/** Removes any existing trigger for runParser(). */
function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'runParser') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  Logger.log('Automation disabled.');
}
