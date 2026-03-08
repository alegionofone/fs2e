import { CHARACTERISTIC_DEFINITIONS_BY_KEY } from "../../global/characteristics/definitions.mjs";
import { LEARNED_SKILLS_BANK, NATURAL_SKILLS_BANK, SKILL_DEFINITIONS_BY_KEY } from "../../global/skills/definitions.mjs";
import {
  LEARNED_GROUP_OPTION_LABELS,
  LEARNED_SKILL_GROUP_KEYS,
  formatSkillLabel,
  normalizeSkillKey
} from "../../global/skills/group-specializations.mjs";

const CHARACTERISTICS_BANK = [
  {
    key: "body",
    label: "Body",
    panelClass: "body",
    gridClass: "fs2e-grid-chars-body",
    stats: [
      { key: "strength", label: "Strength" },
      { key: "dexterity", label: "Dexterity" },
      { key: "endurance", label: "Endurance" }
    ]
  },
  {
    key: "mind",
    label: "Mind",
    panelClass: "mind",
    gridClass: "fs2e-grid-chars-mind",
    stats: [
      { key: "wits", label: "Wits" },
      { key: "perception", label: "Perception" },
      { key: "tech", label: "Tech" }
    ]
  },
  {
    key: "spirit",
    label: "Spirit",
    panelClass: "col-span-2 spirit",
    isSpirit: true,
    pairs: [
      { leftKey: "extrovert", leftLabel: "Extrovert", rightKey: "introvert", rightLabel: "Introvert" },
      { leftKey: "passion", leftLabel: "Passion", rightKey: "calm", rightLabel: "Calm" },
      { leftKey: "faith", leftLabel: "Faith", rightKey: "ego", rightLabel: "Ego" }
    ]
  }
];

const SKILL_VALUE_KEYS = ["base", "mod", "temp", "max", "history", "xp", "roll", "granted", "total"];
export const HISTORY_SLOT_LABELS = ["Upbringing", "Apprenticeship", "Early Career", "Tour of Duty", "Tour of Duty"];
const RESOURCE_TRACK_LENGTH = 20;
const WOUND_PENALTY_VALUES = [-10, -8, -6, -4, -2];

const canonicalToken = (value) => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "");

export const normalizeStringList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
      }
    } catch {
      // Fall back to comma-separated parsing.
    }
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
};

export const uniqueCaseInsensitive = (list = []) => {
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const text = String(entry ?? "").trim();
    if (!text) continue;
    const token = text.toLowerCase();
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(text);
  }
  return out;
};

export const readActorLanguageList = (system, key) => uniqueCaseInsensitive([
  ...normalizeStringList(foundry.utils.getProperty(system, `languages.total.${key}`)),
  ...normalizeStringList(foundry.utils.getProperty(system, `languages.manual.${key}`)),
  ...normalizeStringList(foundry.utils.getProperty(system, `languages.granted.${key}`)),
  ...normalizeStringList(foundry.utils.getProperty(system, `languages.${key}`)),
  ...normalizeStringList(foundry.utils.getProperty(system, `data.languages.${key}`))
]);

export const extractLearnedChildSkillPairsFromSystem = (system = {}) => {
  const pairs = [];
  const learned = foundry.utils.getProperty(system, "skills.learned") ?? foundry.utils.getProperty(system, "data.skills.learned");
  if (!learned || typeof learned !== "object") return pairs;

  for (const [groupKey, groupValue] of Object.entries(learned)) {
    if (!groupValue || typeof groupValue !== "object" || Array.isArray(groupValue)) continue;
    for (const [childKey, childValue] of Object.entries(groupValue)) {
      if (!childValue || typeof childValue !== "object" || Array.isArray(childValue)) continue;
      const display = String(childValue?.display ?? "").trim();
      if (!display) continue;
      const amount = Number(childValue?.history ?? childValue?.base ?? 0);
      pairs.push({
        groupKey,
        childKey: normalizeSkillKey(childKey),
        display,
        amount: Number.isFinite(amount) ? amount : 0
      });
    }
  }

  return pairs;
};

