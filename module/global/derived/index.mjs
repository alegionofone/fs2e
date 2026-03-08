import { aggregateActorCharacteristicEffects } from "./characteristics.mjs";
import { aggregateActorSkillEffects } from "./skills.mjs";
import { filterActiveHistoryItems, getStatTotal, toNumber } from "./shared.mjs";

const normalizeBonusEntries = (list = []) => {
  const out = [];
  const seen = new Set();

  for (const entry of Array.isArray(list) ? list : []) {
    const uuid = String(entry?.uuid ?? "").trim();
    const name = String(entry?.name ?? entry ?? "").trim();
    if (!uuid && !name) continue;
    const token = `${uuid.toLowerCase()}::${name.toLowerCase()}`;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push({ uuid, name });
  }

  return out;
};

const getNestedArray = (system, path) => {
  const fromSystem = foundry.utils.getProperty(system, path);
  if (Array.isArray(fromSystem)) return fromSystem;
  const fromLegacy = foundry.utils.getProperty(system, `data.${path}`);
  if (Array.isArray(fromLegacy)) return fromLegacy;
  return [];
};

const parseSignedAmount = (value) => {
  const text = String(value ?? "").trim().replace(/\s+/g, "");
  if (!text) return 0;
  const match = text.match(/^([+-]?)(\d{1,2})$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * Number(match[2]);
};

const normalizeTargetText = (value) => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ");

const targetMatchesVitality = (target) => {
  const text = String(target ?? "").trim();
  if (!text) return false;
  const normalized = normalizeTargetText(text);
  return normalized.includes("vitality");
};

const resolveBlessingCurseSync = (uuid) => {
  const normalized = String(uuid ?? "").trim();
  if (!normalized || typeof fromUuidSync !== "function") return null;
  try {
    return fromUuidSync(normalized);
  } catch {
    return null;
  }
};

const collectVitalityBlessingCurseEntries = (actor) => {
  const historyEntries = filterActiveHistoryItems(actor)
    .filter((item) => item?.type === "history")
    .flatMap((item) => normalizeBonusEntries([
      ...getNestedArray(item?.system ?? {}, "bonusBlessingCurses"),
      ...getNestedArray(item?.system ?? {}, "data.bonusBlessingCurses")
    ]));

  const actorEntries = normalizeBonusEntries([
    ...getNestedArray(actor?.system ?? {}, "bonusBlessingCurses"),
    ...getNestedArray(actor?.system ?? {}, "data.bonusBlessingCurses")
  ]);

  return normalizeBonusEntries([...historyEntries, ...actorEntries]);
};

const sumAlwaysActiveVitalityModifier = (items = []) => items.reduce((sum, item) => {
    if (!item || item.type !== "blessingCurse") return sum;
    if (!item.system?.alwaysActive) return sum;
    if (!targetMatchesVitality(item.system?.effectLine?.target)) return sum;
    return sum + parseSignedAmount(item.system?.effectLine?.amount);
  }, 0);

const collectAlwaysActiveVitalityModifier = (actor) => sumAlwaysActiveVitalityModifier(
  collectVitalityBlessingCurseEntries(actor).map((entry) => resolveBlessingCurseSync(entry?.uuid))
);

const applyVitalityState = (actor, granted) => {
  const system = actor?.system;
  if (!system || typeof system !== "object") return;

  const vitality = system?.vitality;
  if (!vitality || typeof vitality !== "object") return;

  const endurance = system?.characteristics?.body?.endurance;
  const enduranceTotal = Math.max(0, getStatTotal(endurance));
  const nextBase = Math.max(0, 5 + enduranceTotal);
  const previousBase = Math.max(0, toNumber(vitality.base, nextBase));
  const previousMax = Math.max(0, getStatTotal({
    base: previousBase,
    mod: vitality.mod,
    temp: vitality.temp,
    history: vitality.history,
    xp: vitality.xp,
    granted: vitality.granted
  }));

  vitality.base = nextBase;
  vitality.granted = toNumber(granted);
  vitality.total = Math.max(0, getStatTotal(vitality));
  vitality.max = vitality.total;
  vitality.roll = vitality.total;

  const currentValue = Number(vitality.value);
  const nextValue = Number.isFinite(currentValue)
    ? Math.max(0, Math.min(vitality.max, vitality.max - Math.max(0, previousMax - currentValue)))
    : vitality.max;

  vitality.value = nextValue;
};

const deriveVitality = (actor) => {
  applyVitalityState(actor, collectAlwaysActiveVitalityModifier(actor));
};

export const applyAsyncActorVitalityDerivedData = async (actor) => {
  const entries = collectVitalityBlessingCurseEntries(actor);
  const items = await Promise.all(entries.map(async (entry) => {
    const uuid = String(entry?.uuid ?? "").trim();
    if (!uuid) return null;
    return fromUuid(uuid).catch(() => null);
  }));

  applyVitalityState(actor, sumAlwaysActiveVitalityModifier(items));
};

export const aggregateActorDerivedData = (actor) => {
  aggregateActorCharacteristicEffects(actor);
  deriveVitality(actor);
  aggregateActorSkillEffects(actor);
};
