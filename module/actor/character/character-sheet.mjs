import { aggregateActorDerivedData, applyAsyncActorVitalityDerivedData } from "../../global/derived/index.mjs";
import { aggregateActorLanguages } from "../../global/languages.mjs";
import { CHARACTERISTIC_DEFINITIONS_BY_KEY } from "../../global/characteristics/definitions.mjs";
import { LEARNED_SKILLS_BANK, NATURAL_SKILLS_BANK, SKILL_DEFINITIONS_BY_KEY } from "../../global/skills/definitions.mjs";
import {
  LEARNED_GROUP_OPTION_LABELS,
  LEARNED_SKILL_GROUP_KEYS,
  formatSkillLabel,
  normalizeSkillKey
} from "../../global/skills/group-specializations.mjs";
import { openSkillRollDialog } from "../../rolls/roll-dialog.mjs";
import { promptSpeciesSpiritChoice } from "../../ui/dialogs/species-spirit-choice.mjs";
import { getSheetLockState } from "../../ui/sheet-lock-mode.mjs";
import {
  buildCharacterSheetData,
  HISTORY_SLOT_LABELS,
  normalizeStringList,
  uniqueCaseInsensitive
} from "./character-sheet-data.mjs";
const CHARACTERISTIC_EFFECT_PATH_BY_KEY = {
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
  ego: "spirit.ego"
};
const SKILL_EFFECT_PATH_BY_KEY = Object.fromEntries(
  NATURAL_SKILLS_BANK.map((entry) => [entry.key, `natural.${entry.key}`])
);
for (const entry of LEARNED_SKILLS_BANK) {
  SKILL_EFFECT_PATH_BY_KEY[entry.key] = `learned.${entry.key}`;
}
const SKILL_VALUE_KEYS = ["base", "mod", "temp", "max", "history", "xp", "roll", "granted", "total"];

const canonicalToken = (value) => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "");

const mergeCharacteristicEffect = (map, key, amount) => {
  const token = String(key ?? "").trim().toLowerCase();
  const path = CHARACTERISTIC_EFFECT_PATH_BY_KEY[token] ?? "";
  const value = Number(amount ?? 0);
  if (!path || !Number.isFinite(value)) return;
  map[path] = (map[path] ?? 0) + value;
};

const mergeSkillEffect = (map, key, amount) => {
  const path = normalizeSkillEffectPath(key);
  const value = Number(amount ?? 0);
  if (!path || !Number.isFinite(value)) return;
  map[path] = (map[path] ?? 0) + value;
};

const normalizeSkillEffectPath = (value) => {
  const token = String(value ?? "").trim();
  if (!token) return "";

  if (token.includes(".")) {
    const parts = token
      .split(".")
      .map((part) => String(part ?? "").trim())
      .filter(Boolean);
    if (!parts.length) return "";

    if (parts.length === 2) {
      const root = parts[0].toLowerCase();
      const skill = normalizeSkillKey(parts[1]);
      if ((root === "natural" || root === "learned") && skill) return `${root}.${skill}`;
    }

    if (parts.length === 3) {
      const root = parts[0].toLowerCase();
      const group = normalizeSkillKey(parts[1]);
      const child = normalizeSkillKey(parts[2]);
      if (root === "learned" && group && child) return `learned.${group}.${child}`;
    }

    return token;
  }

  const normalized = normalizeSkillKey(token);
  if (!normalized) return "";
  return SKILL_EFFECT_PATH_BY_KEY[normalized] ?? `learned.${normalized}`;
};

const getNestedArray = (system, path) => {
  const fromSystem = foundry.utils.getProperty(system, path);
  if (Array.isArray(fromSystem)) return fromSystem;
  const fromLegacy = foundry.utils.getProperty(system, `data.${path}`);
  if (Array.isArray(fromLegacy)) return fromLegacy;
  return [];
};

const getNestedObject = (system, path) => {
  const fromSystem = foundry.utils.getProperty(system, path);
  if (fromSystem && typeof fromSystem === "object" && !Array.isArray(fromSystem)) return fromSystem;
  const fromLegacy = foundry.utils.getProperty(system, `data.${path}`);
  if (fromLegacy && typeof fromLegacy === "object" && !Array.isArray(fromLegacy)) return fromLegacy;
  return {};
};