export const extractLearnedChildSkillDisplayMapFromSystem = (system = {}) => {
  const map = new Map();
  const pairs = extractLearnedChildSkillPairsFromSystem(system);
  for (const pair of pairs) {
    const groupKey = String(pair?.groupKey ?? "").trim().toLowerCase();
    const childKey = String(pair?.childKey ?? "").trim().toLowerCase();
    const display = String(pair?.display ?? "").trim();
    if (!groupKey || !childKey || !display) continue;
    map.set(`${groupKey}.${childKey}`, display);
  }
  return map;
};

export const normalizeLearnedSkillPairs = (list = []) => {
  const out = [];
  const seen = new Set();

  for (const entry of Array.isArray(list) ? list : []) {
    const groupKey = normalizeSkillKey(entry?.groupKey);
    const childKey = normalizeSkillKey(entry?.childKey);
    const display = String(entry?.display ?? "").trim();
    const amount = Number(entry?.amount ?? 0);
    if (!groupKey || !childKey) continue;

    const dedupeKey = `${canonicalToken(groupKey)}::${canonicalToken(childKey)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    out.push({
      groupKey,
      childKey,
      display: display || formatSkillLabel(childKey),
      amount: Number.isFinite(amount) ? amount : 0
    });
  }

  return out;
};

export const getHistorySlotDefinitions = () => {
  const mapped = normalizeStringList(CONFIG?.fs2e?.mappingData?.tags?.item?.history);

  return HISTORY_SLOT_LABELS.map((label, index) => {
    const mappedTag = String(mapped[index] ?? label).trim();
    const acceptedTags = uniqueCaseInsensitive([label, mappedTag].filter(Boolean));
    return {
      index,
      label,
      mappedTag,
      acceptedTags: uniqueCaseInsensitive(acceptedTags),
      tokenSet: new Set(acceptedTags.map((entry) => canonicalToken(entry)))
    };
  });
};

export const readItemTags = (item) => {
  const rawTags = item?.system?.tags ?? item?.system?.data?.tags ?? item?.tags ?? [];
  return uniqueCaseInsensitive(normalizeStringList(rawTags));
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;");

const toTooltipStatBreakdown = (stat) => {
  if (!stat || typeof stat !== "object" || Array.isArray(stat)) return "";
  const base = Number(stat?.base ?? 0);
  const history = Number(stat?.history ?? 0);
  const xp = Number(stat?.xp ?? 0);
  const mod = Number(stat?.mod ?? 0);
  const temp = Number(stat?.temp ?? 0);
  const trait = (Number.isFinite(base) ? base : 0)
    + (Number.isFinite(history) ? history : 0)
    + (Number.isFinite(xp) ? xp : 0);
  const modValue = Number.isFinite(mod) ? mod : 0;
  const tempValue = Number.isFinite(temp) ? temp : 0;
  return `Trait: ${trait}<br />Mod: ${modValue}<br />Temp: ${tempValue}`;
};

const buildSkillTextTooltipHtml = ({ desc, complementary }) => {
  const description = String(desc ?? "").trim();
  const comp = String(complementary ?? "").trim();
  if (!description && !comp) return "";

  const parts = [];
  if (description) {
    const normalizedDescription = description
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{2,}/g, "\n\n");
    parts.push(`<div class=\"fs2e-tooltip-desc\">${escapeHtml(normalizedDescription).replaceAll("\n", "<br />")}</div>`);
  }

  if (comp) {
    parts.push(
      `<div class=\"fs2e-tooltip-comp\"><span class=\"fs2e-tooltip-comp-label\">Complimentary Skills:</span> ${escapeHtml(comp)}</div>`
    );
  }

  return parts.join("");
};

const buildCharacteristicTextTooltipHtml = (key) => {
  const desc = CHARACTERISTIC_DEFINITIONS_BY_KEY[key]?.desc ?? "";
  return buildSkillTextTooltipHtml({ desc, complementary: "" });
};

const hasSkillScore = (entry) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  return SKILL_VALUE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(entry, key));
};

