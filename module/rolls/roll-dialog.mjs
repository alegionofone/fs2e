import { toNumber } from "../global/derived/shared.mjs";
import { filterActiveHistoryItems } from "../global/derived/shared.mjs";
import { createSkillRollChatMessage } from "/systems/fs2e/module/ui/chat/roll-chat-card.mjs";
import { findTargetOwner, postContestedChat } from "./contested-rolls.mjs";
import { buildGoalNumber, getActionPenalty, getRetryPenalty, rollCheck } from "./roll-engine.mjs";
import {
  DIFFICULTY_OPTIONS,
  formatCharacteristicLabel,
  getCharacteristicOptions,
  getCharacteristicTotalByKey,
  getSkillDefinitionForKey,
  getSkillOptions,
  getSkillTotalByKey,
  getSkillTraitByKey,
  getWoundPenalty
} from "./roll-options.mjs";
import { formatSkillLabel } from "../global/skills/group-specializations.mjs";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;")
  .replaceAll("'", "&#39;");

const readSelectNumber = (root, selector) => toNumber(root.querySelector(selector)?.selectedOptions?.[0]?.dataset?.value);
const readInputNumber = (root, selector) => toNumber(root.querySelector(selector)?.value);
const readCheckedRadioNumber = (root, name, fallback = 0) => {
  const checked = root.querySelector(`input[name='${name}']:checked`);
  return checked ? toNumber(checked.value, fallback) : fallback;
};

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

const readBlessingCurseCategory = (item) => {
  const tags = [
    ...(Array.isArray(item?.system?.tags) ? item.system.tags : []),
    ...(Array.isArray(foundry.utils.getProperty(item, "flags.fs2e.tags")) ? foundry.utils.getProperty(item, "flags.fs2e.tags") : [])
  ]
    .map((entry) => String(entry ?? "").trim().toLowerCase())
    .filter(Boolean);

  if (tags.includes("blessing")) return "Blessing";
  if (tags.includes("curse")) return "Curse";
  return "";
};

const formatBlessingCurseTargetLabel = (target) => {
  const text = String(target ?? "").trim();
  if (!text) return "";

  const [type, key] = text.split(":");
  const normalizedType = String(type ?? "").trim().toLowerCase();
  const normalizedKey = String(key ?? "").trim();
  if (!normalizedKey) return text;

  if (normalizedType === "characteristic") {
    return formatCharacteristicLabel(normalizedKey);
  }

  if (normalizedType === "skill") {
    const def = getSkillDefinitionForKey(normalizedKey);
    return String(def?.label ?? formatSkillLabel(normalizedKey)).trim();
  }

  return text;
};

