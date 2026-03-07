import { collectItemEffectTotals } from "./effects.mjs";
import { applyDerivedFields, isStatRecord } from "./shared.mjs";
import { SPIRIT_OPPOSITE, normalizeAlwaysPrimary } from "../spirit.mjs";
import {
  SPECIES_OCCULT_AFFINITY_KEYS,
  buildSpeciesSpiritBaseMap,
  readSpeciesOccultAffinities,
  readSpeciesOccultEnabled
} from "../species/data.mjs";

const CHARACTERISTIC_PATH_BY_KEY = {
  strength: "body.strength",
  dexterity: "body.dexterity",
  endurance: "body.endurance",
  wits: "mind.wits",
  perception: "mind.perception",
  tech: "mind.tech",
  extrovert: "spirit.extrovert",
  introvert: "spirit.introvert",
  passion: "spirit.passion",
  calm: "spirit.calm",
  faith: "spirit.faith",
  ego: "spirit.ego",
  psi: "occult.psi",
  theurgy: "occult.theurgy"
};

const toOptionalNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizePath = (value) => {
  const token = String(value ?? "").trim().toLowerCase();
  if (!token) return "";
  if (token.includes(".")) return token;
  return CHARACTERISTIC_PATH_BY_KEY[token] ?? "";
};

const addTotal = (totals, path, amount) => {
  const key = normalizePath(path);
  const value = Number(amount);
  if (!key || !Number.isFinite(value)) return;
  totals[key] = (totals[key] ?? 0) + value;
};

const collectHistoryCharacteristicTotals = (items) => {
  const totals = {};

  for (const item of items ?? []) {
    if (item?.type !== "history") continue;

    const schemaMap = item?.system?.effects?.characteristics ?? item?.system?.data?.effects?.characteristics;
    let usedSchema = false;
    if (schemaMap && typeof schemaMap === "object" && !Array.isArray(schemaMap)) {
      for (const [path, amount] of Object.entries(schemaMap)) {
        const key = normalizePath(path);
        const value = Number(amount);
        if (!key || !Number.isFinite(value)) continue;
        totals[key] = (totals[key] ?? 0) + value;
        usedSchema = true;
      }
    }
    if (usedSchema) continue;

    const adjustments = Array.isArray(item?.system?.characteristicsAdjustments)
      ? item.system.characteristicsAdjustments
      : [];

    for (const entry of adjustments) {
      const selectedKey = String(entry?.selectedKey ?? "").trim();
      if (selectedKey) {
        addTotal(totals, selectedKey, Number(entry?.selectedValue ?? entry?.value ?? 0));
        continue;
      }

      const choices = Array.isArray(entry?.choice) ? entry.choice : [];
      if (choices.length === 1) {
        addTotal(totals, choices[0]?.key, Number(choices[0]?.value ?? 0));
        continue;
      }
      if (choices.length >= 2) continue;

      addTotal(totals, entry?.key, entry?.value);
    }
  }

  return totals;
};

const readActiveHistoryItemIds = (actor) => {
  const raw = actor?.getFlag?.("fs2e", "historySlots");
  if (!Array.isArray(raw)) return new Set();
  const ids = raw
    .map((entry) => String(entry?.id ?? "").trim())
    .filter(Boolean);
  return new Set(ids);
};

const applySpeciesBaseMax = (characteristics, speciesItem) => {
  const speciesCharacteristics = speciesItem?.system?.characteristics;
  if (!speciesCharacteristics || typeof speciesCharacteristics !== "object") return;

  for (const [groupKey, groupValue] of Object.entries(characteristics)) {
    if (groupKey === "spirit" || groupKey === "occult") continue;
    if (!groupValue || typeof groupValue !== "object" || Array.isArray(groupValue)) continue;

    for (const [statKey, stat] of Object.entries(groupValue)) {
      if (!isStatRecord(stat)) continue;

      const speciesStat = speciesCharacteristics?.[groupKey]?.[statKey];
      if (!speciesStat || typeof speciesStat !== "object") continue;

      const nextBase = toOptionalNumber(speciesStat.base);
      const nextMax = toOptionalNumber(speciesStat.max);

      if (nextBase !== null) stat.base = nextBase;
      if (nextMax !== null) stat.max = nextMax;
    }
  }
};

