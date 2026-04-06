// ── Types ────────────────────────────────────────────────────────────────────

export type OcrParseResult<T> = {
  fields: Partial<T>;
  rawText: string;
  warnings: string[];
};

export type OcrParser<T> = (rawText: string) => OcrParseResult<T>;

// ── Helpers ──────────────────────────────────────────────────────────────────

const DATE_RE =
  /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;

const FULL_DATE_RE =
  /\b(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?))\s+(\d{1,2}),?\s*(\d{4})\b/i;

const TIME_RE = /\b(\d{1,2}:\d{2})\s*([APap][Mm])?\b/;

const MONEY_RE = /\$\s*([\d,]+\.?\d{0,2})/;

const URL_RE = /https?:\/\/\S+/i;

function firstMatch(text: string, re: RegExp): string | undefined {
  return re.exec(text)?.[0];
}

function lineAfterKeyword(text: string, keywords: string[]): string | undefined {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx !== -1) {
        // Try inline value first (after the keyword on same line)
        const after = lines[i].slice(idx + kw.length).replace(/^[\s:]+/, "").trim();
        if (after) return after;
        // Try next line
        if (i + 1 < lines.length && lines[i + 1].trim()) return lines[i + 1].trim();
      }
    }
  }
  return undefined;
}

function firstNonEmptyLine(text: string): string {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function parseDateToISO(text: string): string | undefined {
  const full = FULL_DATE_RE.exec(text);
  if (full) {
    const d = new Date(full[0]);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const short = DATE_RE.exec(text);
  if (short) {
    const [, a, b, c] = short;
    const year = c.length === 2 ? `20${c}` : c;
    // Assume MM/DD/YYYY
    const d = new Date(`${year}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return undefined;
}

function parseDatetimeLocal(dateStr: string, timeStr: string | undefined): string | undefined {
  const date = parseDateToISO(dateStr);
  if (!date) return undefined;
  if (timeStr) {
    const match = TIME_RE.exec(timeStr);
    if (match) {
      let [, hm, ampm] = match;
      let [h, m] = hm.split(":").map(Number);
      if (ampm) {
        const upper = ampm.toUpperCase();
        if (upper === "PM" && h < 12) h += 12;
        if (upper === "AM" && h === 12) h = 0;
      }
      return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  return `${date}T09:00`;
}

// ── Calendar Event Parser ────────────────────────────────────────────────────

export type CalendarEventFields = {
  title: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
};

export const parseCalendarEvent: OcrParser<CalendarEventFields> = (rawText) => {
  const fields: Partial<CalendarEventFields> = {};
  const warnings: string[] = [];

  // Title: first meaningful line
  fields.title = firstNonEmptyLine(rawText);

  // Location
  const loc = lineAfterKeyword(rawText, ["location", "where", "venue", " at "]);
  if (loc) fields.location = loc;

  // Dates and times
  const times = rawText.match(new RegExp(TIME_RE.source, "gi")) ?? [];
  const dateStr = firstMatch(rawText, DATE_RE) ?? firstMatch(rawText, FULL_DATE_RE);

  if (dateStr) {
    fields.start_at = parseDatetimeLocal(dateStr, times[0]);
    if (times.length >= 2) {
      fields.end_at = parseDatetimeLocal(dateStr, times[1]);
    } else if (fields.start_at) {
      // Default 1 hour duration
      const start = new Date(fields.start_at);
      start.setHours(start.getHours() + 1);
      fields.end_at = fields.start_at.slice(0, 11) + `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
    }
  } else {
    warnings.push("Could not detect a date");
  }

  // Description: remaining text minus title line
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    fields.description = lines.slice(1).join("\n");
  }

  return { fields, rawText, warnings };
};

// ── Calendar Meal Parser ─────────────────────────────────────────────────────

export type CalendarMealFields = {
  recipe_name: string;
  meal_type: string;
  servings: string;
  prep_minutes: string;
  recipe_url: string;
  notes: string;
};

export const parseCalendarMeal: OcrParser<CalendarMealFields> = (rawText) => {
  const fields: Partial<CalendarMealFields> = {};
  const warnings: string[] = [];

  fields.recipe_name = firstNonEmptyLine(rawText);

  // Servings
  const servingsMatch = rawText.match(/serves?\s*:?\s*(\d+)/i) ?? rawText.match(/(\d+)\s*servings?\b/i);
  if (servingsMatch) fields.servings = servingsMatch[1];

  // Prep time
  const prepMatch = rawText.match(/prep(?:\s*time)?\s*:?\s*(\d+)\s*min/i) ?? rawText.match(/(\d+)\s*minutes?\b/i);
  if (prepMatch) fields.prep_minutes = prepMatch[1];

  // Meal type keywords
  const lower = rawText.toLowerCase();
  if (lower.includes("breakfast")) fields.meal_type = "breakfast";
  else if (lower.includes("lunch")) fields.meal_type = "lunch";
  else if (lower.includes("dinner") || lower.includes("supper")) fields.meal_type = "dinner";
  else if (lower.includes("snack")) fields.meal_type = "snack";

  // URL
  const url = firstMatch(rawText, URL_RE);
  if (url) fields.recipe_url = url;

  // Notes: everything after first line
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    fields.notes = lines.slice(1).join("\n");
  }

  return { fields, rawText, warnings };
};

