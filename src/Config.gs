/**
 * =============================================================================
 *  TRANSACTIONAL EMAIL PARSER — CONFIGURATION
 * =============================================================================
 *  This is the only file most users need to edit.
 *  Everything here is data: senders, patterns, card labels and categories.
 *  No changes to Parser.gs / Sheet.gs / Main.gs are required for normal setup.
 * =============================================================================
 */

const CONFIG = {

  /** Name of the sheet where parsed transactions are appended. */
  SHEET_NAME: 'Transactions',

  /**
   * Gmail senders to scan. Domains or full addresses both work.
   * Example: ['notifications.mybank.com', 'receipts@shopify.com']
   */
  SENDERS: [
    'alerts.demobank-example.com',
    'rewards.demoloyalty-example.com'
  ],

  /** Extra Gmail search terms appended to the query. Leave '' if unused. */
  EXTRA_QUERY: '',

  /** How many days back to scan on each run. */
  LOOKBACK_DAYS: 3,

  /** Gmail label applied to threads that have already been handled. */
  PROCESSED_LABEL: 'Parsed/Transactions',

  /** How often the automatic trigger runs, in hours. */
  TRIGGER_INTERVAL_HOURS: 1,

  /** Currency written to the sheet when a rule does not detect one. */
  DEFAULT_CURRENCY: 'USD',

  /**
   * Maps the last 4 digits of a card to a human-readable label.
   * Replace with your own. Keys must be strings.
   */
  CARD_LABELS: {
    '1234': 'Business Card',
    '5678': 'Personal Card'
  },

  /** Written when a card number is present but not found in CARD_LABELS. */
  UNKNOWN_CARD_LABEL: '',

  /** Written when no category rule matches the merchant. */
  UNKNOWN_CATEGORY_LABEL: '',

  /**
   * Rows whose merchant or card could not be resolved get this prefix,
   * so a human can filter and review them. Set to '' to disable.
   */
  REVIEW_FLAG: 'REVIEW',

  /** Keep at most this many message IDs in the dedupe memory. */
  MAX_TRACKED_IDS: 1000,

  /** Set to true to log every parsed record to the execution log. */
  VERBOSE: false
};


/**
 * =============================================================================
 *  PARSER RULES
 * =============================================================================
 *  Each rule describes one KIND of email. Rules are evaluated in order and the
 *  first one whose `detect` pattern matches the message body wins.
 *
 *  Fields:
 *    id        — internal identifier (also written to the "Type" column).
 *    detect    — RegExp that identifies this email type.
 *    amount    — array of RegExp; first capture group is the numeric amount.
 *    currency  — optional RegExp; first capture group is the currency code.
 *    merchant  — array of RegExp; first capture group is the merchant name.
 *    card      — optional array of RegExp capturing the last 4 digits.
 *    date      — array of RegExp capturing (day, month, year) in `dateOrder`.
 *    dateOrder — 'DMY', 'MDY' or 'YMD'. Defaults to 'DMY'.
 *    multiplier— optional number the amount is multiplied by (e.g. points→cash).
 *    fixedMethod — optional payment-method label when no card is involved.
 *    autoCategorize — if false, the Category column is left blank for a human.
 *
 *  Amounts are parsed safely for both "1.234,56" and "1,234.56" formats.
 * =============================================================================
 */
const PARSER_RULES = [

  {
    id: 'Purchase',
    detect: /\byou (?:made a )?purchase|purchase of\b/i,
    currency: /\b(USD|EUR|GBP|COP|MXN|BRL)\b/,
    amount: [
      /(?:USD|EUR|GBP|COP|MXN|BRL)\s?([\d.,]+)/i,
      /\$\s?([\d.,]+)/
    ],
    merchant: [
      /\bat\s+([\s\S]+?)\s+with your\b/i,
      /\bat\s+([\s\S]+?),\s*on\s+\d{2}\/\d{2}\/\d{4}/i
    ],
    card: [/\bcard\s*\*?(\d{4})\b/i],
    date: [
      /\bon\s+(\d{2})\/(\d{2})\/(\d{4})/,
      /(\d{2})\/(\d{2})\/(\d{4})\s+\d{2}:\d{2}/
    ],
    dateOrder: 'DMY',
    autoCategorize: true
  },

  {
    id: 'Transfer',
    detect: /\byou (?:sent|transferred)\b/i,
    amount: [/\$\s?([\d.,]+)/, /(?:USD|EUR|GBP)\s?([\d.,]+)/i],
    merchant: [
      /\bto account\s+(\*?\d+)/i,
      /\bto\s+([\s\S]+?)\s+from account\b/i
    ],
    date: [
      /\bon\s+(\d{2})\/(\d{2})\/(\d{4})/,
      /(\d{2})\/(\d{2})\/(\d{4})\s+\d{2}:\d{2}/
    ],
    dateOrder: 'DMY',
    fixedMethod: 'Bank Transfer',
    autoCategorize: false
  },

  {
    id: 'Reward Redemption',
    detect: /\bredeemed your points\b/i,
    amount: [/\bpoints redeemed:\s*([\d.,]+)/i],
    multiplier: 0.01,           // 100 points = 1 currency unit
    merchant: [/\bredeemed your points at:\s*([\s\S]+?)\s*(?:Points redeemed|$)/i],
    date: [/\btransaction date(?: was)?:\s*(\d{2})\/(\d{2})\/(\d{4})/i],
    dateOrder: 'DMY',
    fixedMethod: 'Loyalty Points',
    autoCategorize: false
  }
];


/**
 * =============================================================================
 *  CATEGORY RULES
 * =============================================================================
 *  Maps merchant keywords to a category. Evaluated top to bottom; the first
 *  matching keyword wins, so put the most specific categories first.
 *
 *  Matching is whole-word only: "ACE" will not match "PALACE".
 * =============================================================================
 */
const CATEGORY_RULES = {
  'Software & Subscriptions': ['ADOBE', 'FIGMA', 'NOTION', 'SLACK', 'ZOOM', 'GITHUB'],
  'Marketplaces':             ['AMAZON', 'EBAY', 'ETSY', 'MARKETPLACE'],
  'Groceries':                ['SUPERMARKET', 'GROCER', 'FOOD MART', 'MARKET HALL'],
  'Dining':                   ['CAFE', 'COFFEE', 'RESTAURANT', 'DINER', 'PIZZERIA'],
  'Transport':                ['UBER', 'LYFT', 'TAXI', 'METRO', 'FUEL', 'GAS STATION'],
  'Pharmacy & Health':        ['PHARMACY', 'DRUGSTORE', 'CLINIC'],
  'Utilities':                ['ELECTRIC', 'WATER CO', 'INTERNET', 'TELECOM', 'MOBILE']
};
