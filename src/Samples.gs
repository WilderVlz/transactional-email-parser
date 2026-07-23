/**
 * =============================================================================
 *  SAMPLE DATA
 * =============================================================================
 *  Fictional email bodies used to demo and test the parser without touching a
 *  real Gmail inbox. Every value here is invented.
 *
 *  Use this to verify your PARSER_RULES before pointing the script at Gmail:
 *  paste one of your own (redacted) emails into SAMPLE_EMAILS and run
 *  `runSampleData` from the Email Parser menu.
 * =============================================================================
 */

const SAMPLE_EMAILS = [
  'DemoBank: You made a purchase of USD 72.39 at CITY SUPERMARKET with your ' +
  'card *1234, on 06/07/2026 at 18:06.',

  'DemoBank: You made a purchase of USD 18.90 at NOTION LABS, on 05/07/2026 ' +
  'at 16:05. This charge is linked to card *5678.',

  'DemoBank: You made a purchase of USD 41.00 at BLUE ORBIT WORKSHOP with ' +
  'your card *1234, on 04/07/2026 at 09:12.',

  'DemoBank: You transferred $675.50 from account *0000 to account *1122334455 ' +
  'on 17/06/2026 at 10:32.',

  'DemoBank: You sent $250.00 to CITY POWER AND LIGHT from account *0000. ' +
  '03/06/2026 15:58:21',

  'DemoLoyalty: Hello, you redeemed your points at: CITY SUPERMARKET DOWNTOWN ' +
  'Points redeemed: 26512 New balance: 15030 ' +
  'Transaction date: 24/05/2026 18:45:40'
];

/**
 * Parses the sample emails and writes them to the sheet.
 * Requires no Gmail permissions — useful as a live demo.
 */
function runSampleData() {
  var sheet = setupSheet();
  var written = 0;

  SAMPLE_EMAILS.forEach(function (body, index) {
    var record = parseEmailBody(body);
    if (!record) {
      Logger.log('Sample ' + index + ': no rule matched.');
      return;
    }
    if (recordExists(sheet, record)) {
      Logger.log('Sample ' + index + ': already present, skipped.');
      return;
    }
    appendRecord(sheet, record, 'sample-' + index);
    written++;
  });

  Logger.log('Sample rows written: ' + written);
  return written;
}

/**
 * Parses the sample emails and logs the result as JSON without writing
 * anything. Fastest way to debug a new rule.
 */
function testParserOnly() {
  SAMPLE_EMAILS.forEach(function (body, index) {
    Logger.log(index + ' -> ' + JSON.stringify(parseEmailBody(body)));
  });
}