export const isLearnedGroupContainer = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return !hasSkillScore(value);
};

const isDisplayMetaKey = (key) => String(key ?? "").startsWith("__");

const buildLearnedGroupOptionLabels = (groupKey, groupValue = {}) => {
  const base = Array.isArray(LEARNED_GROUP_OPTION_LABELS[groupKey]) ? LEARNED_GROUP_OPTION_LABELS[groupKey] : [];
  const childLabels = Object.entries(groupValue)
    .filter(([key, value]) => !isDisplayMetaKey(key) && value && typeof value === "object" && !Array.isArray(value))
    .map(([childKey, childValue]) => String(childValue?.display ?? formatSkillLabel(childKey)).trim())
    .filter(Boolean);

  return uniqueCaseInsensitive([...base, ...childLabels]).sort((a, b) => a.localeCompare(b));
};

const getStatTotal = (root, path) => {
  const stat = foundry.utils.getProperty(root, path);
  const base = Number(stat?.base ?? 0);
  const mod = Number(stat?.mod ?? 0);
  const temp = Number(stat?.temp ?? 0);
  const history = Number(stat?.history ?? 0);
  const xp = Number(stat?.xp ?? 0);
  const granted = Number(stat?.granted ?? 0);

  const parts = [base, mod, temp, history, xp, granted];
  const hasComponent = parts.some((value) => Number.isFinite(value));
  if (hasComponent) {
    const sum = parts.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);
    return Number.isFinite(sum) ? sum : 0;
  }

  const explicitTotal = Number(stat?.total);
  if (Number.isFinite(explicitTotal)) return explicitTotal;

  return 0;
};

const clampToTrack = (value, length = RESOURCE_TRACK_LENGTH) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(length, Math.floor(num)));
};

const buildTrackDots = (filled, length = RESOURCE_TRACK_LENGTH) => {
  const activeCount = clampToTrack(filled, length);
  return Array.from({ length }, (_, index) => ({
    index,
    isFilled: index < activeCount,
    isInactive: index >= activeCount
  }));
};

const buildPenaltyCells = (labels = [], length = RESOURCE_TRACK_LENGTH) => {
  return Array.from({ length }, (_, index) => ({
    index,
    gridColumn: index + 1,
    label: String(labels[index] ?? "").trim(),
    hasLabel: index < labels.length
  }));
};

const buildResourceView = (system) => {
  const vitalityBase = Math.max(0, Number(system?.vitality?.base ?? 0));
  const vitalityValueRaw = Number(system?.vitality?.value ?? vitalityBase);
  const vitalityValue = Number.isFinite(vitalityValueRaw)
    ? Math.max(0, Math.min(vitalityBase, vitalityValueRaw))
    : vitalityBase;
  const wyrdValue = Math.max(0, Number(system?.wyrd?.value ?? 0));
  return {
    vitalityDots: buildTrackDots(vitalityValue),
    wyrdDots: buildTrackDots(wyrdValue),
    woundPenaltyCells: buildPenaltyCells(WOUND_PENALTY_VALUES, RESOURCE_TRACK_LENGTH)
  };
};

const toSkillViewEntry = ({ system, key, label, scored, totalPath }) => {
  const definition = SKILL_DEFINITIONS_BY_KEY[key] ?? {};
  const stat = foundry.utils.getProperty(system, totalPath) ?? {};
  const desc = String(definition?.desc ?? "").trim();
  const complementary = String(definition?.complementary ?? "").trim();

  return {
    key,
    label,
    scored,
    total: getStatTotal(system, totalPath),
    tooltipDesc: buildSkillTextTooltipHtml({ desc, complementary }),
    tooltipStats: toTooltipStatBreakdown(stat),
    defaultCharacteristic: definition?.defaultCharacteristic ?? "",
    desc,
    complementary
  };
};

