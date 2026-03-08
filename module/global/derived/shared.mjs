export const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export const isStatRecord = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  // Treat records containing at least one known stat field as a stat node.
  return ["base", "mod", "temp", "history", "xp", "max", "roll", "granted", "total"].some((key) => hasOwn(value, key));
};

export const computeStatTotal = (stat, granted = 0) => {
  const base = toNumber(stat.base);
  const mod = toNumber(stat.mod);
  const temp = toNumber(stat.temp);
  const history = toNumber(stat.history);
  const xp = toNumber(stat.xp);
  return base + mod + temp + history + xp + toNumber(granted);
};

export const getStatTotal = (stat) => {
  if (!stat || typeof stat !== "object" || Array.isArray(stat)) return 0;

  const explicit = Number(stat.total);
  if (Number.isFinite(explicit)) return explicit;

  return computeStatTotal(stat, stat.granted);
};

export const computeTraitTotal = (stat) => (
  toNumber(stat?.base)
  + toNumber(stat?.history)
  + toNumber(stat?.xp)
);

export const applyDerivedFields = (stat, granted = 0) => {
  const total = computeStatTotal(stat, granted);
  const max = toNumber(stat.max);

  stat.granted = toNumber(granted);
  stat.total = total;
  stat.roll = max > 0 ? Math.min(total, max) : total;
};

export const toNumberMap = (input) => {
  const out = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;

  for (const [key, value] of Object.entries(input)) {
    const num = Number(value);
    if (!Number.isFinite(num)) continue;
    out[String(key).trim()] = num;
  }

  return out;
};

export const readActiveHistoryItemIds = (actor) => {
  const raw = actor?.getFlag?.("fs2e", "historySlots");
  if (!Array.isArray(raw)) return new Set();

  return new Set(
    raw
      .map((entry) => String(entry?.id ?? "").trim())
      .filter(Boolean)
  );
};

export const filterActiveHistoryItems = (actor) => {
  const activeHistoryItemIds = readActiveHistoryItemIds(actor);
  return (actor?.items ?? []).filter((item) => {
    if (item?.type !== "history") return true;
    if (!activeHistoryItemIds.size) return false;
    return activeHistoryItemIds.has(String(item?.id ?? "").trim());
  });
};
