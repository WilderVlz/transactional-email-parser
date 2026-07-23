/**
 * =============================================================================
 *  PARSER ENGINE
 * =============================================================================
 *  Turns a plain-text email body into a structured record.
 *  Driven entirely by PARSER_RULES and CATEGORY_RULES in Config.gs.
 *  You should not need to edit this file for normal configuration.
 * =============================================================================
 */

/**
 * Parses an email body into a transaction record.
 *
 * @param {string} body Plain-text body of the email.
 * @return {Object|null} Record, or null if no rule matched.
 *   { date, type, merchant, category, method, amount, currency, needsReview }
 */
function parseEmailBody(body) {
  if (!body) return null;

  for (var i = 0; i < PARSER_RULES.length; i++) {
    var rule = PARSER_RULES[i];
    if (!rule.detect.test(body)) continue;
    return applyRule(rule, body);
  }
  return null;
}

/** Applies a single rule to a body. Returns a record or null. */
function applyRule(rule, body) {
  var rawAmount = firstCapture(body, rule.amount);
  if (rawAmount === null) return null;

  var amount = parseAmount(rawAmount);
  if (amount === null || amount <= 0) return null;
  if (typeof rule.multiplier === 'number') amount = amount * rule.multiplier;

  var merchant = firstCapture(body, rule.merchant);
  var needsReview = false;

  if (merchant) {
    merchant = merchant.trim().replace(/\s+/g, ' ');
  } else {
    merchant = 'Unidentified';
    needsReview = true;
  }

  var method = rule.fixedMethod || '';
  if (!method && rule.card) {
    var digits = firstCapture(body, rule.card);
    if (digits && CONFIG.CARD_LABELS[digits]) {
      method = CONFIG.CARD_LABELS[digits];
    } else {
      method = CONFIG.UNKNOWN_CARD_LABEL;
      needsReview = true;
    }
  }

  var category = '';
  if (rule.autoCategorize) {
    category = categorize(merchant);
    if (!category) needsReview = true;
  }

  var currency = CONFIG.DEFAULT_CURRENCY;
  if (rule.currency) {
    var c = firstCapture(body, [rule.currency]);
    if (c) currency = c.toUpperCase();
  }

  return {
    date: parseDate(body, rule.date, rule.dateOrder || 'DMY'),
    type: rule.id,
    merchant: merchant,
    category: category,
    method: method,
    amount: amount,
    currency: currency,
    needsReview: needsReview
  };
}

/** Returns the first capture group of the first matching pattern, or null. */
function firstCapture(text, patterns) {
  if (!patterns) return null;
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m && m[1]) return m[1];
  }
  return null;
}

/**
 * Parses a numeric string using either European ("1.234,56") or
 * Anglo ("1,234.56") conventions, detected automatically.
 *
 * @param {string} raw
 * @return {number|null}
 */
function parseAmount(raw) {
  var s = String(raw).trim();
  var lastDot = s.lastIndexOf('.');
  var lastComma = s.lastIndexOf(',');
  var decimalSep = null;

  if (lastDot > -1 && lastComma > -1) {
    decimalSep = lastDot > lastComma ? '.' : ',';
  } else if (lastComma > -1) {
    decimalSep = (s.length - lastComma - 1) === 2 ? ',' : null;
  } else if (lastDot > -1) {
    decimalSep = (s.length - lastDot - 1) === 2 ? '.' : null;
  }

  if (decimalSep === ',') {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (decimalSep === '.') {
    s = s.replace(/,/g, '');
  } else {
    s = s.replace(/[.,]/g, '');
  }

  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Extracts a date from the body. Falls back to "now" when no pattern matches,
 * so a transaction is never silently dropped.
 *
 * @param {string} body
 * @param {Array<RegExp>} patterns Each capturing three groups.
 * @param {string} order 'DMY' | 'MDY' | 'YMD'
 * @return {Date}
 */
function parseDate(body, patterns, order) {
  if (patterns) {
    for (var i = 0; i < patterns.length; i++) {
      var m = body.match(patterns[i]);
      if (m && m[3]) {
        var a = parseInt(m[1], 10);
        var b = parseInt(m[2], 10);
        var c = parseInt(m[3], 10);
        if (order === 'MDY') return new Date(c, a - 1, b);
        if (order === 'YMD') return new Date(a, b - 1, c);
        return new Date(c, b - 1, a);   // DMY
      }
    }
  }
  return new Date();
}

/** Returns the first category whose keyword matches the merchant, or ''. */
function categorize(merchant) {
  var haystack = String(merchant).toUpperCase();
  for (var category in CATEGORY_RULES) {
    var keywords = CATEGORY_RULES[category];
    for (var i = 0; i < keywords.length; i++) {
      if (matchesWholeWord(haystack, keywords[i])) return category;
    }
  }
  return CONFIG.UNKNOWN_CATEGORY_LABEL;
}

/**
 * Whole-word (or whole-segment) match. Prevents short keywords from matching
 * inside longer words — e.g. "ACE" must not match "PALACE".
 */
function matchesWholeWord(text, keyword) {
  var escaped = String(keyword).toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp('(^|[^A-Z0-9])' + escaped + '($|[^A-Z0-9])');
  return re.test(text);
}