// ── Pantry Item Parser ───────────────────────────────────────────────────────

export type PantryItemFields = {
  name: string;
  qty: string;
  unit: string;
  expires: string;
};

export const parsePantryItem: OcrParser<PantryItemFields> = (rawText) => {
  const fields: Partial<PantryItemFields> = {};
  const warnings: string[] = [];

  fields.name = firstNonEmptyLine(rawText);

  // Quantity + unit
  const qtyMatch = rawText.match(/(\d+\.?\d*)\s*(oz|lb|lbs|kg|g|ml|l|gal|ct|count|pack|pcs?|ea)\b/i);
  if (qtyMatch) {
    fields.qty = qtyMatch[1];
    fields.unit = qtyMatch[2];
  }

  // Expiration
  const expiryLine = lineAfterKeyword(rawText, ["exp", "best by", "use by", "best before", "sell by"]);
  if (expiryLine) {
    const date = parseDateToISO(expiryLine);
    if (date) fields.expires = date;
    else warnings.push("Found expiry text but could not parse date");
  }

  return { fields, rawText, warnings };
};

// ── Finance Bill Parser ──────────────────────────────────────────────────────

export type FinanceBillFields = {
  name: string;
  amount: string;
  frequency: string;
  next_due_at: string;
};

export const parseFinanceBill: OcrParser<FinanceBillFields> = (rawText) => {
  const fields: Partial<FinanceBillFields> = {};
  const warnings: string[] = [];

  // Amount
  const money = MONEY_RE.exec(rawText);
  if (money) {
    fields.amount = money[1].replace(/,/g, "");
  } else {
    warnings.push("Could not detect a dollar amount");
  }

  // Company / bill name: first non-empty line that isn't purely a number or date
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (!line.match(/^[\d$.,\s]+$/) && !DATE_RE.test(line)) {
      fields.name = line;
      break;
    }
  }

  // Due date
  const dueLine = lineAfterKeyword(rawText, ["due date", "payment due", "due by", "due"]);
  if (dueLine) {
    const date = parseDateToISO(dueLine);
    if (date) fields.next_due_at = date;
  }

  // Frequency
  const lower = rawText.toLowerCase();
  if (lower.includes("monthly")) fields.frequency = "monthly";
  else if (lower.includes("weekly")) fields.frequency = "weekly";
  else if (lower.includes("biweekly") || lower.includes("bi-weekly")) fields.frequency = "biweekly";
  else if (lower.includes("quarterly")) fields.frequency = "quarterly";
  else if (lower.includes("semi-annual")) fields.frequency = "semi-annual";
  else if (lower.includes("annual") || lower.includes("yearly")) fields.frequency = "annual";

  return { fields, rawText, warnings };
};

// ── Finance Category Parser ──────────────────────────────────────────────────