const normalizeBonusEntries = (list = []) => {
  const out = [];
  const seen = new Set();

  for (const entry of Array.isArray(list) ? list : []) {
    const uuid = String(entry?.uuid ?? "").trim();
    const name = String(entry?.name ?? entry ?? "").trim();
    if (!name && !uuid) continue;
    const dedupeKey = `${uuid.toLowerCase()}::${name.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ uuid, name });
  }

  return out;
};

const readBlessingCurseCategory = (item) => {
  const tags = [
    ...(Array.isArray(item?.system?.tags) ? item.system.tags : []),
    ...(Array.isArray(foundry.utils.getProperty(item, "flags.fs2e.tags")) ? foundry.utils.getProperty(item, "flags.fs2e.tags") : [])
  ]
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);

  if (tags.some((tag) => tag.toLowerCase() === "blessing")) return "Blessing";
  if (tags.some((tag) => tag.toLowerCase() === "curse")) return "Curse";
  return "";
};

const formatBlessingCurseTarget = (target) => {
  const text = String(target ?? "").trim();
  if (!text) return "";

  const [type, key] = text.split(":");
  const normalizedType = String(type ?? "").trim().toLowerCase();
  const normalizedKey = String(key ?? "").trim();

  if (normalizedType === "characteristic") {
    return String(CHARACTERISTIC_DEFINITIONS_BY_KEY[normalizedKey]?.label ?? normalizedKey).trim();
  }

  if (normalizedType === "skill") {
    return String(SKILL_DEFINITIONS_BY_KEY[normalizedKey]?.label ?? formatSkillLabel(normalizedKey)).trim();
  }

  return text;
};

const buildBlessingCurseEffectText = (item) => {
  const amount = String(item?.system?.effectLine?.amount ?? "").trim();
  const target = formatBlessingCurseTarget(item?.system?.effectLine?.target);
  const note = String(item?.system?.effectLine?.note ?? "").trim();
  return [amount, target, note].filter(Boolean).join(" ");
};

const parseBlessingCurseAmount = (value) => {
  const text = String(value ?? "").trim().replace(/\s+/g, "");
  if (!text) return 0;
  const match = text.match(/^([+-]?)(\d{1,2})$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * Number(match[2]);
};

const targetAffectsVitality = (target) => String(target ?? "")
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .includes("vitality");

const applySheetVitalityBlessingCurseBonus = async ({ actor, system }) => {
  const vitality = system?.vitality;
  if (!vitality || typeof vitality !== "object") return;

  const historyEntries = (actor?.items ?? [])
    .filter((item) => item?.type === "history")
    .flatMap((item) => normalizeBonusEntries([
      ...getNestedArray(item?.system ?? {}, "bonusBlessingCurses"),
      ...getNestedArray(item?.system ?? {}, "data.bonusBlessingCurses")
    ]));

  const actorEntries = normalizeBonusEntries([
    ...getNestedArray(system, "bonusBlessingCurses"),
    ...getNestedArray(system, "data.bonusBlessingCurses")
  ]);

  const resolved = await Promise.all(
    normalizeBonusEntries([...historyEntries, ...actorEntries]).map(async (entry) => {
      const uuid = String(entry?.uuid ?? "").trim();
      return uuid ? fromUuid(uuid).catch(() => null) : null;
    })
  );

  const granted = resolved.reduce((sum, item) => {
    if (!item || item.type !== "blessingCurse") return sum;
    if (!item.system?.alwaysActive) return sum;
    if (!targetAffectsVitality(item.system?.effectLine?.target)) return sum;
    return sum + parseBlessingCurseAmount(item.system?.effectLine?.amount);
  }, 0);

  const nextBase = Math.max(0, Number(vitality.base ?? 0));
  const previousMax = Math.max(0, Number(vitality.total ?? vitality.max ?? (
    nextBase
    + Number(vitality.mod ?? 0)
    + Number(vitality.temp ?? 0)
    + Number(vitality.history ?? 0)
    + Number(vitality.xp ?? 0)
    + Number(vitality.granted ?? 0)
  )));
  const currentValue = Number(vitality.value);
  const mod = Number(vitality.mod ?? 0);
  const temp = Number(vitality.temp ?? 0);
  const history = Number(vitality.history ?? 0);
  const xp = Number(vitality.xp ?? 0);
  vitality.granted = granted;
  vitality.total = Math.max(0, nextBase + mod + temp + history + xp + granted);
  vitality.max = vitality.total;
  vitality.roll = vitality.total;
  const nextValue = Number.isFinite(currentValue)
    ? Math.max(0, Math.min(vitality.max, vitality.max - Math.max(0, previousMax - currentValue)))
    : vitality.max;
  vitality.value = nextValue;
};

const buildActorBlessingCurseView = async ({ actor, system }) => {
  const historyEntries = (actor?.items ?? [])
    .filter((item) => item?.type === "history")
    .flatMap((item) => normalizeBonusEntries([
      ...getNestedArray(item?.system ?? {}, "bonusBlessingCurses"),
      ...getNestedArray(item?.system ?? {}, "data.bonusBlessingCurses")
    ]));

  const actorEntries = normalizeBonusEntries([
    ...getNestedArray(system, "bonusBlessingCurses"),
    ...getNestedArray(system, "data.bonusBlessingCurses")
  ]);

  const entries = normalizeBonusEntries([...historyEntries, ...actorEntries]);

  const resolved = await Promise.all(entries.map(async (entry) => {
    const uuid = String(entry?.uuid ?? "").trim();
    const fallbackName = String(entry?.name ?? "").trim();
    const item = uuid ? await fromUuid(uuid).catch(() => null) : null;
    const category = readBlessingCurseCategory(item);
    return {
      uuid,
      name: String(item?.name ?? fallbackName).trim(),
      category,
      points: String(item?.system?.points ?? "").trim(),
      effect: buildBlessingCurseEffectText(item),
      hasUuid: Boolean(uuid)
    };
  }));

  const categoryRank = (category) => {
    if (category === "Blessing") return 0;
    if (category === "Curse") return 1;
    return 2;
  };

  return resolved
    .filter((entry) => entry.name)
    .sort((a, b) => {
      const rankDiff = categoryRank(a.category) - categoryRank(b.category);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name);
    });
};

const toNumberMap = (value) => {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;

  for (const [key, raw] of Object.entries(value)) {
    const amount = Number(raw);
    if (!Number.isFinite(amount)) continue;
    const path = String(key ?? "").trim();
    if (!path) continue;
    out[path] = amount;
  }

  return out;
};

const keyFromPath = (path) => String(path ?? "")
  .trim()
  .split(".")
  .pop();

const formatSignedAmount = (value) => {
  const amount = Number(value ?? 0);
  return amount > 0 ? `+${amount}` : `${amount}`;
};

const normalizeCharacteristicAdjustmentsFromSystem = (system = {}) => {
  const adjustments = getNestedArray(system, "characteristicsAdjustments");
  if (adjustments.length) return adjustments;

  return Object.entries(toNumberMap(getNestedObject(system, "effects.characteristics")))
    .map(([path, amount]) => {
      const key = String(keyFromPath(path) ?? "").trim().toLowerCase();
      if (!key) return null;
      return {
        key,
        label: CHARACTERISTIC_DEFINITIONS_BY_KEY[key]?.label ?? key,
        value: Number(amount)
      };
    })
    .filter(Boolean);
};

const normalizeSkillAdjustmentsFromSystem = (system = {}) => {
  const adjustments = getNestedArray(system, "skillsAdjustments");
  if (adjustments.length) {
    return adjustments
      .map((entry) => {
        const key = String(entry?.key ?? "").trim();
        if (!key) return null;
        const path = normalizeSkillEffectPath(entry?.path || key);
        return {
          ...entry,
          key,
          path
        };
      })
      .filter(Boolean);
  }

  return Object.entries(toNumberMap(getNestedObject(system, "effects.skills")))
    .map(([path, amount]) => {
      const key = String(keyFromPath(path) ?? "").trim();
      if (!key) return null;
      return {
        key,
        path,
        label: SKILL_DEFINITIONS_BY_KEY[key]?.label ?? formatSkillLabel(key),
        value: Number(amount)
      };
    })
    .filter(Boolean);
};

const inferAnyGroupLabel = ({ entryLabel, options }) => {
  const rawLabel = String(entryLabel ?? "").trim();
  if (/any\s+body/i.test(rawLabel)) return "Any Body";
  if (/any\s+mind/i.test(rawLabel)) return "Any Mind";
  if (/any\s+spirit/i.test(rawLabel)) return "Any Spirit";

  const keySet = new Set((options ?? []).map((option) => String(option?.key ?? "").trim().toLowerCase()));
  if (["strength", "dexterity", "endurance"].every((key) => keySet.has(key))) return "Any Body";
  if (["wits", "perception", "tech"].every((key) => keySet.has(key))) return "Any Mind";
  if (["extrovert", "introvert", "passion", "calm", "faith", "ego"].every((key) => keySet.has(key))) return "Any Spirit";
  return rawLabel || "Any";
};

const readCharacteristicChoiceOptions = (entry) => {
  const explicitChoices = Array.isArray(entry?.choice)
    ? entry.choice
      .map((choice) => {
        const key = String(choice?.key ?? "").trim().toLowerCase();
        if (!key) return null;
        const value = Number(choice?.value ?? 0);
        if (!Number.isFinite(value)) return null;
        const label = String(choice?.label ?? CHARACTERISTIC_DEFINITIONS_BY_KEY[key]?.label ?? key).trim();
        return { key, label, value };
      })
      .filter(Boolean)
    : [];
  if (explicitChoices.length) return explicitChoices;

  const legacyChoiceKeys = Array.isArray(entry?.choiceKeys)
    ? entry.choiceKeys.map((key) => String(key ?? "").trim().toLowerCase()).filter(Boolean)
    : [];
  if (legacyChoiceKeys.length < 2) return [];

  const amount = Number(entry?.value ?? 0);
  if (!Number.isFinite(amount)) return [];

  return legacyChoiceKeys.map((key) => ({
    key,
    label: CHARACTERISTIC_DEFINITIONS_BY_KEY[key]?.label ?? key,
    value: amount
  }));
};

const promptHistoryCharacteristicChoices = async ({ historyName, slotLabel, rows = [] }) => {
  if (!rows.length) return {};

  const dialogTitle = "Trait Assignment";

  const content = await renderTemplate("systems/fs2e/templates/dialogs/history-characteristic-choice.hbs", {
    title: dialogTitle,
    rows
  });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let dialog = null;
    dialog = new Dialog({
      title: dialogTitle,
      content,
      buttons: {},
      render: (html) => {
        const root = html?.[0];
        if (!root) return;

        const readSelections = () => {
          const selections = {};
          for (const row of rows) {
            if (row.mode === "radio") {
              const selected = String(root.querySelector(`input[name="${row.radioName}"]:checked`)?.value ?? "").trim();
              selections[row.id] = selected;
              continue;
            }

            const selected = String(root.querySelector(`select[name="historyCharacteristicChoice-${row.id}"]`)?.value ?? "").trim();
            selections[row.id] = selected;
          }
          return selections;
        };

        root.querySelector('[data-action="apply"]')?.addEventListener("click", (event) => {
          event.preventDefault();
          finish(readSelections());
          dialog?.close();
        });

        root.querySelector('[data-action="cancel"]')?.addEventListener("click", (event) => {
          event.preventDefault();
          finish(null);
          dialog?.close();
        });
      },
      close: () => finish(null)
    }, {
      classes: ["fs2e", "dialog", "chargen-choice"],
      width: 460,
      height: "auto",
      resizable: true
    });

    dialog.render(true);
  });
};

let activeParentSkillPrompt = null;
let lastParentSkillPrompt = { key: "", at: 0, result: null };

const buildParentSkillChildOptions = ({ actor, groupKey }) => {
  const baseLabels = Array.isArray(LEARNED_GROUP_OPTION_LABELS[groupKey]) ? LEARNED_GROUP_OPTION_LABELS[groupKey] : [];

  const out = [];
  const seen = new Set();
  const push = ({ key, label }) => {
    const normalizedKey = normalizeSkillKey(key || label);
    const normalizedLabel = String(label ?? "").trim();
    if (!normalizedKey || !normalizedLabel) return;
    const token = normalizedKey.toLowerCase();
    if (seen.has(token)) return;
    seen.add(token);
    out.push({ key: normalizedKey, label: normalizedLabel });
  };

  for (const label of baseLabels) push({ key: normalizeSkillKey(label), label });

  return out.sort((a, b) => a.label.localeCompare(b.label));
};

const promptParentSkillChoices = async ({ itemName, rows = [] }) => {
  if (!rows.length) return {};

  const groupLabels = Array.from(new Set(rows
    .map((row) => String(row?.groupLabel ?? "").trim())
    .filter(Boolean)));
  const dialogTitle = groupLabels.length === 1
    ? `${groupLabels[0]} Assignment`
    : "Skill Assignment";

  const promptKey = JSON.stringify({
    itemName: String(itemName ?? "").trim().toLowerCase(),
    rows: rows.map((row) => ({
      id: String(row?.id ?? ""),
      groupKey: String(row?.groupKey ?? ""),
      options: (Array.isArray(row?.options) ? row.options : []).map((option) => ({
        key: String(option?.key ?? ""),
        label: String(option?.label ?? "")
      }))
    }))
  });

  const now = Date.now();
  if (
    lastParentSkillPrompt.key &&
    lastParentSkillPrompt.key === promptKey &&
    now - Number(lastParentSkillPrompt.at ?? 0) < 4000
  ) {
    return foundry.utils.deepClone(lastParentSkillPrompt.result ?? null);
  }

  if (activeParentSkillPrompt) return activeParentSkillPrompt;

  const rowsForTemplate = rows.map((row) => {
    const defaultKey = String(row?.defaultKey ?? "").trim().toLowerCase();
    const customValue = String(row?.customValue ?? "").trim();
    const options = (Array.isArray(row?.options) ? row.options : []).map((option, idx) => {
      const optionKey = String(option?.key ?? "").trim().toLowerCase();
      return {
        ...option,
        selected: defaultKey
          ? optionKey === defaultKey
          : idx === 0
      };
    });
    return {
      ...row,
      options,
      customValue
    };
  });

  const content = await renderTemplate("systems/fs2e/templates/dialogs/parent-skill-choice.hbs", {
    title: dialogTitle,
    rows: rowsForTemplate
  });

  activeParentSkillPrompt = new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let dialog = null;
    dialog = new Dialog({
      title: dialogTitle,
      content,
      buttons: {},
      render: (html) => {
        const root = html?.[0];
        if (!root) return;

        const readSelections = () => {
          const selections = {};
          for (const row of rows) {
            const custom = String(root.querySelector(`[name="custom-${row.id}"]`)?.value ?? "").trim();
            const selected = String(root.querySelector(`input[name="choice-${row.id}"]:checked`)?.value ?? "").trim();
            if (!custom && !selected) return null;

            if (custom) {
              const childKey = normalizeSkillKey(custom);
              if (!childKey) return null;
              selections[row.id] = { childKey, display: custom };
              continue;
            }

            const option = (Array.isArray(row.options) ? row.options : [])
              .find((entry) => String(entry?.key ?? "").trim() === selected);
            if (!option) return null;
            selections[row.id] = {
              childKey: String(option.key ?? "").trim(),
              display: String(option.label ?? "").trim()
            };
          }
          return selections;
        };

        root.querySelector('[data-action="apply"]')?.addEventListener("click", (event) => {
          event.preventDefault();
          const selections = readSelections();
          if (!selections) return;
          finish(selections);
          dialog?.close();
        });

        root.querySelector('[data-action="cancel"]')?.addEventListener("click", (event) => {
          event.preventDefault();
          finish(null);
          dialog?.close();
        });
      },
      close: () => finish(null)
    }, {
      classes: ["fs2e", "dialog", "chargen-choice", "parent-skill-choice"],
      width: 440,
      height: "auto",
      resizable: true
    });

    dialog.render(true);
  }).then((result) => {
    lastParentSkillPrompt = {
      key: promptKey,
      at: Date.now(),
      result: foundry.utils.deepClone(result)
    };
    return result;
  }).finally(() => {
    activeParentSkillPrompt = null;
  });

  return activeParentSkillPrompt;
};

const resolveHistoryCharacteristicAdjustments = async ({ actor, itemName, slotLabel, system }) => {
  const nextSystem = foundry.utils.deepClone(system ?? {});
  const selectedParentSkillChoices = [];

  const rawAdjustments = normalizeCharacteristicAdjustmentsFromSystem(nextSystem);
  const rawSkillAdjustments = normalizeSkillAdjustmentsFromSystem(nextSystem);
  const bonusBlessingCurses = normalizeBonusEntries([
    ...getNestedArray(nextSystem, "bonusBlessingCurses"),
    ...getNestedArray(nextSystem, "data.bonusBlessingCurses")
  ]);
  const bonusBeneficeAfflictions = normalizeBonusEntries([
    ...getNestedArray(nextSystem, "bonusBeneficeAfflictions"),
    ...getNestedArray(nextSystem, "data.bonusBeneficeAfflictions")
  ]);
  const bonusActions = normalizeBonusEntries([
    ...getNestedArray(nextSystem, "bonusActions"),
    ...getNestedArray(nextSystem, "data.bonusActions")
  ]);
  const languageSpeak = uniqueCaseInsensitive([
    ...normalizeStringList(foundry.utils.getProperty(nextSystem, "languages.speak")),
    ...normalizeStringList(foundry.utils.getProperty(nextSystem, "data.languages.speak"))
  ]);
  const languageRead = uniqueCaseInsensitive([
    ...normalizeStringList(foundry.utils.getProperty(nextSystem, "languages.read")),
    ...normalizeStringList(foundry.utils.getProperty(nextSystem, "data.languages.read"))
  ]);

  if (!rawAdjustments.length && !rawSkillAdjustments.length) {
    nextSystem.effects = nextSystem.effects ?? {};
    nextSystem.effects.characteristics = toNumberMap(getNestedObject(nextSystem, "effects.characteristics"));
    nextSystem.effects.skills = toNumberMap(getNestedObject(nextSystem, "effects.skills"));
    nextSystem.languages = { speak: languageSpeak, read: languageRead };
    nextSystem.bonusBlessingCurses = bonusBlessingCurses;
    nextSystem.bonusBeneficeAfflictions = bonusBeneficeAfflictions;
    nextSystem.bonusActions = bonusActions;
    return nextSystem;
  }

  const resolvedAdjustments = [];
  const pendingRows = [];
  let rowCounter = 0;

  for (const entry of rawAdjustments) {
    const selectedKey = String(entry?.selectedKey ?? "").trim().toLowerCase();
    if (selectedKey) {
      const amount = Number(entry?.selectedValue ?? entry?.value ?? 0);
      if (!Number.isFinite(amount)) continue;
      resolvedAdjustments.push({
        key: selectedKey,
        label: String(entry?.selectedLabel ?? CHARACTERISTIC_DEFINITIONS_BY_KEY[selectedKey]?.label ?? selectedKey).trim(),
        value: amount
      });
      continue;
    }

    const options = readCharacteristicChoiceOptions(entry);
    if (options.length >= 2) {
      const rowId = `row-${rowCounter++}`;
      const mappedOptions = options
        .map((option, index) => {
          const key = String(option?.key ?? "").trim().toLowerCase();
          const value = Number(option?.value ?? 0);
          if (!key || !Number.isFinite(value)) return null;
          const label = String(option?.label ?? CHARACTERISTIC_DEFINITIONS_BY_KEY[key]?.label ?? key).trim();
          return {
            id: `${rowId}-opt-${index}`,
            key,
            value,
            label,
            displayLabel: `${label} ${formatSignedAmount(value)}`
          };
        })
        .filter(Boolean);
      if (!mappedOptions.length) continue;

      pendingRows.push({
        id: rowId,
        mode: mappedOptions.length === 2 ? "radio" : "select",
        isRadio: mappedOptions.length === 2,
        isSelect: mappedOptions.length !== 2,
        radioName: `fs2e-history-choice-${Math.random().toString(36).slice(2)}`,
        anyLabel: mappedOptions.length > 2 ? inferAnyGroupLabel({ entryLabel: entry?.label, options: mappedOptions }) : "",
        selectTitle: (() => {
          if (mappedOptions.length <= 2) return "";
          const groupLabel = inferAnyGroupLabel({ entryLabel: entry?.label, options: mappedOptions });
          const slotText = String(slotLabel ?? "").trim();
          const historyText = String(itemName ?? "").trim();
          if (slotText && historyText) return `${groupLabel} Choices (${slotText}, ${historyText})`;
          if (slotText) return `${groupLabel} Choices (${slotText})`;
          if (historyText) return `${groupLabel} Choices (${historyText})`;
          return `${groupLabel} Choices`;
        })(),
        left: mappedOptions[0] ?? null,
        right: mappedOptions[1] ?? null,
        options: mappedOptions
      });
      continue;
    }

    if (options.length === 1) {
      const choice = options[0];
      resolvedAdjustments.push({
        key: choice.key,
        label: choice.label,
        value: Number(choice.value ?? 0)
      });
      continue;
    }

    const key = String(entry?.key ?? "").trim().toLowerCase();
    const amount = Number(entry?.value ?? 0);
    if (!key || !Number.isFinite(amount)) continue;
    resolvedAdjustments.push({
      key,
      label: String(entry?.label ?? CHARACTERISTIC_DEFINITIONS_BY_KEY[key]?.label ?? key).trim(),
      value: amount
    });
  }

  if (pendingRows.length) {
    const selections = await promptHistoryCharacteristicChoices({
      historyName: itemName,
      slotLabel,
      rows: pendingRows
    });
    if (!selections) return null;

    for (const row of pendingRows) {
      const selectedId = String(selections[row.id] ?? "").trim();
      const selected = row.options.find((option) => option.id === selectedId) ?? row.options[0];
      if (!selected) continue;

      resolvedAdjustments.push({
        key: selected.key,
        label: selected.label,
        value: Number(selected.value ?? 0)
      });
    }
  }

  const characteristicEffects = {};
  for (const entry of resolvedAdjustments) {
    mergeCharacteristicEffect(characteristicEffects, entry?.key, entry?.value);
  }

  const baseSkillAdjustments = rawSkillAdjustments
    .map((entry) => {
      const key = String(entry?.key ?? "").trim();
      const path = String(entry?.path ?? "").trim();
      const value = Number(entry?.value ?? 0);
      if (!key || !Number.isFinite(value)) return null;
      return {
        key,
        path,
        label: String(entry?.label ?? SKILL_DEFINITIONS_BY_KEY[key]?.label ?? formatSkillLabel(key)).trim(),
        value
      };
    })
    .filter(Boolean);

  const pendingParentRows = [];
  const normalizedSkillAdjustments = [];
  const parentPathsToSkip = new Set();

  for (const entry of baseSkillAdjustments) {
    const normalizedPath = normalizeSkillEffectPath(entry?.path || entry?.key);
    const parentMatch = String(normalizedPath).match(/^learned\.([^.]+)$/i);
    const childMatch = String(normalizedPath).match(/^learned\.([^.]+)\.([^.]+)$/i);
    const groupKey = String(parentMatch?.[1] ?? childMatch?.[1] ?? "").trim();
    const existingChildKey = normalizeSkillKey(childMatch?.[2]);
    const isParentGroup = groupKey && LEARNED_SKILL_GROUP_KEYS.has(groupKey);

    if (!isParentGroup) {
      normalizedSkillAdjustments.push(entry);
      continue;
    }

    const options = buildParentSkillChildOptions({ actor, groupKey });
    if (!options.length) {
      normalizedSkillAdjustments.push(entry);
      continue;
    }

    parentPathsToSkip.add(normalizedPath);
    const explicitDisplay = String(entry?.display ?? "").trim();
    const labelText = String(entry?.label ?? "").trim();
    const entryDisplay = explicitDisplay || (
      labelText.includes(":")
        ? String(labelText.split(":").slice(1).join(":")).trim()
        : ""
    );
    const matchingOption = options.find((option) => String(option?.key ?? "").trim().toLowerCase() === existingChildKey?.toLowerCase());
    pendingParentRows.push({
      id: `${groupKey}-${pendingParentRows.length}`,
      groupKey,
      groupLabel: formatSkillLabel(groupKey),
      entry,
      options,
      defaultKey: matchingOption ? String(matchingOption.key ?? "") : String(options[0]?.key ?? ""),
      customValue: matchingOption ? "" : (entryDisplay || String(childMatch?.[2] ?? "").trim())
    });
    if (childMatch) continue;
  }

  if (pendingParentRows.length) {
    const picked = await promptParentSkillChoices({
      itemName,
      rows: pendingParentRows
    });
    if (!picked) return null;

    for (const row of pendingParentRows) {
      const selection = picked?.[row.id];
      if (!selection) continue;
      const childKey = normalizeSkillKey(selection.childKey);
      const display = String(selection.display ?? "").trim() || formatSkillLabel(childKey);
      if (!childKey) continue;
      selectedParentSkillChoices.push({
        groupKey: String(row.groupKey ?? "").trim(),
        childKey,
        display,
        amount: Number(row.entry?.value ?? 0)
      });
      normalizedSkillAdjustments.push({
        key: `${row.groupKey}.${childKey}`,
        path: `learned.${row.groupKey}.${childKey}`,
        label: `${row.groupLabel}: ${display}`,
        value: Number(row.entry?.value ?? 0)
      });
    }
  }

  const sourceSkillEffects = toNumberMap(getNestedObject(nextSystem, "effects.skills"));
  const skillEffects = {};
  const normalizedPaths = new Set();
  for (const entry of normalizedSkillAdjustments) {
    const path = normalizeSkillEffectPath(entry?.path || entry?.key);
    if (!path) continue;
    normalizedPaths.add(path);
    mergeSkillEffect(skillEffects, path, entry?.value);
  }

  // Only fall back to legacy effect-map skills when there are no explicit skill adjustments on the item.
  if (!rawSkillAdjustments.length) {
    for (const [path, amount] of Object.entries(sourceSkillEffects)) {
      const key = normalizeSkillEffectPath(path);
      if (!key || normalizedPaths.has(key) || parentPathsToSkip.has(key)) continue;
      skillEffects[key] = Number(amount);
    }
  }

  nextSystem.characteristicsAdjustments = resolvedAdjustments;
  nextSystem.skillsAdjustments = normalizedSkillAdjustments;
  nextSystem.effects = nextSystem.effects ?? {};
  nextSystem.effects.characteristics = characteristicEffects;
  nextSystem.effects.skills = skillEffects;
  nextSystem.languages = {
    speak: languageSpeak,
    read: languageRead
  };
  nextSystem.bonusBlessingCurses = bonusBlessingCurses;
  nextSystem.bonusBeneficeAfflictions = bonusBeneficeAfflictions;
  nextSystem.bonusActions = bonusActions;
  if (selectedParentSkillChoices.length) nextSystem.__fs2eParentSkillChoices = selectedParentSkillChoices;
  return nextSystem;
};

const extractLearnedChildSkillPairsFromSystem = (system = {}) => {
  const pairs = new Map();

  const pushPath = (value) => {
    const normalized = normalizeSkillEffectPath(value);
    const match = String(normalized ?? "").match(/^learned\.([^.]+)\.([^.]+)$/i);
    const groupKey = String(match?.[1] ?? "").trim();
    const childKey = String(match?.[2] ?? "").trim();
    if (!groupKey || !childKey) return;
    const token = `${groupKey.toLowerCase()}.${childKey.toLowerCase()}`;
    if (pairs.has(token)) return;
    pairs.set(token, {
      groupKey: normalizeSkillKey(groupKey),
      childKey: normalizeSkillKey(childKey)
    });
  };

  for (const entry of normalizeSkillAdjustmentsFromSystem(system)) {
    pushPath(entry?.path || entry?.key);
  }

  for (const path of Object.keys(toNumberMap(getNestedObject(system, "effects.skills")))) {
    pushPath(path);
  }

  return [...pairs.values()].filter((entry) => entry.groupKey && entry.childKey);
};

const extractLearnedChildSkillDisplayMapFromSystem = (system = {}) => {
  const displays = new Map();

  for (const entry of normalizeSkillAdjustmentsFromSystem(system)) {
    const normalized = normalizeSkillEffectPath(entry?.path || entry?.key);
    const match = String(normalized ?? "").match(/^learned\.([^.]+)\.([^.]+)$/i);
    const groupKey = normalizeSkillKey(match?.[1]);
    const childKey = normalizeSkillKey(match?.[2]);
    if (!groupKey || !childKey) continue;

    const explicitDisplay = String(entry?.display ?? "").trim();
    const labelText = String(entry?.label ?? "").trim();
    const labelDisplay = labelText.includes(":")
      ? String(labelText.split(":").slice(1).join(":")).trim()
      : "";
    const display = explicitDisplay || labelDisplay || formatSkillLabel(childKey);
    const token = `${groupKey.toLowerCase()}.${childKey.toLowerCase()}`;
    if (!displays.has(token)) displays.set(token, display);
  }

  return displays;
};

const normalizeLearnedSkillPairs = (list = []) => {
  const out = [];
  const seen = new Set();
  for (const entry of Array.isArray(list) ? list : []) {
    const groupKey = normalizeSkillKey(entry?.groupKey);
    const childKey = normalizeSkillKey(entry?.childKey);
    const amount = Number(entry?.amount ?? 0);
    if (!groupKey || !childKey) continue;
    const token = `${groupKey.toLowerCase()}.${childKey.toLowerCase()}`;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push({ groupKey, childKey, amount: Number.isFinite(amount) ? amount : 0 });
  }
  return out;
};

const getHistorySlotDefinitions = () => {
  const mapped = normalizeStringList(CONFIG?.fs2e?.mappingData?.tags?.item?.history);
  return HISTORY_SLOT_LABELS.map((label, index) => {
    const mappedTag = String(
      mapped[index] ??
      (index >= mapped.length && mapped.length ? mapped[mapped.length - 1] : "") ??
      ""
    ).trim();
    const acceptedTags = uniqueCaseInsensitive([label, mappedTag].filter(Boolean));
    if (acceptedTags.some((tag) => /duty/i.test(tag))) acceptedTags.push("Tour of Durty");
    if (acceptedTags.some((tag) => /durty/i.test(tag))) acceptedTags.push("Tour of Duty");
    return {
      index,
      label,
      acceptedTags: uniqueCaseInsensitive(acceptedTags),
      acceptedTagTokens: [...new Set(acceptedTags.map((tag) => canonicalToken(tag)).filter(Boolean))]
    };
  });
};

const readItemTags = (item) => {
  const rawTags =
    item?.system?.tags ??
    item?.system?.data?.tags ??
    item?.getFlag?.("fs2e", "tags") ??
    foundry.utils.getProperty(item, "flags.fs2e.tags");
  return uniqueCaseInsensitive(normalizeStringList(rawTags));
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

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

const isLearnedGroupContainer = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return !hasSkillScore(value);
};

const isDisplayMetaKey = (key) => String(key ?? "").startsWith("__");

const buildLearnedGroupOptionLabels = (groupKey, groupValue = {}) => {
  const base = Array.isArray(LEARNED_GROUP_OPTION_LABELS[groupKey]) ? LEARNED_GROUP_OPTION_LABELS[groupKey] : [];
  const childLabels = Object.entries(groupValue)
    .filter(([key, value]) => !isDisplayMetaKey(key) && hasSkillScore(value))
    .map(([key, value]) => {
      const explicit = String(value?.display ?? "").trim();
      return explicit || formatSkillLabel(key);
    });
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
  const vitalityMax = Math.max(0, Number(system?.vitality?.total ?? system?.vitality?.max ?? ((system?.vitality?.base ?? 0) + (system?.vitality?.mod ?? 0))));
  const vitalityValueRaw = Number(system?.vitality?.value ?? vitalityMax);
  const vitalityValue = Number.isFinite(vitalityValueRaw)
    ? Math.max(0, Math.min(vitalityMax, vitalityValueRaw))
    : vitalityMax;
  const wyrdValue = Math.max(0, Number(system?.wyrd?.value ?? 0));

  return {
    vitalityDots: buildTrackDots(vitalityValue),
    wyrdDots: buildTrackDots(wyrdValue),
    woundPenaltyCells: buildPenaltyCells(WOUND_PENALTY_VALUES, RESOURCE_TRACK_LENGTH)
  };
};

const toSkillViewEntry = ({ system, key, label, scored, totalPath }) => {
  const definition = SKILL_DEFINITIONS_BY_KEY[key] ?? {};
  const desc = definition.desc ?? "";
  const complementary = definition.complementary ?? "";
  const stat = scored ? foundry.utils.getProperty(system, totalPath) : null;
  return {
    key,
    label: label ?? definition.label ?? formatSkillLabel(key),
    desc,
    complementary,
    tooltipDesc: buildSkillTextTooltipHtml({ desc, complementary }),
    tooltipStats: toTooltipStatBreakdown(stat),
    defaultCharacteristic: definition.defaultCharacteristic ?? "",
    scored,
    total: scored ? getStatTotal(system, totalPath) : null
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

export class FS2ECharacterSheet extends ActorSheet {
  _blessingCurseSectionState = {
    blessings: true,
    curses: true
  };

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["fs2e", "sheet", "actor", "character"],
      width: 620,
      height: 860,
      submitOnChange: true,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "characteristics" }]
    });
  }

  get template() {
    return "systems/fs2e/templates/actor/character.hbs";
  }

  async getData(options = {}) {
    const data = await super.getData(options);
    await this._ensureEmbeddedHistoriesForSlots();
    aggregateActorDerivedData(this.actor);
    await applyAsyncActorVitalityDerivedData(this.actor);
    aggregateActorLanguages(this.actor);

    data.system = foundry.utils.deepClone(this.actor.system);
    await applySheetVitalityBlessingCurseBonus({ actor: this.actor, system: data.system });
    data.view = data.view ?? {};
    const historySlots = this._readHistorySlots();
    Object.assign(data.view, buildCharacterSheetData({
      actor: this.actor,
      system: data.system,
      historySlots,
      sheetLock: getSheetLockState(this.actor)
    }));
    data.view.blessingCurses = await buildActorBlessingCurseView({ actor: this.actor, system: data.system });
    data.view.blessings = data.view.blessingCurses.filter((entry) => entry.category === "Blessing");
    data.view.curses = data.view.blessingCurses.filter((entry) => entry.category === "Curse");
    data.view.blessingCurseSections = {
      blessingsExpanded: this._blessingCurseSectionState.blessings !== false,
      cursesExpanded: this._blessingCurseSectionState.curses !== false
    };
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on("dragover", "[data-drop-species]", (event) => {
      event.preventDefault();
    });

    html.on("drop", "[data-drop-species]", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await this._onDropSpecies(event.originalEvent ?? event);
    });

    html.on("dragover", "[data-drop-planet]", (event) => {
      event.preventDefault();
    });

    html.on("drop", "[data-drop-planet]", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await this._onDropPlanet(event.originalEvent ?? event);
    });

    html.on("dragover", "[data-drop-faction]", (event) => {
      event.preventDefault();
    });

    html.on("drop", "[data-drop-faction]", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await this._onDropFaction(event.originalEvent ?? event);
    });

    html.on("dragover", "[data-drop-history]", (event) => {
      event.preventDefault();
    });

    html.on("drop", "[data-drop-history]", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const slotIndex = Number(event.currentTarget?.dataset?.historySlot ?? -1);
      await this._onDropHistory(event.originalEvent ?? event, slotIndex);
    });

    html.on("click", ".open-species", async (event) => {
      event.preventDefault();
      const uuid = event.currentTarget?.dataset?.uuid;
      if (!uuid) return;
      const species = await fromUuid(uuid);
      species?.sheet?.render(true);
    });

    html.on("click", ".clear-species", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await this._clearSpecies();
    });

    html.on("click", ".open-planet", async (event) => {
      event.preventDefault();
      const uuid = event.currentTarget?.dataset?.uuid;
      if (!uuid) return;
      const planet = await fromUuid(uuid);
      planet?.sheet?.render(true);
    });

    html.on("click", ".clear-planet", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await this._clearPlanet();
    });

    html.on("click", ".open-faction", async (event) => {
      event.preventDefault();
      const uuid = event.currentTarget?.dataset?.uuid;
      if (!uuid) return;
      const faction = await fromUuid(uuid);
      faction?.sheet?.render(true);
    });

    html.on("click", ".clear-faction", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await this._clearFaction();
    });

    html.on("click", ".open-history", async (event) => {
      event.preventDefault();
      const uuid = event.currentTarget?.dataset?.uuid;
      if (!uuid) return;
      const history = await fromUuid(uuid);
      history?.sheet?.render(true);
    });

    html.on("click", ".open-bonus-blessing-curse", async (event) => {
      event.preventDefault();
      const uuid = event.currentTarget?.dataset?.uuid;
      if (!uuid) return;
      const item = await fromUuid(uuid);
      item?.sheet?.render(true);
    });

    html.on("click", "[data-action='toggle-bc-section']", (event) => {
      event.preventDefault();
      const section = String(event.currentTarget?.dataset?.section ?? "").trim();
      if (!section || !Object.prototype.hasOwnProperty.call(this._blessingCurseSectionState, section)) return;
      this._blessingCurseSectionState[section] = !this._blessingCurseSectionState[section];
      this.render(false);
    });

    html.on("click", ".clear-history", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const slotIndex = Number(event.currentTarget?.dataset?.historySlot ?? -1);
      await this._clearHistorySlot(slotIndex);
    });

    html.on("click", "[data-action='add-skill']", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const groupKey = String(event.currentTarget?.dataset?.skillGroup ?? "").trim();
      if (!groupKey) return;

      const optionLabels = normalizeStringList(event.currentTarget?.dataset?.skillOptions);
      const picked = await this._promptLearnedGroupSkill(groupKey, optionLabels);
      if (!picked) return;
      await this._createLearnedGroupSkill(groupKey, picked.skillKey, picked.display);
    });

    html.on("click", "[data-action='remove-skill']", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const groupKey = String(event.currentTarget?.dataset?.skillGroup ?? "").trim();
      const childKey = String(event.currentTarget?.dataset?.skillKey ?? "").trim();
      if (!groupKey || !childKey) return;
      await this._removeLearnedGroupSkill(groupKey, childKey);
    });

    html.on("click", ".stat[data-skill]", async (event) => {
      if (event.target?.closest?.("button")) return;
      event.preventDefault();
      const skillKey = String(event.currentTarget?.dataset?.skill ?? "").trim();
      if (!skillKey) return;
      await openSkillRollDialog({ actor: this.actor, skillKey });
    });
  }

  async _clearSpecies() {
    const speciesItems = (this.actor.items ?? [])
      .filter((item) => item?.type === "species");

    const speciesIds = speciesItems.map((item) => item.id);

    if (speciesIds.length) {
      await this.actor.deleteEmbeddedDocuments("Item", speciesIds);
    }

    await this.actor.update({ "system.species": "" });
  }

  async _onDropSpecies(event) {
    const dropData = TextEditor.getDragEventData(event);
    if (!dropData) return;

    const itemDoc = await Item.implementation.fromDropData(dropData);
    if (!itemDoc || itemDoc.type !== "species") return;

    const selectedSpiritPrimary = await promptSpeciesSpiritChoice({
      alwaysPrimary: itemDoc.system?.spiritAlwaysPrimary
    });
    if (!selectedSpiritPrimary) return;

    const speciesItems = (this.actor.items ?? [])
      .filter((item) => item?.type === "species");

    const speciesIds = speciesItems.map((item) => item.id);

    if (speciesIds.length) {
      await this.actor.deleteEmbeddedDocuments("Item", speciesIds);
    }

    const createData = itemDoc.toObject();
    foundry.utils.setProperty(createData, "system.spiritAlwaysPrimary", selectedSpiritPrimary);
    delete createData._id;

    const [created] = await this.actor.createEmbeddedDocuments("Item", [createData]);
    await this.actor.update({ "system.species": created?.name ?? itemDoc.name ?? "" });
  }

  async _onDropPlanet(event) {
    const dropData = TextEditor.getDragEventData(event);
    if (!dropData) return;

    const itemDoc = await Item.implementation.fromDropData(dropData);
    if (!itemDoc || itemDoc.type !== "planet") return;

    const planetItems = (this.actor.items ?? [])
      .filter((item) => item?.type === "planet");

    const planetIds = planetItems.map((item) => item.id);
    if (planetIds.length) {
      await this.actor.deleteEmbeddedDocuments("Item", planetIds);
    }

    const createData = itemDoc.toObject();
    delete createData._id;
    const [created] = await this.actor.createEmbeddedDocuments("Item", [createData]);
    await this.actor.update({ "system.planet": created?.name ?? itemDoc.name ?? "" });
  }

  async _clearPlanet() {
    const planetItems = (this.actor.items ?? [])
      .filter((item) => item?.type === "planet");

    const planetIds = planetItems.map((item) => item.id);
    if (planetIds.length) {
      await this.actor.deleteEmbeddedDocuments("Item", planetIds);
    }

    await this.actor.update({ "system.planet": "" });
  }

  async _onDropFaction(event) {
    const dropData = TextEditor.getDragEventData(event);
    if (!dropData) return;

    const itemDoc = await Item.implementation.fromDropData(dropData);
    if (!itemDoc || itemDoc.type !== "faction") return;

    const factionItems = (this.actor.items ?? [])
      .filter((item) => item?.type === "faction");

    const factionIds = factionItems.map((item) => item.id);
    if (factionIds.length) {
      await this.actor.deleteEmbeddedDocuments("Item", factionIds);
    }

    const createData = itemDoc.toObject();
    delete createData._id;
    const [created] = await this.actor.createEmbeddedDocuments("Item", [createData]);

    await this.actor.update({ "system.faction": created?.name ?? itemDoc.name ?? "" });
  }

  async _clearFaction() {
    const factionItems = (this.actor.items ?? [])
      .filter((item) => item?.type === "faction");

    const factionIds = factionItems.map((item) => item.id);
    if (factionIds.length) {
      await this.actor.deleteEmbeddedDocuments("Item", factionIds);
    }

    await this.actor.update({ "system.faction": "" });
  }

  _readHistorySlots() {
    const raw = this.actor.getFlag("fs2e", "historySlots");
    const source = Array.isArray(raw) ? raw : [];
    const slots = source.map((entry) => ({
      id: String(entry?.id ?? "").trim(),
      uuid: String(entry?.uuid ?? "").trim(),
      sourceUuid: String(entry?.sourceUuid ?? "").trim(),
      name: String(entry?.name ?? "").trim(),
      grantedSkills: normalizeLearnedSkillPairs(entry?.grantedSkills)
    }));
    while (slots.length < HISTORY_SLOT_LABELS.length) {
      slots.push({ id: "", uuid: "", sourceUuid: "", name: "", grantedSkills: [] });
    }
    return slots.slice(0, HISTORY_SLOT_LABELS.length);
  }

  _collectLearnedSkillPairTokensFromHistoryItems(excludeIds = new Set()) {
    const tokens = new Set();
    const excluded = new Set([...excludeIds].map((id) => String(id)));

    for (const item of this.actor.items ?? []) {
      if (item?.type !== "history") continue;
      if (excluded.has(String(item.id))) continue;

      const flaggedPairs = normalizeLearnedSkillPairs(item.getFlag?.("fs2e", "grantedLearnedSkills"));
      const pairs = flaggedPairs.length ? flaggedPairs : extractLearnedChildSkillPairsFromSystem(item.system ?? {});
      for (const pair of pairs) {
        tokens.add(`${pair.groupKey.toLowerCase()}.${pair.childKey.toLowerCase()}`);
      }
    }

    return tokens;
  }

  async _removeLearnedSkillPairsIfUnreferenced(pairs = [], excludeItemIds = new Set()) {
    const normalizedPairs = normalizeLearnedSkillPairs(pairs);
    if (!normalizedPairs.length) return;

    const referencedTokens = this._collectLearnedSkillPairTokensFromHistoryItems(excludeItemIds);
    for (const pair of normalizedPairs) {
      const token = `${pair.groupKey.toLowerCase()}.${pair.childKey.toLowerCase()}`;
      if (referencedTokens.has(token)) continue;
      await this._removeLearnedGroupSkill(pair.groupKey, pair.childKey);
    }
  }

  async _ensureEmbeddedHistoriesForSlots() {
    const slots = this._readHistorySlots();
    let changed = false;

    for (let idx = 0; idx < slots.length; idx += 1) {
      const slot = slots[idx];
      const id = String(slot.id ?? "").trim();
      if (id) {
        const embedded = this.actor.items?.get(id);
        if (embedded?.type === "history") {
          slot.uuid = String(embedded.uuid ?? slot.uuid ?? "").trim();
          slot.name = String(embedded.name ?? slot.name ?? "").trim();
          continue;
        }

        // If the embedded history is gone, clear this slot so effects are removed.
        await this._removeLearnedSkillPairsIfUnreferenced(slot.grantedSkills ?? []);
        slot.id = "";
        slot.uuid = "";
        slot.sourceUuid = "";
        slot.name = "";
        slot.grantedSkills = [];
        changed = true;
        continue;
      }

      const legacyUuid = String(slot.uuid ?? "").trim();
      if (!legacyUuid) continue;

      const sourceUuid = String(slot.sourceUuid ?? "").trim();
      if (sourceUuid) {
        // If this slot had already been migrated once and lost its embedded item, keep it cleared.
        slot.uuid = "";
        slot.sourceUuid = "";
        slot.name = "";
        slot.grantedSkills = [];
        changed = true;
        continue;
      }

      const sourceDoc = await fromUuid(legacyUuid);
      if (!sourceDoc || sourceDoc.type !== "history") {
        slot.uuid = "";
        slot.name = "";
        slot.grantedSkills = [];
        changed = true;
        continue;
      }

      const createData = sourceDoc.toObject();
      createData.flags = createData.flags ?? {};
      createData.flags.fs2e = {
        ...(createData.flags.fs2e ?? {}),
        historySlotIndex: idx,
        historySourceUuid: String(sourceDoc.uuid ?? legacyUuid).trim()
      };
      delete createData._id;
      const [created] = await this.actor.createEmbeddedDocuments("Item", [createData]);
      if (!created) continue;

      slot.id = String(created.id ?? "").trim();
      slot.uuid = String(created.uuid ?? "").trim();
      slot.sourceUuid = String(sourceDoc.uuid ?? legacyUuid).trim();
      slot.name = String(created.name ?? sourceDoc.name ?? "").trim();
      slot.grantedSkills = normalizeLearnedSkillPairs(
        created.getFlag?.("fs2e", "grantedLearnedSkills") ??
        extractLearnedChildSkillPairsFromSystem(createData.system ?? {})
      );
      changed = true;
    }

    if (changed) {
      await this.actor.setFlag("fs2e", "historySlots", slots);
    }
  }

  _historyItemMatchesSlot(item, slotIndex) {
    const slot = getHistorySlotDefinitions()[slotIndex];
    if (!slot) return false;
    const itemTagTokens = new Set(readItemTags(item).map((tag) => canonicalToken(tag)).filter(Boolean));
    if (!itemTagTokens.size) return false;
    return slot.acceptedTagTokens.some((token) => itemTagTokens.has(token));
  }

  _collectHistorySlotLinkedItemIds(slotIndex, slotEntry = {}) {
    const ids = new Set();

    const directId = String(slotEntry?.id ?? "").trim();
    if (directId && this.actor.items?.get(directId)?.type === "history") {
      ids.add(directId);
    }

    const slotUuid = String(slotEntry?.uuid ?? "").trim();
    if (slotUuid) {
      const byUuid = (this.actor.items ?? []).find(
        (item) => item?.type === "history" && String(item?.uuid ?? "").trim() === slotUuid
      );
      if (byUuid?.id) ids.add(String(byUuid.id));
    }

    const sourceUuid = String(slotEntry?.sourceUuid ?? "").trim();
    if (sourceUuid) {
      for (const item of this.actor.items ?? []) {
        if (item?.type !== "history") continue;
        const itemSourceUuid = String(item.getFlag?.("fs2e", "historySourceUuid") ?? "").trim();
        if (itemSourceUuid && itemSourceUuid === sourceUuid) {
          ids.add(String(item.id));
        }
      }
    }

    for (const item of this.actor.items ?? []) {
      if (item?.type !== "history") continue;
      const itemSlotIndex = Number(item.getFlag?.("fs2e", "historySlotIndex"));
      if (Number.isInteger(itemSlotIndex) && itemSlotIndex === slotIndex) {
        ids.add(String(item.id));
      }
    }

    return [...ids].filter(Boolean);
  }

  async _deleteHistorySlotLinkedItems(slotIndex, slotEntryOverride = null) {
    const slots = this._readHistorySlots();
    const slotEntry = slotEntryOverride ?? slots[slotIndex] ?? {};
    const ids = this._collectHistorySlotLinkedItemIds(slotIndex, slotEntry);
    const idSet = new Set(ids.map((id) => String(id)));

    const removedPairs = new Map();
    for (const pair of normalizeLearnedSkillPairs(slotEntry?.grantedSkills)) {
      const token = `${pair.groupKey.toLowerCase()}.${pair.childKey.toLowerCase()}`;
      if (!removedPairs.has(token)) removedPairs.set(token, pair);
    }

    for (const item of this.actor.items ?? []) {
      if (item?.type !== "history") continue;
      if (!idSet.has(String(item.id))) continue;
      const flaggedPairs = normalizeLearnedSkillPairs(item.getFlag?.("fs2e", "grantedLearnedSkills"));
      const itemPairs = flaggedPairs.length ? flaggedPairs : extractLearnedChildSkillPairsFromSystem(item.system ?? {});
      for (const pair of itemPairs) {
        const token = `${pair.groupKey.toLowerCase()}.${pair.childKey.toLowerCase()}`;
        if (!removedPairs.has(token)) removedPairs.set(token, pair);
      }
    }

    if (ids.length) {
      await this.actor.deleteEmbeddedDocuments("Item", ids);
    }

    await this._removeLearnedSkillPairsIfUnreferenced([...removedPairs.values()], idSet);
  }

  async _setHistorySlot(slotIndex, item, { sourceUuid = "", grantedSkills = [] } = {}) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= HISTORY_SLOT_LABELS.length) return;
    const slots = this._readHistorySlots();
    slots[slotIndex] = {
      id: String(item?.id ?? "").trim(),
      uuid: String(item?.uuid ?? "").trim(),
      sourceUuid: String(sourceUuid ?? "").trim(),
      name: String(item?.name ?? "").trim(),
      grantedSkills: normalizeLearnedSkillPairs(grantedSkills)
    };
    await this.actor.setFlag("fs2e", "historySlots", slots);
  }

  async _clearHistorySlot(slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= HISTORY_SLOT_LABELS.length) return;
    const slots = this._readHistorySlots();
    const previousSlot = foundry.utils.deepClone(slots[slotIndex] ?? {});
    slots[slotIndex] = { id: "", uuid: "", sourceUuid: "", name: "", grantedSkills: [] };
    await this.actor.setFlag("fs2e", "historySlots", slots);
    await this._deleteHistorySlotLinkedItems(slotIndex, previousSlot);
  }

  async _onDropHistory(event, slotIndex) {
    event?.stopPropagation?.();

    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= HISTORY_SLOT_LABELS.length) {
      ui.notifications?.warn("Invalid history slot.");
      return;
    }

    const dropData = TextEditor.getDragEventData(event);
    if (!dropData) return;

    const itemDoc = await Item.implementation.fromDropData(dropData);
    if (!itemDoc) return;
    if (itemDoc.type !== "history") {
      ui.notifications?.warn("Only History items are allowed in history slots.");
      return;
    }

    const slot = getHistorySlotDefinitions()[slotIndex];
    if (!this._historyItemMatchesSlot(itemDoc, slotIndex)) {
      const accepted = Array.isArray(slot?.acceptedTags) && slot.acceptedTags.length
        ? slot.acceptedTags.join(" / ")
        : slot?.label ?? "this";
      ui.notifications?.warn(`Only ${accepted} histories can be dropped in this slot.`);
      return;
    }

    await this._deleteHistorySlotLinkedItems(slotIndex);

    const createData = itemDoc.toObject();
    createData.flags = createData.flags ?? {};
    createData.flags.fs2e = {
      ...(createData.flags.fs2e ?? {}),
      historySlotIndex: slotIndex,
      historySourceUuid: String(itemDoc.uuid ?? "").trim()
    };
    const resolvedSystem = await resolveHistoryCharacteristicAdjustments({
      actor: this.actor,
      itemName: itemDoc.name,
      slotLabel: slot?.label,
      system: createData.system ?? {}
    });
    if (!resolvedSystem) return;

    const parentSkillChoices = Array.isArray(resolvedSystem.__fs2eParentSkillChoices)
      ? resolvedSystem.__fs2eParentSkillChoices
      : [];
    delete resolvedSystem.__fs2eParentSkillChoices;
    createData.system = resolvedSystem;
    delete createData._id;
    const [created] = await this.actor.createEmbeddedDocuments("Item", [createData]);
    if (!created) return;

    const grantedLearnedSkills = normalizeLearnedSkillPairs([
      ...parentSkillChoices,
      ...extractLearnedChildSkillPairsFromSystem(resolvedSystem)
    ]);
    if (grantedLearnedSkills.length) {
      await created.setFlag("fs2e", "grantedLearnedSkills", grantedLearnedSkills);
    }

    await this._setHistorySlot(slotIndex, created, {
      sourceUuid: itemDoc.uuid ?? "",
      grantedSkills: grantedLearnedSkills
    });

    const displayMap = extractLearnedChildSkillDisplayMapFromSystem(resolvedSystem);
    for (const pair of grantedLearnedSkills) {
      const groupKey = String(pair?.groupKey ?? "").trim();
      const childKey = String(pair?.childKey ?? "").trim();
      const token = `${groupKey.toLowerCase()}.${childKey.toLowerCase()}`;
      const fallbackPromptChoice = parentSkillChoices.find((choice) =>
        String(choice?.groupKey ?? "").trim().toLowerCase() === groupKey.toLowerCase()
        && String(choice?.childKey ?? "").trim().toLowerCase() === childKey.toLowerCase()
      );
      const display = String(
        displayMap.get(token)
        ?? fallbackPromptChoice?.display
        ?? formatSkillLabel(childKey)
      ).trim();
      const amount = Number(pair?.amount ?? fallbackPromptChoice?.amount ?? 0);
      if (!groupKey || !childKey || !display) continue;
      await this._createLearnedGroupSkill(groupKey, childKey, display, amount);
    }

    // Guard against immediate duplicate sheet-level drop processing after handled history-slot drops.
    this._lastHandledHistoryDropAt = Date.now();
  }

  async _onDropItemCreate(itemData) {
    const sourceItems = Array.isArray(itemData) ? itemData : [itemData];
    const hasHistory = sourceItems.some((entry) => String(entry?.type ?? "").trim() === "history");
    const lastHistoryDropAt = Number(this._lastHandledHistoryDropAt ?? 0);
    if (hasHistory && Date.now() - lastHistoryDropAt < 1500) {
      return [];
    }

    const resolvedItems = [];
    const pendingParentSkillChoices = [];

    for (const source of sourceItems) {
      const next = foundry.utils.deepClone(source ?? {});
      if (next && typeof next === "object" && next.system && typeof next.system === "object") {
        const resolvedSystem = await resolveHistoryCharacteristicAdjustments({
          actor: this.actor,
          itemName: String(next.name ?? "").trim(),
          slotLabel: "",
          system: next.system
        });
        if (!resolvedSystem) continue;

        const parentSkillChoices = Array.isArray(resolvedSystem.__fs2eParentSkillChoices)
          ? resolvedSystem.__fs2eParentSkillChoices
          : [];
        delete resolvedSystem.__fs2eParentSkillChoices;
        pendingParentSkillChoices.push(...parentSkillChoices);

        next.system = resolvedSystem;
      }
      resolvedItems.push(next);
    }

    if (!resolvedItems.length) return [];
    const created = await super._onDropItemCreate(Array.isArray(itemData) ? resolvedItems : resolvedItems[0]);

    for (const choice of pendingParentSkillChoices) {
      const groupKey = String(choice?.groupKey ?? "").trim();
      const childKey = String(choice?.childKey ?? "").trim();
      const display = String(choice?.display ?? "").trim() || formatSkillLabel(childKey);
      const amount = Number(choice?.amount ?? 0);
      if (!groupKey || !childKey || !display) continue;
      await this._createLearnedGroupSkill(groupKey, childKey, display, amount);
    }

    return created;
  }

  async _promptLearnedGroupSkill(groupKey, optionLabels = []) {
    const groupLabel = formatSkillLabel(groupKey) || "Skill";
    const options = uniqueCaseInsensitive(optionLabels);
    const selectOptions = options
      .map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`)
      .join("");
    const selectId = `fs2e-group-skill-${Math.random().toString(36).slice(2)}`;
    const inputId = `${selectId}-custom`;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      let dialog = null;
      dialog = new Dialog({
        title: `${groupLabel} Specialization`,
        content: `
          <form class="fs2e-group-skill-dialog">
            <div class="form-group">
              <label for="${selectId}">Suggested</label>
              <select id="${selectId}">
                <option value="">Choose...</option>
                ${selectOptions}
              </select>
            </div>
            <div class="form-group">
              <label for="${inputId}">Custom</label>
              <input id="${inputId}" type="text" placeholder="Enter specialization" autocomplete="off" />
            </div>
          </form>
        `,
        buttons: {
          apply: {
            label: "Apply",
            callback: (html) => {
              const root = html?.[0];
              const chosen = String(root?.querySelector(`#${selectId}`)?.value ?? "").trim();
              const custom = String(root?.querySelector(`#${inputId}`)?.value ?? "").trim();
              const display = custom || chosen;
              const skillKey = normalizeSkillKey(display);
              if (!display || !skillKey) return finish(null);
              return finish({ skillKey, display });
            }
          },
          cancel: {
            label: "Cancel",
            callback: () => finish(null)
          }
        },
        default: "apply",
        close: () => finish(null)
      }, {
        classes: ["fs2e", "dialog"],
        width: 420,
        height: "auto"
      });
      dialog.render(true);
    });
  }

  async _createLearnedGroupSkill(groupKey, childKey, display, amount = 0) {
    const normalizedGroupKey = String(groupKey ?? "").trim();
    const normalizedChildKey = normalizeSkillKey(childKey);
    const displayLabel = String(display ?? "").trim();
    const numericAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    if (!normalizedGroupKey || !normalizedChildKey || !displayLabel) return;

    const learned = foundry.utils.deepClone(this.actor.system?.skills?.learned ?? {});
    const groupRaw = learned?.[normalizedGroupKey];
    const group = isLearnedGroupContainer(groupRaw) ? groupRaw : {};

    const existingEntry = Object.keys(group).find((key) => String(key).toLowerCase() === normalizedChildKey.toLowerCase());
    if (existingEntry) {
      const current = group[existingEntry] ?? {};
      group[existingEntry] = {
        ...current,
        display: displayLabel,
        history: numericAmount
      };
      await this.actor.update({ [`system.skills.learned.${normalizedGroupKey}`]: group });
      return;
    }

    group[normalizedChildKey] = {
      base: 0,
      mod: 0,
      temp: 0,
      max: 8,
      history: numericAmount,
      xp: 0,
      roll: 0,
      display: displayLabel
    };

    await this.actor.update({ [`system.skills.learned.${normalizedGroupKey}`]: group });
  }

  async _removeLearnedGroupSkill(groupKey, childKey) {
    const normalizedGroupKey = String(groupKey ?? "").trim();
    const normalizedChildKey = String(childKey ?? "").trim().toLowerCase();
    if (!normalizedGroupKey || !normalizedChildKey) return;

    const learned = foundry.utils.deepClone(this.actor.system?.skills?.learned ?? {});
    const group = isLearnedGroupContainer(learned?.[normalizedGroupKey])
      ? learned[normalizedGroupKey]
      : null;
    if (!group) return;

    const actualChildKey = Object.keys(group).find((key) => String(key).toLowerCase() === normalizedChildKey);
    if (!actualChildKey) return;

    delete group[actualChildKey];
    await this.actor.update({ [`system.skills.learned.${normalizedGroupKey}`]: group });
  }
}