const buildCharacteristicsView = (system) => ({
  sections: CHARACTERISTICS_BANK.map((section) => {
    if (!section.isSpirit) {
      return {
        key: section.key,
        label: section.label,
        panelClass: section.panelClass,
        gridClass: section.gridClass,
        isSpirit: false,
        stats: section.stats.map((entry) => {
          const path = `characteristics.${section.key}.${entry.key}`;
          const stat = foundry.utils.getProperty(system, path);
          return {
            key: entry.key,
            label: entry.label,
            tooltipDesc: buildCharacteristicTextTooltipHtml(entry.key),
            tooltipStats: toTooltipStatBreakdown(stat),
            total: getStatTotal(system, path)
          };
        })
      };
    }

    return {
      key: section.key,
      label: section.label,
      panelClass: section.panelClass,
      isSpirit: true,
      pairs: section.pairs.map((entry) => {
        const leftPath = `characteristics.spirit.${entry.leftKey}`;
        const rightPath = `characteristics.spirit.${entry.rightKey}`;
        return {
          leftKey: entry.leftKey,
          leftLabel: entry.leftLabel,
          leftTooltipDesc: buildCharacteristicTextTooltipHtml(entry.leftKey),
          leftTooltipStats: toTooltipStatBreakdown(foundry.utils.getProperty(system, leftPath)),
          leftTotal: getStatTotal(system, leftPath),
          rightKey: entry.rightKey,
          rightLabel: entry.rightLabel,
          rightTooltipDesc: buildCharacteristicTextTooltipHtml(entry.rightKey),
          rightTooltipStats: toTooltipStatBreakdown(foundry.utils.getProperty(system, rightPath)),
          rightTotal: getStatTotal(system, rightPath)
        };
      })
    };
  })
});

