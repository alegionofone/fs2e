import { toNumberMap } from "./shared.mjs";

const readAdjustments = (item, bucket) => {
  const primary = item?.system?.effects?.[bucket];
  const dataPath = item?.system?.data?.effects?.[bucket];
  const legacy = item?.system?.system?.effects?.[bucket];
  const source = primary && typeof primary === "object"
    ? primary
    : (dataPath && typeof dataPath === "object" ? dataPath : legacy);
  return toNumberMap(source);
};

export const collectItemEffectTotals = (items, bucket, { filter } = {}) => {
  const totals = {};
  const allow = typeof filter === "function" ? filter : () => true;

  for (const item of items ?? []) {
    if (!allow(item)) continue;
    const map = readAdjustments(item, bucket);
    for (const [path, amount] of Object.entries(map)) {
      totals[path] = (totals[path] ?? 0) + amount;
    }
  }

  return totals;
};
