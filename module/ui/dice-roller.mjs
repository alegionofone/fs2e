import { SKILL_DEFINITIONS_BY_KEY } from "../global/skills/definitions.mjs";
import { formatSkillLabel } from "../global/skills/group-specializations.mjs";
import { createSkillRollChatMessage } from "./chat/roll-chat-card.mjs";

const DIFFICULTY_OPTIONS = [
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

const QUALITY_BANDS = [
  { min: 1, max: 2, vp: 1, label: "Barely Satisfactory" },
  { min: 3, max: 5, vp: 1, label: "Mediocre" },
  { min: 6, max: 8, vp: 2, label: "Pretty Good" },
  { min: 9, max: 11, vp: 3, label: "Good" },
  { min: 12, max: 14, vp: 4, label: "Excellent" },
  { min: 15, max: 17, vp: 5, label: "Brilliant" },
  { min: 18, max: 20, vp: 6, label: "Virtuoso" }
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

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const formatCharacteristicLabel = (key) => {
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

const getSkillDefinitionForKey = (skillKey) => {
  const token = String(skillKey ?? "").trim();
  if (!token) return {};
  if (SKILL_DEFINITIONS_BY_KEY[token]) return SKILL_DEFINITIONS_BY_KEY[token];
  const tail = token.includes(".") ? token.split(".").pop() : token;
  return SKILL_DEFINITIONS_BY_KEY[tail] ?? {};
};

const isStatRecord = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return ["base", "mod", "temp", "history", "xp", "max", "roll", "granted", "total"].some((key) =>
    Object.prototype.hasOwnProperty.call(value, key)
  );
};

const statTotal = (stat) => {
  const explicit = Number(stat?.total);
  if (Number.isFinite(explicit)) return explicit;
  return ["base", "mod", "temp", "history", "xp", "granted"]
    .map((key) => toNumber(stat?.[key]))
    .reduce((acc, value) => acc + value, 0);
};

const statTrait = (stat) => ["base", "history", "xp"]
  .map((key) => toNumber(stat?.[key]))
  .reduce((acc, value) => acc + value, 0);

const getWoundPenalty = (actor) => {
  const vitality = actor?.system?.vitality;
  const base = Math.max(0, toNumber(vitality?.base));
  const value = Math.max(0, toNumber(vitality?.value, base));
  return -2 * Math.max(0, base - value);
};

const getCharacteristicOptions = (actor, preferred = "") => {
  const root = actor?.system?.characteristics;
  if (!root || typeof root !== "object") return [];

  const out = [];
  for (const group of Object.values(root)) {
    if (!group || typeof group !== "object" || Array.isArray(group)) continue;
    for (const [key, stat] of Object.entries(group)) {
      if (!isStatRecord(stat)) continue;
      out.push({ key, label: formatCharacteristicLabel(key), total: statTotal(stat), selectedMain: false, selectedComp: false });
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

const getSkillOptions = (actor, selectedSkillKey = "") => {
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
        total: statTotal(stat),
        trait: statTrait(stat),
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
          total: statTotal(value),
          trait: statTrait(value),
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
          total: statTotal(childValue),
          trait: statTrait(childValue),
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

const getBaseVpOutcome = (successes) => {
  const band = QUALITY_BANDS.find((entry) => successes >= entry.min && successes <= entry.max);
  if (band) return { vp: band.vp, quality: band.label };
  if (successes >= 21) {
    const vp = 6 + Math.ceil((successes - 20) / 3);
    return { vp, quality: "Virtuoso" };
  }
  return { vp: 0, quality: "Failure" };
};

const getAccentedVpOutcome = (successes, accent = 0) => {
  if (!successes || successes <= 0) return { vp: 0, quality: "Failure" };
  if (accent > 0) {
    const vp = Math.max(1, Math.floor((successes + 1) / 2));
    return { vp, quality: "Accented (+)" };
  }
  if (accent < 0) {
    const vp = Math.max(1, Math.floor((successes + 3) / 4));
    return { vp, quality: "Accented (-)" };
  }
  return getBaseVpOutcome(successes);
};

const getVpOutcome = (successes, goalNumber, critSuccess, accent = 0) => {
  if (!successes || successes <= 0) return { vp: 0, quality: "Failure" };

  const baseResult = getAccentedVpOutcome(successes, accent);
  const baseVp = Number(baseResult.vp ?? 0);
  const quality = baseResult.quality ?? "Failure";
  const extendedBonus = goalNumber > 20 ? Math.floor((goalNumber - 21) / 3) + 1 : 0;
  const total = critSuccess ? (baseVp + extendedBonus) * 2 : (baseVp + extendedBonus);

  return { vp: total, quality: critSuccess ? "Critical Success" : quality };
};

const rollCheck = async ({ gn, accent = 0 }) => {
  const roll = await (new Roll("1d20")).roll({ async: true });
  const die = toNumber(roll.total);
  const adjustedRoll = die + accent;
  const critSuccess = adjustedRoll === gn;
  const critFailure = die === 20 && adjustedRoll > gn;
  const success = adjustedRoll <= gn;
  const successes = success ? Math.max(1, adjustedRoll) : 0;
  const vpResult = getVpOutcome(successes, gn, critSuccess, accent);
  return {
    die,
    adjustedRoll,
    accent,
    critSuccess,
    critFailure,
    success,
    successes,
    vp: critFailure ? 0 : vpResult.vp,
    quality: critFailure ? "Critical Failure" : vpResult.quality
  };
};

const findTargetOwner = (actor) => {
  const owner = game.users?.find((user) => user.active && actor?.testUserPermission?.(user, "OWNER"));
  return owner ?? game.users?.find((user) => user.active && user.isGM) ?? game.user ?? null;
};

const postContestedChat = async ({ attacker, attackerResult, defender, defenderResult }) => {
  const attackerAccent = toNumber(attackerResult?.accent, 0);
  const defenderAccent = toNumber(defenderResult?.accent, 0);
  const attackerEffective = attackerResult.critSuccess
    ? (attackerResult.successes ?? 0) * 2
    : (attackerResult.successes ?? 0);
  const defenderEffective = defenderResult.critSuccess
    ? (defenderResult.successes ?? 0) * 2
    : (defenderResult.successes ?? 0);

  const netSuccesses = attackerEffective - defenderEffective;
  const success = netSuccesses > 0;
  const outcome = success
    ? getVpOutcome(netSuccesses, attackerResult.gn ?? 0, !!attackerResult.critSuccess, attackerResult.accent ?? 0)
    : { vp: 0, quality: "Failure" };

  const html = await renderTemplate("systems/fs2e/templates/chat/contested-card.hbs", {
    attacker: {
      title: attackerResult.skillLabel ? `${attackerResult.skillLabel} Roll` : "Roll",
      actorName: attacker?.name ?? "",
      actorImg: attacker?.img ?? "",
      roll: attackerResult.roll,
      rollAdjusted: attackerResult.rollAdjusted,
      accent: attackerAccent,
      gn: attackerResult.gn,
      breakdown: attackerResult.breakdown ?? []
    },
    defender: {
      title: defenderResult.skillLabel ? `${defenderResult.skillLabel} Roll` : "Roll",
      actorName: defender?.name ?? "",
      actorImg: defender?.img ?? "",
      roll: defenderResult.roll,
      rollAdjusted: defenderResult.rollAdjusted,
      accent: defenderAccent,
      gn: defenderResult.gn,
      breakdown: defenderResult.breakdown ?? []
    },
    outcome: {
      success,
      successes: success ? netSuccesses : 0,
      vp: success ? outcome.vp : 0,
      quality: attackerResult.critFailure ? "Critical Failure" : outcome.quality
    }
  });

  await ChatMessage.create({
    user: game.user?.id,
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: html
  });
};

const readSelectNumber = (root, selector) => toNumber(root.querySelector(selector)?.selectedOptions?.[0]?.dataset?.value);
const readInputNumber = (root, selector) => toNumber(root.querySelector(selector)?.value);
const readCheckedRadioNumber = (root, name, fallback = 0) => {
  const checked = root.querySelector(`input[name='${name}']:checked`);
  return checked ? toNumber(checked.value, fallback) : fallback;
};

const getActionPenalty = (actions) => (actions === 2 ? -4 : (actions >= 3 ? -6 : 0));
const getRetryPenalty = (retries) => (retries === 1 ? -2 : (retries >= 2 ? -4 : 0));

const buildGoalNumber = ({ skillValue, characteristicValue, difficulty, woundPenalty = 0, complementaryVp = 0 }) =>
  skillValue + characteristicValue + difficulty + woundPenalty + complementaryVp;

const getSkillTotalByKey = (actor, skillKey) => {
  const token = String(skillKey ?? "").trim();
  if (!token) return 0;
  const skill = getSkillOptions(actor, token).find((entry) => entry.key === token);
  return skill ? toNumber(skill.total) : 0;
};

const getSkillTraitByKey = (actor, skillKey) => {
  const token = String(skillKey ?? "").trim();
  if (!token) return 0;
  const skill = getSkillOptions(actor, token).find((entry) => entry.key === token);
  return skill ? toNumber(skill.trait) : 0;
};

const getCharacteristicTotalByKey = (actor, characteristicKey) => {
  const token = String(characteristicKey ?? "").trim();
  if (!token) return 0;
  const characteristic = getCharacteristicOptions(actor, token).find((entry) => entry.key === token);
  return characteristic ? toNumber(characteristic.total) : 0;
};

export const rollFromPreset = async ({ actor, preset }) => {
  if (!actor || !preset) return null;

  const skillKey = String(preset.skillKey ?? "").trim();
  const characteristicKey = String(preset.characteristicKey ?? "").trim();
  if (!skillKey || !characteristicKey) return null;

  const skillValue = getSkillTotalByKey(actor, skillKey);
  const skillTrait = getSkillTraitByKey(actor, skillKey);
  const characteristicValue = getCharacteristicTotalByKey(actor, characteristicKey);
  const skillDef = getSkillDefinitionForKey(skillKey);
  const skillLabel = getSkillOptions(actor, skillKey).find((entry) => entry.key === skillKey)?.label ?? skillDef.label ?? formatSkillLabel(skillKey);
  const characteristicLabel = formatCharacteristicLabel(characteristicKey);
  const diffBase = toNumber(preset.diffValue);
  const customDiff = toNumber(preset.customDiff);
  const difficulty = diffBase + customDiff;
  const actions = toNumber(preset.actions, 1);
  const retries = toNumber(preset.retries, 0);
  const actionPenalty = getActionPenalty(actions);
  const retryPenalty = getRetryPenalty(retries);
  const penaltyTotal = actionPenalty + retryPenalty;
  const woundPenalty = getWoundPenalty(actor);
  const complementaryVp = toNumber(preset.compVp, 0);
  const accentMax = Math.max(0, skillTrait);
  const accent = clamp(toNumber(preset.accent, 0), -accentMax, accentMax);
  const gn = buildGoalNumber({
    skillValue,
    characteristicValue,
    difficulty,
    woundPenalty: woundPenalty + penaltyTotal,
    complementaryVp
  });

  const result = await rollCheck({ gn, accent });
  const sustainEnabled = !!preset.sustainEnabled;
  const sustainTask = Math.max(0, toNumber(preset.sustainTask));
  const sustainCurrent = Math.max(0, toNumber(preset.sustainCurrent));
  const sustainTotal = sustainEnabled ? sustainCurrent + result.vp : result.vp;
  const sustainCompleted = sustainEnabled && sustainTask > 0 && sustainTotal >= sustainTask;

  const breakdown = [
    { label: `${characteristicLabel} + ${skillLabel}`, value: `${characteristicValue} + ${skillValue} = ${characteristicValue + skillValue}` },
    { label: "Difficulty", value: `${difficulty}` },
    { label: "Multi-action", value: `${actionPenalty}` },
    { label: "Retry", value: `${retryPenalty}` },
    { label: "Wound penalty", value: `${woundPenalty}` },
    { label: "Temp bonus", value: "0" },
    { label: "Accent", value: `${accent}` },
    { label: "Complementary VP", value: `${complementaryVp}` }
  ];

  const sustainData = sustainEnabled
    ? { task: sustainTask, current: sustainCurrent, total: sustainTotal, completed: sustainCompleted }
    : null;

  await createSkillRollChatMessage({
    actor,
    skillLabel,
    characteristicLabel,
    result,
    gn,
    breakdown,
    complementary: skillDef.complementary ?? "",
    sustain: sustainData,
    preset: {
      ...preset,
      actorUuid: actor.uuid,
      skillKey,
      characteristicKey,
      diffValue: diffBase,
      customDiff,
      actions,
      retries,
      accent,
      compVp: complementaryVp,
      sustainEnabled,
      sustainTask,
      sustainCurrent: sustainEnabled ? sustainTotal : 0
    }
  });

  return { result, sustain: sustainData };
};

export const openSkillRollDialog = async ({ actor, skillKey, preset = null }) => {
  if (!actor) return;

  const contestedResponder = !!preset?.contestedResponder;
  const contestedRequest = preset?.contestedRequest ?? null;

  const initialSkillKey = String(skillKey ?? "").trim();
  const skills = getSkillOptions(actor, initialSkillKey);
  if (!skills.length) {
    ui.notifications?.warn?.("This skill is not rollable yet on this actor.");
    return;
  }

  const selectedSkill = skills.find((entry) => entry.selected) ?? skills[0];
  if (!selectedSkill) return;

  const characteristics = getCharacteristicOptions(actor, selectedSkill.defaultCharacteristic);
  if (!characteristics.length) {
    ui.notifications?.warn?.("No rollable characteristics found on actor.");
    return;
  }

  const dialogTitle = contestedResponder
    ? (() => {
      const attackerSkill = String(contestedRequest?.attackerResult?.skillLabel ?? "").trim();
      return attackerSkill ? `Contested ${attackerSkill}` : "Contested Roll";
    })()
    : `${selectedSkill.label} Roll`;

  const contestedAvailable = !contestedResponder && ((game.user?.targets?.size ?? 0) > 0);
  const content = await renderTemplate("systems/fs2e/templates/dialogs/dice-roller.hbs", {
    title: dialogTitle,
    subtitle: selectedSkill.complementary ? `Complementary: ${selectedSkill.complementary}` : "",
    selectedSkillLabel: selectedSkill.label,
    selectedSkillTotal: selectedSkill.total,
    selectedSkillTrait: selectedSkill.trait,
    skills,
    characteristics,
    difficulties: DIFFICULTY_OPTIONS,
    contestedAvailable,
    contestedEnabled: preset?.contestedEnabled ?? contestedAvailable,
    contestedResponder
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

        const state = {
          complementaryVp: 0,
          complementaryText: ""
        };

        const applySectionCollapsedState = () => {
          root.querySelectorAll(".fs2e-section[data-section-id]").forEach((section) => {
            const collapsed = section.dataset.collapsed === "1";
            const heading = section.querySelector(".fs2e-section-heading[data-section-toggle]");
            if (heading) heading.setAttribute("aria-expanded", collapsed ? "false" : "true");
          });
        };

        root.querySelectorAll(".fs2e-section-heading[data-section-toggle]").forEach((heading) => {
          const toggle = () => {
            const section = heading.closest(".fs2e-section");
            if (!section) return;
            section.dataset.collapsed = section.dataset.collapsed === "1" ? "0" : "1";
            applySectionCollapsedState();
            dialog?.setPosition({ height: "auto" });
          };

          heading.addEventListener("click", (event) => {
            event.preventDefault();
            toggle();
          });

          heading.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            toggle();
          });
        });

        const updatePreview = () => {
          const mainSkillSelect = root.querySelector("#fs2e-main-skill");
          const skillValue = mainSkillSelect
            ? toNumber(mainSkillSelect.selectedOptions?.[0]?.dataset?.value)
            : readInputNumber(root, "#fs2e-main-skill-value");
          const skillTrait = mainSkillSelect
            ? toNumber(mainSkillSelect.selectedOptions?.[0]?.dataset?.trait)
            : readInputNumber(root, "#fs2e-main-skill-trait");
          const characteristicValue = readSelectNumber(root, "#fs2e-main-char");
          const difficulty = readInputNumber(root, "#fs2e-main-diff-base") + readInputNumber(root, "#fs2e-main-diff-custom");
          const actions = readCheckedRadioNumber(root, "fs2e-actions", 1);
          const retries = readCheckedRadioNumber(root, "fs2e-retries", 0);
          const actionPenalty = getActionPenalty(actions);
          const retryPenalty = getRetryPenalty(retries);
          const penaltyTotal = actionPenalty + retryPenalty;
          const woundPenalty = getWoundPenalty(actor);
          const mainBaseGn = skillValue + characteristicValue;

          const gn = buildGoalNumber({
            skillValue,
            characteristicValue,
            difficulty,
            woundPenalty: woundPenalty + penaltyTotal,
            complementaryVp: state.complementaryVp
          });
          const accentMax = Math.max(0, skillTrait);

          const contestedEnabled = !!root.querySelector("#fs2e-contested-toggle")?.checked;
          const compEnabled = !!root.querySelector("#fs2e-comp-toggle")?.checked;
          const sustainEnabled = !contestedEnabled && !!root.querySelector("#fs2e-sustain-toggle")?.checked;
          const compSection = root.querySelector(".fs2e-comp-section");
          const sustainSection = root.querySelector(".fs2e-sustain-section");
          const sustainGroup = root.querySelector(".fs2e-roll-mode-group-sustain");
          if (compSection) compSection.dataset.enabled = compEnabled ? "1" : "0";
          if (sustainSection) sustainSection.dataset.enabled = sustainEnabled ? "1" : "0";
          if (sustainGroup) sustainGroup.dataset.enabled = contestedEnabled ? "0" : "1";

          const sustainToggle = root.querySelector("#fs2e-sustain-toggle");
          if (contestedEnabled && sustainToggle) sustainToggle.checked = false;

          if (!compEnabled && state.complementaryVp !== 0) {
            state.complementaryVp = 0;
            state.complementaryText = "";
            const resultNode = root.querySelector("#fs2e-comp-result");
            if (resultNode) resultNode.textContent = "";
          }

          const compSkillValue = readSelectNumber(root, "#fs2e-comp-skill");
          const compCharacteristicValue = readSelectNumber(root, "#fs2e-comp-char");
          const compDifficulty = readInputNumber(root, "#fs2e-comp-diff-base") + readInputNumber(root, "#fs2e-comp-diff-custom");
          const compBaseGn = compSkillValue + compCharacteristicValue;
          const compGn = buildGoalNumber({
            skillValue: compSkillValue,
            characteristicValue: compCharacteristicValue,
            difficulty: compDifficulty,
            woundPenalty,
            complementaryVp: 0
          });

          const mainBaseInput = root.querySelector("#fs2e-main-char-gn");
          const mainWoundInput = root.querySelector("#fs2e-wound-penalty");
          const finalInput = root.querySelector("#fs2e-final-tn");
          const compVpInput = root.querySelector("#fs2e-comp-vp-total");
          const compBaseInput = root.querySelector("#fs2e-comp-char-gn");
          const compWoundInput = root.querySelector("#fs2e-comp-wound-penalty");
          const compFinalInput = root.querySelector("#fs2e-comp-final-tn");
          const mainDiffGnInput = root.querySelector("#fs2e-main-diff-gn");
          const compDiffGnInput = root.querySelector("#fs2e-comp-diff-gn");
          const sustainRequiredInput = root.querySelector("#fs2e-sustain-required");
          const penaltyTotalInput = root.querySelector("#fs2e-penalty-total");
          const sustainTask = readInputNumber(root, "#fs2e-sustain-task");

          if (mainBaseInput) mainBaseInput.value = String(mainBaseGn);
          if (mainWoundInput) mainWoundInput.value = String(woundPenalty);
          if (penaltyTotalInput) penaltyTotalInput.value = String(penaltyTotal);
          if (mainDiffGnInput) mainDiffGnInput.value = String(difficulty);
          if (compVpInput) compVpInput.value = String(state.complementaryVp);
          if (finalInput) finalInput.value = String(gn);
          if (compBaseInput) compBaseInput.value = String(compBaseGn);
          if (compWoundInput) compWoundInput.value = String(woundPenalty);
          if (compDiffGnInput) compDiffGnInput.value = String(compDifficulty);
          if (compFinalInput) compFinalInput.value = String(compGn);
          if (sustainRequiredInput) sustainRequiredInput.value = String(sustainTask);

          const accentInput = root.querySelector("#fs2e-accent-value");
          if (accentInput) {
            const accentValue = toNumber(accentInput.value, 0);
            accentInput.value = String(clamp(accentValue, -accentMax, accentMax));
          }
        };

        const readMainRollConfig = () => {
          const characteristicSelect = root.querySelector("#fs2e-main-char");
          const mainSkillSelect = root.querySelector("#fs2e-main-skill");
          const selectedSkillKey = String(mainSkillSelect?.value ?? selectedSkill.key).trim();
          const selectedSkillDef = getSkillDefinitionForKey(selectedSkillKey) ?? getSkillDefinitionForKey(selectedSkill.key);
          const skillLabel = mainSkillSelect
            ? String(mainSkillSelect.selectedOptions?.[0]?.textContent ?? "").trim()
            : (selectedSkillDef.label ?? selectedSkill.label);
          const characteristicKey = String(characteristicSelect?.value ?? "").trim();
          const charLabel = String(characteristicSelect?.selectedOptions?.[0]?.textContent ?? "").trim();
          const skillValue = mainSkillSelect
            ? toNumber(mainSkillSelect.selectedOptions?.[0]?.dataset?.value)
            : readInputNumber(root, "#fs2e-main-skill-value");
          const skillTrait = mainSkillSelect
            ? toNumber(mainSkillSelect.selectedOptions?.[0]?.dataset?.trait)
            : readInputNumber(root, "#fs2e-main-skill-trait");
          const characteristicValue = readSelectNumber(root, "#fs2e-main-char");
          const difficulty = readInputNumber(root, "#fs2e-main-diff-base") + readInputNumber(root, "#fs2e-main-diff-custom");
          const actions = readCheckedRadioNumber(root, "fs2e-actions", 1);
          const retries = readCheckedRadioNumber(root, "fs2e-retries", 0);
          const actionPenalty = getActionPenalty(actions);
          const retryPenalty = getRetryPenalty(retries);
          const penaltyTotal = actionPenalty + retryPenalty;
          const woundPenalty = getWoundPenalty(actor);
          const gn = buildGoalNumber({
            skillValue,
            characteristicValue,
            difficulty,
            woundPenalty: woundPenalty + penaltyTotal,
            complementaryVp: state.complementaryVp
          });
          const accentMax = Math.max(0, skillTrait);
          const accentValue = toNumber(root.querySelector("#fs2e-accent-value")?.value, 0);
          const accent = clamp(accentValue, -accentMax, accentMax);

          const skillKeyLocal = selectedSkillKey || selectedSkill.key;
          const skillDef = getSkillDefinitionForKey(skillKeyLocal) ?? selectedSkillDef;
          return {
            skillKey: skillKeyLocal,
            skillLabel,
            characteristicKey,
            characteristicLabel: charLabel,
            skillValue,
            characteristicValue,
            difficulty,
            actionPenalty,
            retryPenalty,
            penaltyTotal,
            woundPenalty,
            accent,
            gn,
            complementary: skillDef.complementary ?? ""
          };
        };

        const readCompRollConfig = () => {
          const skillSelect = root.querySelector("#fs2e-comp-skill");
          const characteristicSelect = root.querySelector("#fs2e-comp-char");
          const skillLabel = String(skillSelect?.selectedOptions?.[0]?.textContent ?? "").trim();
          const charLabel = String(characteristicSelect?.selectedOptions?.[0]?.textContent ?? "").trim();
          const skillValue = readSelectNumber(root, "#fs2e-comp-skill");
          const characteristicValue = readSelectNumber(root, "#fs2e-comp-char");
          const difficulty = readInputNumber(root, "#fs2e-comp-diff-base") + readInputNumber(root, "#fs2e-comp-diff-custom");
          const woundPenalty = getWoundPenalty(actor);
          const gn = buildGoalNumber({ skillValue, characteristicValue, difficulty, woundPenalty, complementaryVp: 0 });
          return {
            skillLabel,
            characteristicLabel: charLabel,
            skillValue,
            characteristicValue,
            difficulty,
            woundPenalty,
            gn
          };
        };

        root.querySelector("[data-action='roll-comp']")?.addEventListener("click", async (event) => {
          event.preventDefault();
          if (!root.querySelector("#fs2e-comp-toggle")?.checked) return;

          const config = readCompRollConfig();
          const result = await rollCheck({ gn: config.gn, accent: 0 });
          state.complementaryVp = result.vp;
          state.complementaryText = `${config.skillLabel}: d20 ${result.die} vs ${config.gn}, VP ${result.vp} (${result.quality})`;
          const resultNode = root.querySelector("#fs2e-comp-result");
          if (resultNode) resultNode.textContent = state.complementaryText;
          updatePreview();
        });

        root.querySelector("[data-action='roll-main']")?.addEventListener("click", async (event) => {
          event.preventDefault();
          const config = readMainRollConfig();
          const result = await rollCheck({ gn: config.gn, accent: config.accent });

          const contestedEnabled = !!root.querySelector("#fs2e-contested-toggle")?.checked;
          const sustainEnabled = !contestedEnabled && !!root.querySelector("#fs2e-sustain-toggle")?.checked;
          const sustainTask = Math.max(0, readInputNumber(root, "#fs2e-sustain-task"));
          const sustainCurrent = Math.max(0, readInputNumber(root, "#fs2e-sustain-current"));
          const sustainTotal = sustainEnabled ? sustainCurrent + result.vp : result.vp;
          const sustainCompleted = sustainEnabled && sustainTask > 0 && sustainTotal >= sustainTask;

          const breakdown = [
            { label: `${config.characteristicLabel} + ${config.skillLabel}`, value: `${config.characteristicValue} + ${config.skillValue} = ${config.characteristicValue + config.skillValue}` },
            { label: "Difficulty", value: `${config.difficulty}` },
            { label: "Multi-action", value: `${config.actionPenalty}` },
            { label: "Retry", value: `${config.retryPenalty}` },
            { label: "Wound penalty", value: `${config.woundPenalty}` },
            { label: "Temp bonus", value: "0" },
            { label: "Accent", value: `${config.accent}` },
            { label: "Complementary VP", value: `${state.complementaryVp}` }
          ];

          if (sustainEnabled) {
            breakdown.push({ label: "Sustained", value: `${sustainCurrent} + ${result.vp} = ${sustainTotal} / ${sustainTask}` });
          }

          const sustainData = sustainEnabled
            ? { task: sustainTask, current: sustainCurrent, total: sustainTotal, completed: sustainCompleted }
            : null;

          if (contestedEnabled && !contestedResponder) {
            const targets = Array.from(game.user?.targets ?? []);
            if (!targets.length) {
              ui.notifications?.warn?.("No valid target for contested roll.");
              return;
            }

            const attackerResult = {
              skillKey: config.skillKey,
              skillLabel: config.skillLabel,
              gn: config.gn,
              roll: result.die,
              rollAdjusted: result.adjustedRoll,
              accent: config.accent,
              success: result.success,
              critSuccess: result.critSuccess,
              critFailure: result.critFailure,
              successes: result.successes,
              breakdown
            };

            let sent = 0;
            const localTargetActors = [];
            for (const target of targets) {
              const targetActor = target?.actor ?? null;
              const owner = targetActor ? findTargetOwner(targetActor) : null;
              if (!targetActor || !owner) continue;

              const requestPayload = {
                type: "contested-request",
                targetUserId: owner.id,
                targetActorUuid: targetActor.uuid,
                attackerUuid: actor.uuid,
                attackerResult
              };

              if (owner.id === game.user?.id) {
                localTargetActors.push({
                  actor: targetActor,
                  preset: {
                    contestedResponder: true,
                    contestedEnabled: false,
                    contestedRequest: {
                      attackerUuid: requestPayload.attackerUuid,
                      attackerResult: requestPayload.attackerResult
                    }
                  }
                });
              } else {
                game.socket?.emit("system.fs2e", requestPayload);
              }
              sent += 1;
            }

            if (!sent) {
              ui.notifications?.warn?.("No valid targets for contested roll.");
              return;
            }

            ui.notifications?.info?.("Contested roll sent to target.");
            finish({ roll: result, sustained: null, contested: true });
            dialog?.close();

            // Open local defender dialogs after attacker dialog closes so the attacker sheet vanishes first.
            for (const entry of localTargetActors) {
              window.setTimeout(() => {
                openSkillRollDialog({ actor: entry.actor, preset: entry.preset });
              }, 0);
            }
            return;
          }

          if (contestedResponder && contestedRequest) {
            const attacker = await fromUuid(contestedRequest.attackerUuid).catch(() => null);
            if (attacker) {
              await postContestedChat({
                attacker,
                attackerResult: contestedRequest.attackerResult,
                defender: actor,
                defenderResult: {
                  skillLabel: config.skillLabel,
                  gn: config.gn,
                  roll: result.die,
                  rollAdjusted: result.adjustedRoll,
                  accent: config.accent,
                  success: result.success,
                  critSuccess: result.critSuccess,
                  critFailure: result.critFailure,
                  successes: result.successes,
                  breakdown
                }
              });
            }

            finish({ roll: result, sustained: null, contested: true });
            dialog?.close();
            return;
          }

          const preset = {
            actorUuid: actor.uuid,
            skillKey: config.skillKey,
            characteristicKey: config.characteristicKey,
            diffValue: readInputNumber(root, "#fs2e-main-diff-base"),
            customDiff: readInputNumber(root, "#fs2e-main-diff-custom"),
            actions: readCheckedRadioNumber(root, "fs2e-actions", 1),
            retries: readCheckedRadioNumber(root, "fs2e-retries", 0),
            accent: config.accent,
            compVp: state.complementaryVp,
            contestedEnabled,
            sustainEnabled,
            sustainTask,
            sustainCurrent: sustainEnabled ? sustainTotal : 0
          };

          await createSkillRollChatMessage({
            actor,
            skillLabel: config.skillLabel,
            characteristicLabel: config.characteristicLabel,
            result,
            gn: config.gn,
            breakdown,
            complementary: [config.complementary, state.complementaryText].filter(Boolean).join(" | "),
            sustain: sustainData,
            preset
          });

          finish({
            roll: result,
            sustained: sustainData
          });
          dialog?.close();
        });

        root.querySelector("[data-action='reset']")?.addEventListener("click", (event) => {
          event.preventDefault();
          state.complementaryVp = 0;
          state.complementaryText = "";

          const compResultNode = root.querySelector("#fs2e-comp-result");
          if (compResultNode) compResultNode.textContent = "";

          const mainDiffCustom = root.querySelector("#fs2e-main-diff-custom");
          const compDiffCustom = root.querySelector("#fs2e-comp-diff-custom");
          const sustainCurrent = root.querySelector("#fs2e-sustain-current");
          if (mainDiffCustom) mainDiffCustom.value = "0";
          if (compDiffCustom) compDiffCustom.value = "0";
          if (sustainCurrent) sustainCurrent.value = "0";

          const mainDiffBase = root.querySelector("#fs2e-main-diff-base");
          const compDiffBase = root.querySelector("#fs2e-comp-diff-base");
          const sustainTask = root.querySelector("#fs2e-sustain-task");
          if (mainDiffBase) mainDiffBase.value = "0";
          if (compDiffBase) compDiffBase.value = "0";
          if (sustainTask) sustainTask.value = "6";

          const actionDefault = root.querySelector("input[name='fs2e-actions'][value='1']");
          const retryDefault = root.querySelector("input[name='fs2e-retries'][value='0']");
          const accentInput = root.querySelector("#fs2e-accent-value");
          if (actionDefault) actionDefault.checked = true;
          if (retryDefault) retryDefault.checked = true;
          if (accentInput) accentInput.value = "0";

          updatePreview();
        });

        root.querySelectorAll(".fs2e-accent-btn").forEach((button) => {
          button.addEventListener("click", (event) => {
            event.preventDefault();
            const input = root.querySelector("#fs2e-accent-value");
            if (!input) return;

            const step = toNumber(event.currentTarget?.dataset?.accentStep, 0);
            const mainSkillSelect = root.querySelector("#fs2e-main-skill");
            const skillValue = mainSkillSelect
              ? toNumber(mainSkillSelect.selectedOptions?.[0]?.dataset?.value)
              : readInputNumber(root, "#fs2e-main-skill-value");
            const skillTrait = mainSkillSelect
              ? toNumber(mainSkillSelect.selectedOptions?.[0]?.dataset?.trait)
              : readInputNumber(root, "#fs2e-main-skill-trait");
            const accentMax = Math.max(0, skillTrait);
            const current = toNumber(input.value, 0);
            input.value = String(clamp(current + step, -accentMax, accentMax));
            updatePreview();
          });
        });

        root.querySelector("[data-action='cancel']")?.addEventListener("click", (event) => {
          event.preventDefault();
          finish(null);
          dialog?.close();
        });

        root.addEventListener("change", () => updatePreview());
        root.addEventListener("input", () => updatePreview());
        applySectionCollapsedState();
        updatePreview();
      },
      close: () => finish(null)
    }, {
      classes: ["fs2e", "dialog", "dice-roller"],
      width: 350,
      height: "auto",
      resizable: true
    });

    dialog.render(true);
  });
};