const applySpeciesOccultBase = (characteristics, speciesItem) => {
  const occult = characteristics?.occult;
  if (!occult || typeof occult !== "object" || Array.isArray(occult)) return;

  for (const key of SPECIES_OCCULT_AFFINITY_KEYS) {
    const stat = occult?.[key];
    if (!isStatRecord(stat)) continue;
    stat.base = 0;
  }

  if (!readSpeciesOccultEnabled(speciesItem)) return;

  const [selected] = readSpeciesOccultAffinities(speciesItem);
  if (!selected) return;

  const stat = occult?.[selected];
  if (!isStatRecord(stat)) return;
  stat.base = 1;
};

const applySpeciesSpiritBaseMax = (characteristics, speciesItem) => {
  const spirit = characteristics?.spirit;
  if (!spirit || typeof spirit !== "object" || Array.isArray(spirit)) return;
  const baseMap = buildSpeciesSpiritBaseMap(speciesItem);

  for (const [key, opposite] of Object.entries(SPIRIT_OPPOSITE)) {
    const stat = spirit[key];
    if (!isStatRecord(stat)) continue;
    stat.base = baseMap[key];
    stat.max = 10 - baseMap[opposite];
  }
};

const applyHistorySpiritPrimaryBase = (characteristics, historyItems) => {
  const spirit = characteristics?.spirit;
  if (!spirit || typeof spirit !== "object" || Array.isArray(spirit)) return;

  for (const item of historyItems ?? []) {
    if (item?.type !== "history") continue;
    const alwaysPrimary = normalizeAlwaysPrimary(item?.system?.spiritAlwaysPrimary, { allowLabels: true });
    for (const selected of alwaysPrimary) {
      const opposite = SPIRIT_OPPOSITE[selected];
      if (!opposite) continue;

      const selectedStat = spirit[selected];
      const oppositeStat = spirit[opposite];
      if (isStatRecord(selectedStat)) selectedStat.base = 3;
      if (isStatRecord(oppositeStat)) oppositeStat.base = 1;
    }
  }
};

export const aggregateActorCharacteristicEffects = (actor) => {
  const characteristics = actor?.system?.characteristics;
  if (!characteristics || typeof characteristics !== "object") return;
  const activeHistoryItemIds = readActiveHistoryItemIds(actor);
  const filteredItems = (actor.items ?? []).filter((item) => {
    if (item?.type !== "history") return true;
    if (!activeHistoryItemIds.size) return false;
    return activeHistoryItemIds.has(String(item?.id ?? "").trim());
  });

  const speciesItem = (filteredItems ?? []).find((item) => item?.type === "species");
  if (speciesItem) {
    applySpeciesBaseMax(characteristics, speciesItem);
    applySpeciesSpiritBaseMax(characteristics, speciesItem);
    applySpeciesOccultBase(characteristics, speciesItem);
  }

  const activeHistoryItems = (filteredItems ?? []).filter((item) => item?.type === "history");
  applyHistorySpiritPrimaryBase(characteristics, activeHistoryItems);

  const grantedTotals = collectItemEffectTotals(filteredItems, "characteristics", {
    filter: (item) => item?.type !== "history"
  });
  const historyTotals = collectHistoryCharacteristicTotals(filteredItems);

  for (const [groupKey, groupValue] of Object.entries(characteristics)) {
    if (!groupValue || typeof groupValue !== "object" || Array.isArray(groupValue)) continue;

    for (const [statKey, stat] of Object.entries(groupValue)) {
      if (!isStatRecord(stat)) continue;

      const path = `${groupKey}.${statKey}`;
      const granted = grantedTotals[path] ?? 0;
      stat.history = Number.isFinite(Number(historyTotals[path])) ? Number(historyTotals[path]) : 0;
      applyDerivedFields(stat, granted);
    }
  }
};