const buildSkillsView = ({ system, actor }) => {
  const referencedLearnedChildTokens = new Set();
  for (const item of actor?.items ?? []) {
    if (item?.type !== "history") continue;
    const flaggedPairs = normalizeLearnedSkillPairs(item.getFlag?.("fs2e", "grantedLearnedSkills"));
    const pairs = flaggedPairs.length ? flaggedPairs : extractLearnedChildSkillPairsFromSystem(item.system ?? {});
    for (const pair of pairs) {
      referencedLearnedChildTokens.add(`${pair.groupKey.toLowerCase()}.${pair.childKey.toLowerCase()}`);
    }
  }

  const shouldShowLearnedChild = (groupKey, childKey) => {
    const token = `${String(groupKey ?? "").trim().toLowerCase()}.${String(childKey ?? "").trim().toLowerCase()}`;
    if (referencedLearnedChildTokens.has(token)) return true;
    const total = Number(getStatTotal(system, `skills.learned.${groupKey}.${childKey}`));
    return Number.isFinite(total) && total !== 0;
  };

  return {
    natural: NATURAL_SKILLS_BANK.map((entry) => toSkillViewEntry({
      system,
      key: entry.key,
      label: entry.label,
      scored: true,
      totalPath: `skills.natural.${entry.key}`
    })),
    learned: (() => {
      const learned = system?.skills?.learned ?? {};
      const keyMap = new Map(Object.entries(learned));
      const bankKeys = new Set(LEARNED_SKILLS_BANK.map((entry) => entry.key));

      const fromBank = LEARNED_SKILLS_BANK
        .filter((entry) => keyMap.has(entry.key))
        .map((entry) => {
          const value = keyMap.get(entry.key);
          if (LEARNED_SKILL_GROUP_KEYS.has(entry.key) || isLearnedGroupContainer(value)) {
            const groupValue = isLearnedGroupContainer(value) ? value : {};
            const items = Object.entries(groupValue)
              .filter(([key, child]) => !isDisplayMetaKey(key) && hasSkillScore(child) && shouldShowLearnedChild(entry.key, key))
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([childKey, childValue]) => {
                const explicitLabel = String(childValue?.display ?? "").trim();
                const childLabel = explicitLabel || formatSkillLabel(childKey);
                const path = `skills.learned.${entry.key}.${childKey}`;
                return {
                  key: `${entry.key}.${childKey}`,
                  childKey,
                  label: childLabel,
                  desc: entry.desc ?? "",
                  complementary: entry.complementary ?? "",
                  tooltipDesc: buildSkillTextTooltipHtml({
                    desc: entry.desc ?? "",
                    complementary: entry.complementary ?? ""
                  }),
                  tooltipStats: toTooltipStatBreakdown(foundry.utils.getProperty(system, path)),
                  defaultCharacteristic: entry.defaultCharacteristic ?? "",
                  scored: true,
                  total: getStatTotal(system, path)
                };
              });

            return {
              key: entry.key,
              label: entry.label,
              desc: entry.desc ?? "",
              complementary: entry.complementary ?? "",
              tooltipDesc: buildSkillTextTooltipHtml({ desc: entry.desc ?? "", complementary: entry.complementary ?? "" }),
              tooltipStats: "",
              defaultCharacteristic: entry.defaultCharacteristic ?? "",
              scored: false,
              isGroup: true,
              childOptions: buildLearnedGroupOptionLabels(entry.key, groupValue),
              items
            };
          }

          const scored = hasSkillScore(value);
          return toSkillViewEntry({
            system,
            key: entry.key,
            label: entry.label,
            scored,
            totalPath: `skills.learned.${entry.key}`
          });
        });

      const extras = [...keyMap.entries()]
        .filter(([key]) => !bankKeys.has(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => {
          if (isLearnedGroupContainer(value)) {
            const items = Object.entries(value)
              .filter(([childKey, childValue]) => !isDisplayMetaKey(childKey) && hasSkillScore(childValue) && shouldShowLearnedChild(key, childKey))
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([childKey, childValue]) => {
                const explicitLabel = String(childValue?.display ?? "").trim();
                const childLabel = explicitLabel || formatSkillLabel(childKey);
                const path = `skills.learned.${key}.${childKey}`;
                return {
                  key: `${key}.${childKey}`,
                  childKey,
                  label: childLabel,
                  desc: "",
                  complementary: "",
                  tooltipDesc: "",
                  tooltipStats: toTooltipStatBreakdown(foundry.utils.getProperty(system, path)),
                  defaultCharacteristic: "",
                  scored: true,
                  total: getStatTotal(system, path)
                };
              });
            return {
              key,
              label: formatSkillLabel(key),
              desc: "",
              complementary: "",
              tooltipDesc: "",
              tooltipStats: "",
              defaultCharacteristic: "",
              scored: false,
              isGroup: true,
              childOptions: buildLearnedGroupOptionLabels(key, value),
              items
            };
          }

          const scored = hasSkillScore(value);
          return toSkillViewEntry({
            system,
            key,
            label: formatSkillLabel(key),
            scored,
            totalPath: `skills.learned.${key}`
          });
        });

      return [...fromBank, ...extras];
    })()
  };
};

export const buildCharacterSheetData = ({ actor, system, historySlots, sheetLock }) => {
  const speciesItem = (actor.items ?? []).find((item) => item?.type === "species") ?? null;
  const planetItem = (actor.items ?? []).find((item) => item?.type === "planet") ?? null;
  const factionItem = (actor.items ?? []).find((item) => item?.type === "faction") ?? null;
  const languageSpeak = readActorLanguageList(system, "speak");
  const languageRead = readActorLanguageList(system, "read");

  return {
    species: speciesItem
      ? { id: speciesItem.id, name: speciesItem.name, uuid: speciesItem.uuid }
      : null,
    planet: planetItem
      ? { id: planetItem.id, name: planetItem.name, uuid: planetItem.uuid }
      : null,
    faction: factionItem
      ? { id: factionItem.id, name: factionItem.name, uuid: factionItem.uuid }
      : null,
    histories: getHistorySlotDefinitions().map((slot, idx) => ({
      idx,
      label: slot.label,
      uuid: historySlots[idx]?.uuid ?? "",
      name: historySlots[idx]?.name ?? ""
    })),
    resources: buildResourceView(system),
    characteristics: buildCharacteristicsView(system),
    skills: buildSkillsView({ system, actor }),
    languages: {
      speak: languageSpeak,
      read: languageRead,
      speakCsv: languageSpeak.join(", "),
      readCsv: languageRead.join(", ")
    },
    sheetLock
  };
};