const parseBlessingCurseAmount = (value) => {
  const text = String(value ?? "").trim().replace(/\s+/g, "");
  if (!text) return 0;
  const match = text.match(/^([+-]?)(\d{1,2})$/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * Number(match[2]);
};

const normalizeTraitText = (value) => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ");

const buildTraitMatchTokens = ({ type = "", key = "", label = "" } = {}) => {
  const normalizedType = normalizeTraitText(type);
  const normalizedKey = normalizeTraitText(key);
  const normalizedLabel = normalizeTraitText(label);
  const tokens = new Set();

  if (normalizedKey) {
    tokens.add(normalizedKey);
    if (normalizedType) tokens.add(`${normalizedType}:${normalizedKey}`);
  }

  if (normalizedLabel) {
    tokens.add(normalizedLabel);
    if (normalizedType) tokens.add(`${normalizedType}:${normalizedLabel}`);
  }

  return tokens;
};

const readBlessingCurseTargetTokens = (target) => {
  const text = String(target ?? "").trim();
  if (!text) return new Set();

  const normalizedText = normalizeTraitText(text);
  const [rawType, ...rawRest] = text.split(":");
  const normalizedType = normalizeTraitText(rawType);
  const normalizedRest = normalizeTraitText(rawRest.join(":"));
  const tokens = new Set([normalizedText]);

  if (normalizedType && normalizedRest) {
    tokens.add(`${normalizedType}:${normalizedRest}`);
    tokens.add(normalizedRest);

    if (normalizedType === "characteristic") {
      tokens.add(normalizeTraitText(formatCharacteristicLabel(normalizedRest)));
    }

    if (normalizedType === "skill") {
      const skillDef = getSkillDefinitionForKey(normalizedRest);
      tokens.add(normalizeTraitText(String(skillDef?.label ?? formatSkillLabel(normalizedRest)).trim()));
    }
  }

  return tokens;
};

const resolveActorBlessingCurseModifiers = async (actor) => {
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

  const entries = normalizeBonusEntries([...historyEntries, ...actorEntries]);
  const resolved = await Promise.all(entries.map(async (entry) => {
    const uuid = String(entry?.uuid ?? "").trim();
    if (!uuid) return null;
    const item = await fromUuid(uuid).catch(() => null);
    if (!item || item.type !== "blessingCurse") return null;

    const amount = parseBlessingCurseAmount(item.system?.effectLine?.amount);
    const target = String(item.system?.effectLine?.target ?? "").trim();
    if (!target || !amount) return null;

    return {
      uuid,
      name: String(item.name ?? entry?.name ?? "").trim(),
      category: readBlessingCurseCategory(item),
      alwaysActive: Boolean(item.system?.alwaysActive),
      amount,
      amountText: String(item.system?.effectLine?.amount ?? "").trim() || `${amount}`,
      target,
      targetLabel: formatBlessingCurseTargetLabel(target)
    };
  }));

  const categoryRank = (category) => category === "Blessing" ? 0 : category === "Curse" ? 1 : 2;
  return resolved
    .filter((entry) => entry?.name && entry?.target)
    .sort((a, b) => {
      const rankDiff = categoryRank(a.category) - categoryRank(b.category);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name);
    });
};

const getApplicableBlessingCurseModifiers = (entries = [], { skillKey = "", characteristicKey = "" } = {}) => {
  const normalizedSkillKey = String(skillKey ?? "").trim();
  const normalizedCharacteristicKey = String(characteristicKey ?? "").trim();
  const characteristicLabel = getCharacteristicOptions({ system: {} }, normalizedCharacteristicKey)
    .find((entry) => String(entry?.key ?? "").trim() === normalizedCharacteristicKey)?.label
    ?? formatCharacteristicLabel(normalizedCharacteristicKey);
  const skillLabel = String(getSkillDefinitionForKey(normalizedSkillKey)?.label ?? formatSkillLabel(normalizedSkillKey)).trim();
  const skillTokens = buildTraitMatchTokens({ type: "skill", key: normalizedSkillKey, label: skillLabel });
  const characteristicTokens = buildTraitMatchTokens({
    type: "characteristic",
    key: normalizedCharacteristicKey,
    label: characteristicLabel
  });

  return entries.filter((entry) => {
    const targetTokens = readBlessingCurseTargetTokens(entry?.target);
    return [...targetTokens].some((token) => skillTokens.has(token) || characteristicTokens.has(token));
  }).map((entry) => ({
    ...entry,
    label: `${entry.name}: ${entry.targetLabel} ${entry.amountText}`.trim()
  }));
};