export type FinanceCategoryFields = {
  name: string;
  monthly_limit: string;
};

export const parseFinanceCategory: OcrParser<FinanceCategoryFields> = (rawText) => {
  const fields: Partial<FinanceCategoryFields> = {};
  const warnings: string[] = [];

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Name: first non-numeric line
  for (const line of lines) {
    if (!line.match(/^[\d$.,\s]+$/)) {
      fields.name = line;
      break;
    }
  }

  // Limit: first dollar amount or standalone number
  const money = MONEY_RE.exec(rawText);
  if (money) {
    fields.monthly_limit = money[1].replace(/,/g, "");
  } else {
    const numMatch = rawText.match(/\b(\d+(?:\.\d{2})?)\b/);
    if (numMatch) fields.monthly_limit = numMatch[1];
  }

  return { fields, rawText, warnings };
};

// ── People Member Parser ─────────────────────────────────────────────────────

export type PeopleMemberFields = {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace: string;
  gender: string;
};

export const parsePeopleMember: OcrParser<PeopleMemberFields> = (rawText) => {
  const fields: Partial<PeopleMemberFields> = {};
  const warnings: string[] = [];

  // Name from keywords or first line
  const nameLine = lineAfterKeyword(rawText, ["name", "first name", "full name"]);
  if (nameLine) {
    const parts = nameLine.split(/\s+/);
    fields.firstName = parts[0];
    if (parts.length > 1) fields.lastName = parts.slice(1).join(" ");
  } else {
    const first = firstNonEmptyLine(rawText);
    const parts = first.split(/\s+/);
    if (parts.length >= 2 && parts.every((p) => /^[A-Z]/.test(p))) {
      fields.firstName = parts[0];
      fields.lastName = parts.slice(1).join(" ");
    } else {
      fields.firstName = first;
    }
  }

  // Birth date
  const dobLine = lineAfterKeyword(rawText, ["dob", "date of birth", "born", "birthday", "birth date"]);
  if (dobLine) {
    const date = parseDateToISO(dobLine);
    if (date) fields.birthDate = date;
    else warnings.push("Found birth date text but could not parse");
  }

  // Birth place
  const place = lineAfterKeyword(rawText, ["birthplace", "place of birth", "born in", "birth place"]);
  if (place) fields.birthPlace = place;

  // Gender
  const genderMatch = rawText.match(/\b(?:sex|gender)\s*:?\s*(male|female|m|f|other)\b/i);
  if (genderMatch) {
    const val = genderMatch[1].toLowerCase();
    if (val === "m" || val === "male") fields.gender = "male";
    else if (val === "f" || val === "female") fields.gender = "female";
    else fields.gender = "other";
  }

  return { fields, rawText, warnings };
};

// ── Shopping Items Parser ────────────────────────────────────────────────────

export type ShoppingItemsFields = {
  items: string[];
};

export const parseShoppingItems: OcrParser<ShoppingItemsFields> = (rawText) => {
  const warnings: string[] = [];

  const items = rawText
    .split("\n")
    .map((line) =>
      line
        .replace(/^[\s\-\*\u2022\u25CB\u25CF\d.)]+\s*/, "") // strip bullets, dashes, numbers
        .replace(/^\[[ x]?\]\s*/i, "") // strip checkboxes
        .trim()
    )
    .filter((line) => line.length > 0 && line.length < 100);

  if (items.length === 0) warnings.push("Could not detect any list items");

  return { fields: { items }, rawText, warnings };
};

// ── Task Parser ──────────────────────────────────────────────────────────────

export type TaskFields = {
  title: string;
};

export const parseTaskTitle: OcrParser<TaskFields> = (rawText) => {
  const warnings: string[] = [];

  let title = firstNonEmptyLine(rawText);
  // Strip common prefixes
  title = title.replace(/^[\s\-\*\u2022\d.)]+\s*/, "").replace(/^\[[ x]?\]\s*/i, "").trim();

  if (!title) warnings.push("Could not extract task text");

  return { fields: { title }, rawText, warnings };
};
