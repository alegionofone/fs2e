import { aggregateActorCharacteristicEffects } from "./characteristics.mjs";
import { aggregateActorSkillEffects } from "./skills.mjs";

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const statTotal = (stat) => {
  if (!stat || typeof stat !== "object") return 0;

  const explicit = Number(stat.total);
  if (Number.isFinite(explicit)) return explicit;

  return ["base", "mod", "temp", "history", "xp", "granted"]
    .map((key) => toNumber(stat[key]))
    .reduce((acc, value) => acc + value, 0);
};

const deriveVitality = (actor) => {
  const system = actor?.system;
  if (!system || typeof system !== "object") return;

  const vitality = system?.vitality;
  if (!vitality || typeof vitality !== "object") return;

  const endurance = system?.characteristics?.body?.endurance;
  const enduranceTotal = Math.max(0, statTotal(endurance));
  const nextBase = Math.max(0, 5 + enduranceTotal);

  const previousBase = Math.max(0, toNumber(vitality.base, nextBase));
  const vitalityMod = toNumber(vitality.mod);
  const previousMax = Math.max(0, previousBase + vitalityMod);
  const nextMax = Math.max(0, nextBase + vitalityMod);

  const currentValue = Number(vitality.value);
  const nextValue = Number.isFinite(currentValue)
    ? Math.max(0, Math.min(nextMax, nextMax - Math.max(0, previousMax - currentValue)))
    : nextMax;

  vitality.base = nextBase;
  vitality.value = nextValue;
};

export const aggregateActorDerivedData = (actor) => {
  aggregateActorCharacteristicEffects(actor);
  deriveVitality(actor);
  aggregateActorSkillEffects(actor);
};