const renderBlessingCurseModifierRows = (container, modifiers = [], overrides = {}, scope = "main") => {
  if (!container) return;

  if (!modifiers.length) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  container.hidden = false;
  container.innerHTML = modifiers.map((entry, index) => `
    <div class="fs2e-comp-label fs2e-bc-modifier-label">
      <span class="fs2e-inline-title">${escapeHtml(entry.label)}</span>
    </div>
    <div class="fs2e-eq-field fs2e-eq-merge fs2e-bc-modifier-field">
      <div class="fs2e-eq-row">
        <span class="fs2e-inline-plus">=</span>
        <input
          id="fs2e-${scope}-bc-modifier-${index}"
          class="fs2e-gn-input fs2e-bc-modifier-input"
          type="number"
          step="1"
          data-scope="${escapeHtml(scope)}"
          data-uuid="${escapeHtml(entry.uuid)}"
          value="${escapeHtml(Object.prototype.hasOwnProperty.call(overrides, entry.uuid) ? overrides[entry.uuid] : entry.amount)}"
        />
      </div>
    </div>
  `).join("");
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
  const blessingCurseModifiers = getApplicableBlessingCurseModifiers(
    await resolveActorBlessingCurseModifiers(actor),
    { skillKey, characteristicKey }
  );
  const blessingCurseTotal = blessingCurseModifiers.reduce((sum, entry) => sum + toNumber(entry.amount), 0);
  const complementaryVp = toNumber(preset.compVp, 0);
  const accentMax = Math.max(0, skillTrait);
  const accent = clamp(toNumber(preset.accent, 0), -accentMax, accentMax);
  const gn = buildGoalNumber({
    skillValue,
    characteristicValue,
    difficulty,
    woundPenalty: woundPenalty + penaltyTotal,
    complementaryVp
  }) + blessingCurseTotal;

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
    ...blessingCurseModifiers.map((entry) => ({ label: entry.label, value: `${entry.amount}` })),
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
  const availableBlessingCurseModifiers = await resolveActorBlessingCurseModifiers(actor);

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
          complementaryText: "",
          blessingCurseOverrides: {},
          compBlessingCurseOverrides: {}
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
          root.querySelectorAll(".fs2e-bc-modifier-input").forEach((input) => {
            const uuid = String(input.dataset.uuid ?? "").trim();
            const scope = String(input.dataset.scope ?? "main").trim();
            if (!uuid) return;
            const targetState = scope === "comp" ? state.compBlessingCurseOverrides : state.blessingCurseOverrides;
            targetState[uuid] = toNumber(input.value, 0);
          });

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
          const selectedSkillKey = mainSkillSelect
            ? String(mainSkillSelect.value ?? "").trim()
            : String(selectedSkill.key ?? "").trim();
          const selectedCharacteristicKey = String(root.querySelector("#fs2e-main-char")?.value ?? "").trim();
          const blessingCurseModifiers = getApplicableBlessingCurseModifiers(availableBlessingCurseModifiers, {
            skillKey: selectedSkillKey,
            characteristicKey: selectedCharacteristicKey
          });
          const blessingCurseTotal = blessingCurseModifiers.reduce(
            (sum, entry) => sum + toNumber(
              Object.prototype.hasOwnProperty.call(state.blessingCurseOverrides, entry.uuid)
                ? state.blessingCurseOverrides[entry.uuid]
                : entry.amount,
              0
            ),
            0
          );
          const mainBaseGn = skillValue + characteristicValue;

          const gn = buildGoalNumber({
            skillValue,
            characteristicValue,
            difficulty,
            woundPenalty: woundPenalty + penaltyTotal,
            complementaryVp: state.complementaryVp
          }) + blessingCurseTotal;
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
          const selectedCompSkillKey = String(root.querySelector("#fs2e-comp-skill")?.value ?? "").trim();
          const selectedCompCharacteristicKey = String(root.querySelector("#fs2e-comp-char")?.value ?? "").trim();
          const compBlessingCurseModifiers = getApplicableBlessingCurseModifiers(availableBlessingCurseModifiers, {
            skillKey: selectedCompSkillKey,
            characteristicKey: selectedCompCharacteristicKey
          });
          const compBlessingCurseTotal = compBlessingCurseModifiers.reduce(
            (sum, entry) => sum + toNumber(
              Object.prototype.hasOwnProperty.call(state.compBlessingCurseOverrides, entry.uuid)
                ? state.compBlessingCurseOverrides[entry.uuid]
                : entry.amount,
              0
            ),
            0
          );
          const compBaseGn = compSkillValue + compCharacteristicValue;
          const compGn = buildGoalNumber({
            skillValue: compSkillValue,
            characteristicValue: compCharacteristicValue,
            difficulty: compDifficulty,
            woundPenalty,
            complementaryVp: 0
          }) + compBlessingCurseTotal;

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
          const blessingCurseContainer = root.querySelector("#fs2e-main-bc-modifiers");
          const compBlessingCurseContainer = root.querySelector("#fs2e-comp-bc-modifiers");
          const sustainTask = readInputNumber(root, "#fs2e-sustain-task");

          if (mainBaseInput) mainBaseInput.value = String(mainBaseGn);
          if (mainWoundInput) mainWoundInput.value = String(woundPenalty);
          if (penaltyTotalInput) penaltyTotalInput.value = String(penaltyTotal);
          renderBlessingCurseModifierRows(blessingCurseContainer, blessingCurseModifiers, state.blessingCurseOverrides, "main");
          if (mainDiffGnInput) mainDiffGnInput.value = String(difficulty);
          if (compVpInput) compVpInput.value = String(state.complementaryVp);
          if (finalInput) finalInput.value = String(gn);
          if (compBaseInput) compBaseInput.value = String(compBaseGn);
          if (compWoundInput) compWoundInput.value = String(woundPenalty);
          renderBlessingCurseModifierRows(compBlessingCurseContainer, compBlessingCurseModifiers, state.compBlessingCurseOverrides, "comp");
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
          const skillKeyLocal = selectedSkillKey || selectedSkill.key;
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
          const blessingCurseModifiers = getApplicableBlessingCurseModifiers(availableBlessingCurseModifiers, {
            skillKey: skillKeyLocal,
            characteristicKey
          }).map((entry) => ({
            ...entry,
            appliedValue: toNumber(
              Object.prototype.hasOwnProperty.call(state.blessingCurseOverrides, entry.uuid)
                ? state.blessingCurseOverrides[entry.uuid]
                : entry.amount,
              0
            )
          }));
          const blessingCurseTotal = blessingCurseModifiers.reduce((sum, entry) => sum + entry.appliedValue, 0);
          const gn = buildGoalNumber({
            skillValue,
            characteristicValue,
            difficulty,
            woundPenalty: woundPenalty + penaltyTotal,
            complementaryVp: state.complementaryVp
          }) + blessingCurseTotal;
          const accentMax = Math.max(0, skillTrait);
          const accentValue = toNumber(root.querySelector("#fs2e-accent-value")?.value, 0);
          const accent = clamp(accentValue, -accentMax, accentMax);

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
            blessingCurseModifiers,
            blessingCurseTotal,
            accent,
            gn,
            complementary: skillDef.complementary ?? ""
          };
        };

        const readCompRollConfig = () => {
          const skillSelect = root.querySelector("#fs2e-comp-skill");
          const characteristicSelect = root.querySelector("#fs2e-comp-char");
          const skillKey = String(skillSelect?.value ?? "").trim();
          const characteristicKey = String(characteristicSelect?.value ?? "").trim();
          const skillLabel = String(skillSelect?.selectedOptions?.[0]?.textContent ?? "").trim();
          const charLabel = String(characteristicSelect?.selectedOptions?.[0]?.textContent ?? "").trim();
          const skillValue = readSelectNumber(root, "#fs2e-comp-skill");
          const characteristicValue = readSelectNumber(root, "#fs2e-comp-char");
          const difficulty = readInputNumber(root, "#fs2e-comp-diff-base") + readInputNumber(root, "#fs2e-comp-diff-custom");
          const woundPenalty = getWoundPenalty(actor);
          const blessingCurseModifiers = getApplicableBlessingCurseModifiers(availableBlessingCurseModifiers, {
            skillKey,
            characteristicKey
          }).map((entry) => ({
            ...entry,
            appliedValue: toNumber(
              Object.prototype.hasOwnProperty.call(state.compBlessingCurseOverrides, entry.uuid)
                ? state.compBlessingCurseOverrides[entry.uuid]
                : entry.amount,
              0
            )
          }));
          const blessingCurseTotal = blessingCurseModifiers.reduce((sum, entry) => sum + entry.appliedValue, 0);
          const gn = buildGoalNumber({ skillValue, characteristicValue, difficulty, woundPenalty, complementaryVp: 0 }) + blessingCurseTotal;
          return {
            skillKey,
            skillLabel,
            characteristicKey,
            characteristicLabel: charLabel,
            skillValue,
            characteristicValue,
            difficulty,
            woundPenalty,
            blessingCurseModifiers,
            blessingCurseTotal,
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
            ...config.blessingCurseModifiers.map((entry) => ({ label: entry.label, value: `${entry.appliedValue}` })),
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
