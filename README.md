# Transactional Email Parser

Automatically turn transactional notification emails into a clean, structured spreadsheet.

Built with Google Apps Script. Runs inside a Google Sheet, reads matching emails from Gmail on a schedule, extracts the fields that matter — date, merchant, amount, payment method, category — and appends one row per transaction. No manual data entry, no copy-paste.

---

## The problem it solves

Businesses receive dozens of automated emails every day: payment confirmations, order receipts, card notifications, platform payouts. The data inside them is useful, but it arrives as prose in an inbox, not as rows in a sheet.

The usual workaround is somebody opening each email and typing the numbers into a spreadsheet. That costs hours per week, and it introduces typos into the exact data you least want typos in.

This script removes that step.

**Typical use cases**

- E-commerce teams reconciling order confirmations against a sales log
- Agencies tracking client expenses across multiple corporate cards
- Freelancers logging platform payouts (Stripe, PayPal, Payoneer) automatically
- Bookkeepers building a transaction feed without a bank API integration

---

## What it does

| Step | Behaviour |
|------|-----------|
| 1 | Searches Gmail for messages from the senders you configure |
| 2 | Matches each message against a set of parsing rules |
| 3 | Extracts amount, merchant, date, card and currency |
| 4 | Assigns a category based on merchant keywords |
| 5 | Appends a row to the `Transactions` sheet |
| 6 | Labels the thread and remembers the message ID so nothing is written twice |

Anything it cannot resolve — an unknown merchant, an unrecognised card — is still written to the sheet, flagged in a **Needs Review** column. Nothing is silently dropped.

### Output

| Date | Type | Merchant | Category | Payment Method | Amount | Currency | Needs Review | Message ID | Logged At |
|------|------|----------|----------|----------------|--------|----------|--------------|------------|-----------|
| 2026-07-06 | Purchase | CITY SUPERMARKET | Groceries | Business Card | 72.39 | USD | | 18f3a… | 2026-07-06 19:00 |
| 2026-07-05 | Purchase | NOTION LABS | Software & Subscriptions | Personal Card | 18.90 | USD | | 18f3b… | 2026-07-06 19:00 |
| 2026-06-17 | Transfer | *1122334455 | | Bank Transfer | 675.50 | USD | | 18f2c… | 2026-06-17 11:00 |

---

## Installation

**Requirements:** a Google account. Nothing else — no server, no hosting, no paid services.

### 1. Create the spreadsheet

Create a new Google Sheet. You do not need to add any tabs or headers — the script builds them for you.

### 2. Open the script editor

In the spreadsheet menu: **Extensions → Apps Script**.

### 3. Add the source files

Delete the default `Code.gs`, then create one file per source file in this repo (the **+** button next to *Files*, then *Script*):

- `Config.gs`
- `Parser.gs`
- `Sheet.gs`
- `Main.gs`
- `Samples.gs`

Paste the contents of each file from [`src/`](src/) and save.

> Apps Script loads all `.gs` files into a single global scope, so file order does not matter.

### 4. Verify with sample data

Reload the spreadsheet. A new **Email Parser** menu appears in the toolbar.

Choose **Email Parser → Run with sample data**. Google will ask you to authorise the script the first time — this is normal for any Apps Script project. Approve it.

The `Transactions` sheet is created and filled with six fictional rows. If you see them, the installation works.

### 5. Point it at your own emails

Open `Config.gs` and edit:

```javascript
SENDERS: [
  'notifications.yourbank.com',
  'receipts@yourplatform.com'
],
```

Then adjust `CARD_LABELS` and `CATEGORY_RULES` to your own cards and merchants.

### 6. Test against real emails

**Email Parser → Run now.** Check the results in the sheet. If a message did not parse, adapt the rules (see below).

### 7. Enable automation

**Email Parser → Enable hourly automation.**

The script now runs by itself every hour. To change the interval, edit `TRIGGER_INTERVAL_HOURS` in `Config.gs` and re-enable the automation.

---

## Configuration

Everything you normally need to change lives in `Config.gs`.

### Senders and scanning

