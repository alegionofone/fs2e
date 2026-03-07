import { SPIRIT_OPPOSITE } from "../spirit.mjs";
import {
  SPECIES_OCCULT_AFFINITY_KEYS,
  buildSpeciesSpiritBaseMap,
  readSpeciesCharacteristics,
  readSpeciesOccultAffinities,
  readSpeciesOccultEnabled
} from "../species/data.mjs";

const toOptionalNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const ADOPTION_FLAG_SCOPE = "fs2e";
const ADOPTION_FLAG_KEY = "adoptionSnapshots";

const buildSpeciesSpiritAdoptionUpdate = (actor, item) => {
  const update = {};
  const spirit = actor?.system?.characteristics?.spirit;
  if (!spirit || typeof spirit !== "object") return update;

  const baseMap = buildSpeciesSpiritBaseMap(item);

  for (const [key, opposite] of Object.entries(SPIRIT_OPPOSITE)) {
    update[`system.characteristics.spirit.${key}.base`] = baseMap[key];
    update[`system.characteristics.spirit.${key}.max`] = 10 - baseMap[opposite];
  }

  return update;
};

const buildSpeciesOccultAdoptionUpdate = (actor, item) => {
  const update = {};
  const occult = actor?.system?.characteristics?.occult;
  if (!occult || typeof occult !== "object") return update;

  for (const key of SPECIES_OCCULT_AFFINITY_KEYS) {
    const stat = occult?.[key];
    if (!stat || typeof stat !== "object") continue;
    update[`system.characteristics.occult.${key}.base`] = 0;
  }

  if (!readSpeciesOccultEnabled(item)) return update;

  const [selected] = readSpeciesOccultAffinities(item);
  if (!selected) return update;

  const selectedStat = occult?.[selected];
  if (!selectedStat || typeof selectedStat !== "object") return update;

  update[`system.characteristics.occult.${selected}.base`] = 1;
  return update;
};

const buildCharacteristicBaseMaxUpdate = (actor, sourceCharacteristics) => {
  const update = {};
  const actorCharacteristics = actor?.system?.characteristics;
  if (!actorCharacteristics || typeof actorCharacteristics !== "object") return update;

  for (const [groupKey, groupValue] of Object.entries(actorCharacteristics)) {
    if (groupKey === "spirit" || groupKey === "occult") continue;
    if (!groupValue || typeof groupValue !== "object" || Array.isArray(groupValue)) continue;

    for (const [statKey, statValue] of Object.entries(groupValue)) {
      if (!statValue || typeof statValue !== "object" || Array.isArray(statValue)) continue;

      const source = sourceCharacteristics?.[groupKey]?.[statKey];
      if (!source || typeof source !== "object") continue;

      const nextBase = toOptionalNumber(source.base);
      const nextMax = toOptionalNumber(source.max);

      if (nextBase !== null) update[`system.characteristics.${groupKey}.${statKey}.base`] = nextBase;
      if (nextMax !== null) update[`system.characteristics.${groupKey}.${statKey}.max`] = nextMax;
    }
  }

  return update;
};

const speciesAdoptionUpdate = (actor, item) => {
  const sourceCharacteristics = readSpeciesCharacteristics(item);
  const adopted = buildCharacteristicBaseMaxUpdate(actor, sourceCharacteristics);
  const spirit = buildSpeciesSpiritAdoptionUpdate(actor, item);
  const occult = buildSpeciesOccultAdoptionUpdate(actor, item);

  return {
    ...adopted,
    ...spirit,
    ...occult
  };
};

const ITEM_ADOPTERS = {
  species: speciesAdoptionUpdate
};

export const buildItemAdoptionUpdate = (actor, item) => {
  const adopter = ITEM_ADOPTERS[item?.type];
  if (!adopter) return {};
  return adopter(actor, item);
};

const getSnapshots = (actor) => {
  const snapshots = actor?.getFlag?.(ADOPTION_FLAG_SCOPE, ADOPTION_FLAG_KEY);
  return snapshots && typeof snapshots === "object" ? foundry.utils.deepClone(snapshots) : {};
};

const setSnapshots = async (actor, snapshots) => {
  if (!actor?.setFlag || !actor?.unsetFlag) return;
  if (!snapshots || !Object.keys(snapshots).length) {
    await actor.unsetFlag(ADOPTION_FLAG_SCOPE, ADOPTION_FLAG_KEY);
    return;
  }

  await actor.setFlag(ADOPTION_FLAG_SCOPE, ADOPTION_FLAG_KEY, snapshots);
};

const capturePreAdoptionSnapshot = (actor, item, update, snapshots) => {
  const itemId = String(item?.id ?? "").trim();
  if (!itemId) return snapshots;

  const itemSnapshots = snapshots[itemId] && typeof snapshots[itemId] === "object"
    ? snapshots[itemId]
    : {};

  for (const path of Object.keys(update)) {
    if (Object.prototype.hasOwnProperty.call(itemSnapshots, path)) continue;

    // Read from source data so we snapshot true persisted values, not prepared/derived values.
    // This prevents species spirit defaults (3/1) from being captured after the item is created.
    const sourceValue = foundry.utils.getProperty(actor?._source, path);
    itemSnapshots[path] = sourceValue !== undefined
      ? foundry.utils.deepClone(sourceValue)
      : foundry.utils.getProperty(actor, path);
  }

  snapshots[itemId] = itemSnapshots;
  return snapshots;
};

const buildUnadoptionUpdate = (itemSnapshots) => {
  const update = {};
  if (!itemSnapshots || typeof itemSnapshots !== "object") return update;

  for (const [path, value] of Object.entries(itemSnapshots)) {
    update[path] = value;
  }

  return update;
};

export const adoptItemToActor = async (actor, item) => {
  if (!actor || !item) return;

  const update = buildItemAdoptionUpdate(actor, item);
  if (!Object.keys(update).length) return;

  const snapshots = capturePreAdoptionSnapshot(actor, item, update, getSnapshots(actor));
  await setSnapshots(actor, snapshots);

  await actor.update(update);
};

export const unadoptItemFromActor = async (actor, item) => {
  if (!actor || !item) return;

  const itemId = String(item?.id ?? "").trim();
  if (!itemId) return;

  const snapshots = getSnapshots(actor);
  const itemSnapshots = snapshots[itemId];
  if (!itemSnapshots || typeof itemSnapshots !== "object") return;

  const update = buildUnadoptionUpdate(itemSnapshots);
  if (Object.keys(update).length) {
    await actor.update(update);
  }

  delete snapshots[itemId];
  await setSnapshots(actor, snapshots);
};
