import { SKILL_DEFINITIONS_BY_KEY } from "../global/skills/definitions.mjs";
import { formatSkillLabel } from "../global/skills/group-specializations.mjs";
import { computeTraitTotal, getStatTotal, isStatRecord, toNumber } from "../global/derived/shared.mjs";

export const DIFFICULTY_OPTIONS = [
  { label: "None (0)", value: 0 },
  { label: "Natural (+2)", value: 2 },
  { label: "Easy (+4)", value: 4 },
  { label: "Piece of Cake (+6)", value: 6 },
  { label: "Child's Play (+8)", value: 8 },
  { label: "Effortless (+10)", value: 10 },
  { label: "Hard (-2)", value: -2 },
  { label: "Demanding (-4)", value: -4 },
  { label: "Tough (-6)", value: -6 },
  { label: "Severe (-8)", value: -8 },
  { label: "Herculean (-10)", value: -10 }
];

const CHARACTERISTIC_LABELS = {
  strength: "Strength",
  dexterity: "Dexterity",
  endurance: "Endurance",
  wits: "Wits",
  perception: "Perception",
  tech: "Tech",
  extrovert: "Extrovert",
  introvert: "Introvert",
  passion: "Passion",
  calm: "Calm",
  faith: "Faith",
  ego: "Ego",
  introversion: "Introversion",
  extroversion: "Extroversion",
  theurgy: "Theurgy",
  urthish: "Urthish",
  psychic: "Psychic"
};

export const formatCharacteristicLabel = (key) => {
  const token = String(key ?? "").trim();
  if (!token) return "";
  if (CHARACTERISTIC_LABELS[token]) return CHARACTERISTIC_LABELS[token];

  return token
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
};

export const getSkillDefinitionForKey = (skillKey) => {
  const token = String(skillKey ?? "").trim();
  if (!token) return {};
  if (SKILL_DEFINITIONS_BY_KEY[token]) return SKILL_DEFINITIONS_BY_KEY[token];
  const tail = token.includes(".") ? token.split(".").pop() : token;
  return SKILL_DEFINITIONS_BY_KEY[tail] ?? {};
};

export const getWoundPenalty = (actor) => {
  const vitality = actor?.system?.vitality;
  const base = Math.max(0, toNumber(vitality?.base));
  const value = Math.max(0, toNumber(vitality?.value, base));
  return -2 * Math.max(0, base - value);
};

export const getCharacteristicOptions = (actor, preferred = "") => {
  const root = actor?.system?.characteristics;
  if (!root || typeof root !== "object") return [];

  const out = [];
  for (const group of Object.values(root)) {
    if (!group || typeof group !== "object" || Array.isArray(group)) continue;
    for (const [key, stat] of Object.entries(group)) {
      if (!isStatRecord(stat)) continue;
      out.push({ key, label: formatCharacteristicLabel(key), total: getStatTotal(stat), selectedMain: false, selectedComp: false });
    }
  }

  out.sort((a, b) => a.label.localeCompare(b.label));
  if (out.length) {
    const selectedKey = out.some((entry) => entry.key === preferred) ? preferred : out[0].key;
    for (const entry of out) {
      entry.selectedMain = entry.key === selectedKey;
      entry.selectedComp = entry.key === selectedKey;
    }
  }
  return out;
};

export const getSkillOptions = (actor, selectedSkillKey = "") => {
  const options = [];
  const natural = actor?.system?.skills?.natural;
  const learned = actor?.system?.skills?.learned;

  if (natural && typeof natural === "object") {
    for (const [key, stat] of Object.entries(natural)) {
      if (!isStatRecord(stat)) continue;
      const def = SKILL_DEFINITIONS_BY_KEY[key] ?? {};
      options.push({
        key,
        label: def.label ?? key,
        total: getStatTotal(stat),
        trait: computeTraitTotal(stat),
        complementary: def.complementary ?? "",
        defaultCharacteristic: def.defaultCharacteristic ?? "",
        selected: false
      });
    }
  }

  if (learned && typeof learned === "object") {
    for (const [key, value] of Object.entries(learned)) {
      if (isStatRecord(value)) {
        const def = getSkillDefinitionForKey(key);
        options.push({
          key,
          label: def.label ?? formatSkillLabel(key),
          total: getStatTotal(value),
          trait: computeTraitTotal(value),
          complementary: def.complementary ?? "",
          defaultCharacteristic: def.defaultCharacteristic ?? "",
          selected: false
        });
        continue;
      }

      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const parentDef = getSkillDefinitionForKey(key);
      for (const [childKey, childValue] of Object.entries(value)) {
        if (!isStatRecord(childValue)) continue;
        const optionKey = `${key}.${childKey}`;
        const explicitDisplay = String(childValue?.display ?? "").trim();
        options.push({
          key: optionKey,
          label: explicitDisplay || `${formatSkillLabel(key)}: ${formatSkillLabel(childKey)}`,
          total: getStatTotal(childValue),
          trait: computeTraitTotal(childValue),
          complementary: parentDef.complementary ?? "",
          defaultCharacteristic: parentDef.defaultCharacteristic ?? "",
          selected: false
        });
      }
    }
  }

  options.sort((a, b) => a.label.localeCompare(b.label));
  if (options.length) {
    const selected = options.some((entry) => entry.key === selectedSkillKey)
      ? selectedSkillKey
      : options[0].key;
    for (const entry of options) {
      entry.selected = entry.key === selected;
    }
  }

  return options;
};

export const getSkillTotalByKey = (actor, skillKey) => {
  const token = String(skillKey ?? "").trim();
  if (!token) return 0;
  const skill = getSkillOptions(actor, token).find((entry) => entry.key === token);
  return skill ? toNumber(skill.total) : 0;
};

export const getSkillTraitByKey = (actor, skillKey) => {
  const token = String(skillKey ?? "").trim();
  if (!token) return 0;
  const skill = getSkillOptions(actor, token).find((entry) => entry.key === token);
  return skill ? toNumber(skill.trait) : 0;
};

export const getCharacteristicTotalByKey = (actor, characteristicKey) => {
  const token = String(characteristicKey ?? "").trim();
  if (!token) return 0;
  const characteristic = getCharacteristicOptions(actor, token).find((entry) => entry.key === token);
  return characteristic ? toNumber(characteristic.total) : 0;
};