```javascript
SENDERS: ['alerts.demobank-example.com'],  // Gmail senders to scan
LOOKBACK_DAYS: 3,                          // how far back each run looks
PROCESSED_LABEL: 'Parsed/Transactions',    // label applied to handled threads
TRIGGER_INTERVAL_HOURS: 1                  // automation frequency
```

### Card labels

Maps the last four digits appearing in the email to a readable name:

```javascript
CARD_LABELS: {
  '1234': 'Business Card',
  '5678': 'Personal Card'
}
```

### Categories

Merchant keywords mapped to a category. Rules are evaluated top to bottom, so put the most specific ones first:

```javascript
CATEGORY_RULES: {
  'Software & Subscriptions': ['ADOBE', 'FIGMA', 'NOTION'],
  'Groceries':                ['SUPERMARKET', 'GROCER']
}
```

Matching is whole-word only, so `ACE` will not match `PALACE`.

---

## Adding a rule for a new email format

Each email type is described by an entry in `PARSER_RULES`. To support a new sender, add an object like this:

```javascript
{
  id: 'Payout',                                   // written to the Type column
  detect: /\bpayout sent\b/i,                     // identifies this email type
  amount: [/\$\s?([\d.,]+)/],                     // first capture = amount
  merchant: [/\bfrom\s+([\s\S]+?)\s+on\b/i],      // first capture = merchant
  card: [/\baccount\s*\*?(\d{4})\b/i],            // optional
  date: [/\bon\s+(\d{2})\/(\d{2})\/(\d{4})/],     // captures day, month, year
  dateOrder: 'DMY',                               // 'DMY' | 'MDY' | 'YMD'
  autoCategorize: true
}
```

Optional fields:

- `multiplier` — multiplies the parsed amount, for converting points or cents to currency
- `fixedMethod` — a fixed payment-method label when no card number is involved
- `currency` — a pattern whose capture group is the currency code

**Workflow for building a rule:** paste a redacted copy of the email into `SAMPLE_EMAILS` in `Samples.gs`, then run `testParserOnly` from the editor. It logs the parsed output as JSON without writing to the sheet, so you can iterate in seconds.

---

## Design notes

**Amount parsing is locale-aware.** `1.234,56` and `1,234.56` both parse to `1234.56`. The decimal separator is detected from the string rather than assumed, which matters when the same organisation sends purchase alerts and transfer alerts in different formats.

**Duplicates are guarded twice.** Processed Gmail message IDs are stored in Script Properties, and before writing, the script also checks whether a row with the same date, amount and merchant already exists. Either layer alone would leak duplicates in edge cases; together they do not.

**The ID list is bounded.** Script Properties has a size limit, so the list is trimmed to the most recent `MAX_TRACKED_IDS` entries.

**Unresolved data is surfaced, not hidden.** A row whose merchant or card could not be identified is still written and flagged for review. Silent failures in a financial log are worse than visible ones.

**Rules are data, not code.** Supporting a new bank or platform means adding an object to an array, not editing the parsing engine.

---

## Menu reference

| Menu item | Function | What it does |
|-----------|----------|--------------|
| Set up sheet | `setupSheet` | Creates and formats the `Transactions` sheet |
| Run now | `runParser` | Scans Gmail and writes new transactions |
| Enable hourly automation | `installTrigger` | Creates the time-driven trigger |
| Disable automation | `removeTrigger` | Removes the trigger |
| Run with sample data | `runSampleData` | Writes the bundled fictional rows |
| Reset duplicate memory | `resetProcessedIds` | Clears stored message IDs |

---

## Permissions

On first run Google asks you to authorise:

- **Gmail (read + modify labels)** — to read matching emails and label handled threads
- **Spreadsheets** — to write rows
- **Script triggers** — to schedule the automatic run

The script only reads messages matching the senders in your configuration. It never sends, deletes or forwards email, and no data leaves your Google account.

---

## Privacy

All sample data in this repository is fictional. Before publishing your own fork, remove real sender domains, card digits, account numbers and merchant names from `Config.gs` and `Samples.gs`.

---

## License

MIT — see [LICENSE](LICENSE).
