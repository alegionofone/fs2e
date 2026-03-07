const toNumber = (value, fallback = 0) => {
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
