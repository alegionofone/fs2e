import { buildSpiritSelectionByPair, normalizeAlwaysPrimary } from "../spirit.mjs";

export const SPECIES_OCCULT_AFFINITY_KEYS = ["psi", "theurgy"];

const toOptionalNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const readSystem = (source) => {
  if (source?.system && typeof source.system === "object") return source.system;
  return source && typeof source === "object" ? source : {};
};

export const readSpeciesCharacteristics = (source) => {
  const system = readSystem(source);
  const primary = system?.characteristics;
  const nested = system?.species?.characteristics;
  const legacyData = system?.data?.characteristics;
  const legacyNested = system?.system?.characteristics;

  if (primary && typeof primary === "object") return primary;
  if (nested && typeof nested === "object") return nested;
  if (legacyData && typeof legacyData === "object") return legacyData;
  if (legacyNested && typeof legacyNested === "object") return legacyNested;
  return {};
};

export const readSpeciesAlwaysPrimary = (source, options = {}) => {
  const { allowLabels = false } = options;
  const system = readSystem(source);

  const primary = system?.spiritAlwaysPrimary;
  const nested = system?.species?.spiritAlwaysPrimary;
  const legacy = system?.characteristics?.spiritAlwaysPrimary;

  const selected = Array.isArray(primary) && primary.length
    ? primary
    : (Array.isArray(nested) && nested.length ? nested : legacy);

  return normalizeAlwaysPrimary(selected, { allowLabels });
};

export const readSpeciesOccultAffinities = (source, options = {}) => {
  const { max = Number.POSITIVE_INFINITY } = options;
  const system = readSystem(source);

  const primary = system?.occultAffinities;
  const nested = system?.species?.occultAffinities;
  const raw = Array.isArray(primary)
    ? primary
    : (Array.isArray(nested) ? nested : []);

  const normalized = raw
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter((value) => SPECIES_OCCULT_AFFINITY_KEYS.includes(value));

  const unique = normalized.length
    ? [...new Set(normalized)]
    : (() => {
      // Compatibility fallback for legacy species records that still store occult as characteristics.
      const legacyOccult = system?.characteristics?.occult;
      if (!legacyOccult || typeof legacyOccult !== "object") return [];

      return SPECIES_OCCULT_AFFINITY_KEYS.filter((key) => {
        const base = toOptionalNumber(legacyOccult?.[key]?.base);
        return base !== null && base > 0;
      });
    })();

  if (!Number.isFinite(max)) return unique;
  return unique.slice(0, Math.max(0, max));
};

export const readSpeciesOccultEnabled = (source) => {
  const system = readSystem(source);
  const primary = system?.occultEnabled;
  const nested = system?.species?.occultEnabled;
  if (typeof primary === "boolean") return primary;
  if (typeof nested === "boolean") return nested;
  return readSpeciesOccultAffinities(source).length > 0;
};

export const buildSpeciesSpiritBaseMap = (source) => {
  const alwaysPrimary = readSpeciesAlwaysPrimary(source);
  const selected = buildSpiritSelectionByPair(alwaysPrimary);

  return {
    extrovert: selected.extrovertIntrovert === "extrovert" ? 3 : 1,
    introvert: selected.extrovertIntrovert === "introvert" ? 3 : 1,
    passion: selected.passionCalm === "passion" ? 3 : 1,
    calm: selected.passionCalm === "calm" ? 3 : 1,
    faith: selected.faithEgo === "faith" ? 3 : 1,
    ego: selected.faithEgo === "ego" ? 3 : 1
  };
};