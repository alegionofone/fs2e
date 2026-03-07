export const SPIRIT_PRIMARY_OPTIONS = [
  { key: "extrovert", label: "Extrovert", pair: "extrovertIntrovert" },
  { key: "introvert", label: "Introvert", pair: "extrovertIntrovert" },
  { key: "passion", label: "Passion", pair: "passionCalm" },
  { key: "calm", label: "Calm", pair: "passionCalm" },
  { key: "faith", label: "Faith", pair: "faithEgo" },
  { key: "ego", label: "Ego", pair: "faithEgo" }
];

export const SPIRIT_PAIRS = [
  {
    key: "extrovertIntrovert",
    left: "extrovert",
    leftLabel: "Extrovert",
    right: "introvert",
    rightLabel: "Introvert"
  },
  {
    key: "passionCalm",
    left: "passion",
    leftLabel: "Passion",
    right: "calm",
    rightLabel: "Calm"
  },
  {
    key: "faithEgo",
    left: "faith",
    leftLabel: "Faith",
    right: "ego",
    rightLabel: "Ego"
  }
];

export const SPIRIT_PAIR_BY_KEY = Object.fromEntries(
  SPIRIT_PRIMARY_OPTIONS.map((entry) => [entry.key, entry.pair])
);

export const SPIRIT_LABELS = Object.fromEntries(
  SPIRIT_PRIMARY_OPTIONS.map((entry) => [entry.key, entry.label])
);

export const SPIRIT_OPPOSITE = {
  extrovert: "introvert",
  introvert: "extrovert",
  passion: "calm",
  calm: "passion",
  faith: "ego",
  ego: "faith"
};

export const DEFAULT_SPIRIT_BY_PAIR = {
  extrovertIntrovert: "extrovert",
  passionCalm: "passion",
  faithEgo: "faith"
};

const SPIRIT_KEY_BY_LABEL = new Map(
  SPIRIT_PRIMARY_OPTIONS.map((entry) => [entry.label.toLowerCase(), entry.key])
);

export const normalizeSpiritKey = (value, { allowLabels = false } = {}) => {
  const token = String(value ?? "").trim().toLowerCase();
  if (!token) return "";

  if (Object.prototype.hasOwnProperty.call(SPIRIT_PAIR_BY_KEY, token)) return token;
  if (!allowLabels) return "";

  return SPIRIT_KEY_BY_LABEL.get(token) ?? "";
};

export const normalizeAlwaysPrimary = (value, { allowLabels = false } = {}) => {
  const list = Array.isArray(value) ? value : [];
  const byPair = new Map();

  for (const raw of list) {
    const key = normalizeSpiritKey(raw, { allowLabels });
    if (!key) continue;

    const pair = SPIRIT_PAIR_BY_KEY[key];
    if (!pair || byPair.has(pair)) continue;
    byPair.set(pair, key);
  }

  return [...byPair.values()];
};

export const buildSpiritSelectionByPair = (alwaysPrimary, options = {}) => {
  const selection = { ...DEFAULT_SPIRIT_BY_PAIR };

  for (const key of normalizeAlwaysPrimary(alwaysPrimary, options)) {
    const pair = SPIRIT_PAIR_BY_KEY[key];
    if (pair) selection[pair] = key;
  }

  return selection;
};
