import { toNumber } from "../../global/derived/shared.mjs";
import { getActionPenalty } from "../../rolls/roll-engine.mjs";
import { findTargetOwner } from "../../rolls/contested-rolls.mjs";
import { getSkillTotalByKey } from "../../rolls/roll-options.mjs";

const SOCKET_NAME = "system.fs2e";
const INITIATIVE_PLAN_FLAG_KEY = "initiativePlan";
const ACTION_COMPENDIUM_PACK = "fs2e.actions";
const DEFENSIVE_ACTION_NAME_PATTERN = /\b(dodge|parry|block|defend|abort|evade)\b/i;

const canonicalToken = (value) => String(value ?? "").trim().toLowerCase();
const normalizeStringList = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
};

const uniqueCaseInsensitive = (values = []) => {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (!text) continue;
    const token = canonicalToken(text);
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(text);
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

const readActionField = (item, key) => String(
  foundry.utils.getProperty(item, `system.${key}`)
  ?? foundry.utils.getProperty(item, `system.action.${key}`)
  ?? foundry.utils.getProperty(item, `system.system.${key}`)
  ?? foundry.utils.getProperty(item, `system.system.action.${key}`)
  ?? ""
).trim();

const readActionTags = (item) => uniqueCaseInsensitive([
  ...normalizeStringList(item?.system?.tags),
  ...normalizeStringList(item?.system?.data?.tags),
  ...normalizeStringList(item?.tags),
  ...normalizeStringList(item?.getFlag?.("fs2e", "tags")),
  ...normalizeStringList(foundry.utils.getProperty(item, "flags.fs2e.tags"))
]);

const readActionSourceRefs = (item) => uniqueCaseInsensitive([
  String(item?.uuid ?? "").trim(),
  String(item?.getFlag?.("fs2e", "sourceItemUuid") ?? "").trim()
]).map((entry) => canonicalToken(entry)).filter(Boolean);

const normalizeActionCategory = (value) => {
  const token = canonicalToken(value);
  if (!token) return "";
  if (["combat", "basic", "basicfight", "fight"].includes(token)) return "combat";
  if (["fencing", "martial", "martialarts", "shield", "firearm", "firearms"].includes(token)) return "combat";
  return "";
};

const isCombatAction = (item) => {
  const tagTokens = readActionTags(item).map((tag) => canonicalToken(tag)).filter(Boolean);
  const chartKey = normalizeActionCategory(readActionField(item, "chart"));
  return tagTokens.includes("combat")
    || tagTokens.some((tag) => normalizeActionCategory(tag) === "combat")
    || chartKey === "combat";
};

const isAttackAction = (item) => {
  const tags = readActionTags(item).map((tag) => canonicalToken(tag));
  if (tags.includes("attack")) return true;
  if (tags.includes("defend")) return false;
  if (!isCombatAction(item)) return false;

  const title = String(item?.name ?? "").trim();
  return !DEFENSIVE_ACTION_NAME_PATTERN.test(title);
};

const formatInitLabel = (value) => {
  const numeric = toNumber(value, Number.NaN);
  if (!Number.isFinite(numeric)) return "";
  return numeric > 0 ? `+${numeric}` : `${numeric}`;
};

const buildActionOption = (item) => {
  const title = String(item?.name ?? "").trim() || "Action";
  const uuid = String(item?.uuid ?? "").trim();
  const initValue = toNumber(readActionField(item, "init"), 0);
  const initLabel = formatInitLabel(initValue);
  return {
    uuid,
    title,
    skillKey: String(readActionField(item, "skill") ?? "").trim(),
    characteristicKey: String(readActionField(item, "characteristic") ?? "").trim(),
    isAttack: isAttackAction(item),
    init: initValue,
    initLabel,
    optionLabel: initLabel ? `${title} (${initLabel} init)` : title
  };
};

const compareActions = (a, b) => {
  const initDiff = toNumber(a?.init, 0) - toNumber(b?.init, 0);
  if (initDiff !== 0) return initDiff;
  return String(a?.title ?? "").localeCompare(String(b?.title ?? ""));
};

const loadCompendiumCombatActions = async (seenRefs) => {
  const pack = game?.packs?.get?.(ACTION_COMPENDIUM_PACK) ?? null;
  if (!pack) return [];

  const docs = await pack.getDocuments().catch(() => []);
  const out = [];

  for (const doc of docs) {
    if (doc?.documentName !== "Item" || doc?.type !== "action") continue;
    if (!isCombatAction(doc)) continue;
    const refs = readActionSourceRefs(doc);
    if (refs.some((ref) => seenRefs.has(ref))) continue;
    out.push(buildActionOption(doc));
    for (const ref of refs) seenRefs.add(ref);
  }

  return out;
};

const getCombatPlanningActions = async (actor) => {
  if (!actor) return [];

  const seenRefs = new Set();
  const out = [];

  for (const item of actor.items ?? []) {
    if (item?.type !== "action" || !isCombatAction(item)) continue;
    out.push(buildActionOption(item));
    for (const ref of readActionSourceRefs(item)) seenRefs.add(ref);
  }

  const historyEntries = (actor.items ?? [])
    .filter((item) => item?.type === "history")
    .flatMap((item) => normalizeBonusEntries([
      ...getNestedArray(item?.system ?? {}, "bonusActions"),
      ...getNestedArray(item?.system ?? {}, "data.bonusActions")
    ]));

  const actorEntries = normalizeBonusEntries([
    ...getNestedArray(actor?.system ?? {}, "bonusActions"),
    ...getNestedArray(actor?.system ?? {}, "data.bonusActions")
  ]);

  for (const entry of [...historyEntries, ...actorEntries]) {
    const uuid = String(entry?.uuid ?? "").trim();
    if (!uuid) continue;
    const doc = await fromUuid(uuid).catch(() => null);
    if (doc?.documentName !== "Item" || doc?.type !== "action" || !isCombatAction(doc)) continue;
    const refs = readActionSourceRefs(doc);
    if (refs.some((ref) => seenRefs.has(ref))) continue;
    out.push(buildActionOption(doc));
    for (const ref of refs) seenRefs.add(ref);
  }

  const compendiumActions = await loadCompendiumCombatActions(seenRefs);
  return [...out, ...compendiumActions].sort(compareActions);
};

const normalizeSelectedActions = (selected, actionMap) => selected
  .map((uuid) => actionMap.get(String(uuid ?? "").trim()))
  .filter(Boolean)
  .slice(0, 3);

const getPrimaryInitiativeAction = (actions = []) => actions.find((entry) => entry?.isAttack) ?? actions[0] ?? null;

const readInitiativePlanFlag = (combatant) => {
  const raw = combatant?.getFlag?.("fs2e", INITIATIVE_PLAN_FLAG_KEY);
  return raw && typeof raw === "object" ? raw : null;
};

export const getCurrentCombatPlanForActor = (actor) => {
  const combat = game.combat;
  if (!actor || !combat) return null;

  const combatant = combat.combatants.find((entry) => entry?.actor?.id === actor.id);
  if (!combatant) return null;

  const plan = readInitiativePlanFlag(combatant);
  if (!plan || toNumber(plan.round, 0) !== toNumber(combat.round, 0)) return null;
  return plan;
};

export const getCurrentCombatActionCountForActor = (actor) => {
  const plan = getCurrentCombatPlanForActor(actor);
  const count = toNumber(plan?.count, 0);
  return count > 0 ? Math.min(count, 3) : 0;
};

const buildInitiativeFormula = ({ skillTotal = 0, modifier = 0 } = {}) => {
  const safeSkillTotal = toNumber(skillTotal, 0);
  const numeric = toNumber(modifier, 0);
  return numeric ? `${safeSkillTotal} + 1d6 + ${numeric}` : `${safeSkillTotal} + 1d6`;
};

const calculatePlannedInitiative = async ({ combatant, action }) => {
  const actor = combatant?.actor ?? null;
  const skillKey = String(action?.skillKey ?? "").trim();
  const skillTotal = skillKey ? toNumber(getSkillTotalByKey(actor, skillKey), 0) : 0;
  const modifier = toNumber(action?.init, 0);
  const roll = await (new Roll("1d6")).evaluate({ async: true });
  const die = toNumber(roll.total, 0);
  const total = skillTotal + die + modifier;
  await combatant.update({ initiative: total });
  return {
    formula: buildInitiativeFormula({ skillTotal, modifier }),
    total,
    skillTotal,
    die,
    modifier,
    skillKey
  };
};

export const applySubmittedInitiativePlan = async ({ combatId, combatantId, round, actionUuids = [] } = {}) => {
  if (!game.user?.isGM) return null;

  const combat = game.combats?.get?.(String(combatId ?? "").trim()) ?? null;
  const combatant = combat?.combatants?.get?.(String(combatantId ?? "").trim()) ?? null;
  if (!combat || !combatant || !combatant.actor) return null;
  if (toNumber(combat.round, 0) !== toNumber(round, 0)) return null;

  const availableActions = await getCombatPlanningActions(combatant.actor);
  const actionMap = new Map(availableActions.map((entry) => [entry.uuid, entry]));
  const selectedActions = normalizeSelectedActions(actionUuids, actionMap);
  if (!selectedActions.length) return null;
  if (selectedActions.filter((entry) => entry.isAttack).length > 1) return null;

  const primaryAction = getPrimaryInitiativeAction(selectedActions);
  const initiative = await calculatePlannedInitiative({ combatant, action: primaryAction });
  const plan = {
    round: toNumber(round, 0),
    count: selectedActions.length,
    actionUuids: selectedActions.map((entry) => entry.uuid),
    primaryActionUuid: String(primaryAction?.uuid ?? "").trim(),
    actions: selectedActions.map((entry, index) => ({
      slot: index + 1,
      uuid: entry.uuid,
      title: entry.title,
      isAttack: entry.isAttack,
      init: entry.init,
      initLabel: entry.initLabel,
      skillKey: entry.skillKey,
      characteristicKey: entry.characteristicKey
    })),
    initiative
  };

  await combatant.setFlag("fs2e", INITIATIVE_PLAN_FLAG_KEY, plan);
  return plan;
};

const promptInitiativePlanForCombatant = async ({ combatant, round }) => {
  const actor = combatant?.actor ?? null;
  if (!combatant || !actor) return null;

  const actions = await getCombatPlanningActions(actor);
  if (!actions.length) {
    ui.notifications?.warn?.(`${actor.name} has no combat actions to plan.`);
    return null;
  }

  const currentPlan = readInitiativePlanFlag(combatant);
  const existingSelections = toNumber(currentPlan?.round, 0) === toNumber(round, 0)
    ? (Array.isArray(currentPlan?.actionUuids) ? currentPlan.actionUuids.slice(0, 3) : [])
    : [];
  const slots = [0, 1, 2].map((index) => {
    const selectedUuid = String(existingSelections[index] ?? "").trim();
    return {
      slot: index + 1,
      actionOptions: actions.map((entry) => ({
        ...entry,
        selected: entry.uuid === selectedUuid
      }))
    };
  });

  const content = await renderTemplate("systems/fs2e/templates/dialogs/initiative-dialog.hbs", {
    actorName: actor.name,
    round,
    actions,
    slots
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
      title: `${actor.name} Round ${round} Plan`,
      content,
      buttons: {},
      render: (html) => {
        const root = html?.[0];
        if (!root) return;

        const actionMap = new Map(actions.map((entry) => [entry.uuid, entry]));
        const slotInputs = Array.from(root.querySelectorAll(".fs2e-init-slot-select"));

        const buildOptionsMarkup = ({ currentValue = "", selectedAttackUuid = "", keepAttackChoicesVisible = false, selectedElsewhere = new Set() } = {}) => {
          const optionRows = ['<option value="">None</option>'];

          for (const action of actions) {
            const value = String(action?.uuid ?? "").trim();
            if (!value) continue;

            const chosenElsewhere = selectedElsewhere.has(value);
            const blockedAttack = !!selectedAttackUuid
              && !keepAttackChoicesVisible
              && !!action?.isAttack
              && value !== selectedAttackUuid
              && value !== currentValue;
            if (chosenElsewhere || blockedAttack) continue;

            const selectedAttr = value === currentValue ? " selected" : "";
            optionRows.push(`<option value="${foundry.utils.escapeHTML(value)}"${selectedAttr}>${foundry.utils.escapeHTML(action.optionLabel)}</option>`);
          }

          return optionRows.join("");
        };

        const updateSelectOptions = () => {
          const selectedActions = normalizeSelectedActions(slotInputs.map((input) => input.value), actionMap);
          const selectedAttack = selectedActions.find((entry) => entry.isAttack) ?? null;
          const selectedValues = slotInputs
            .map((input) => String(input.value ?? "").trim())
            .filter(Boolean);

          for (const input of slotInputs) {
            const currentValue = String(input.value ?? "").trim();
            const currentAction = actionMap.get(currentValue);
            const keepAttackChoicesVisible = !!currentAction?.isAttack;
            const selectedElsewhere = new Set(selectedValues.filter((value) => value && value !== currentValue));
            input.innerHTML = buildOptionsMarkup({
              currentValue,
              selectedAttackUuid: String(selectedAttack?.uuid ?? "").trim(),
              keepAttackChoicesVisible,
              selectedElsewhere
            });
            input.value = currentValue;
          }
        };

        const updatePreview = () => {
          const selectedActions = normalizeSelectedActions(slotInputs.map((input) => input.value), actionMap);
          const count = selectedActions.length;
          const primaryAction = getPrimaryInitiativeAction(selectedActions);
          const countNode = root.querySelector("[data-initiative-count]");
          const penaltyNode = root.querySelector("[data-initiative-penalty]");
          const formulaNode = root.querySelector("[data-initiative-formula]");
          const skillTotal = primaryAction?.skillKey ? toNumber(getSkillTotalByKey(actor, primaryAction.skillKey), 0) : 0;

          if (countNode) countNode.textContent = `${count} / 3`;
          if (penaltyNode) penaltyNode.textContent = `${getActionPenalty(count || 1)}`;
          if (formulaNode) {
            formulaNode.textContent = primaryAction
              ? buildInitiativeFormula({ skillTotal, modifier: primaryAction.init })
              : "No initiative value";
          }
        };

        for (const input of slotInputs) {
          input.addEventListener("change", () => {
            updateSelectOptions();
            updatePreview();
          });
        }

        root.querySelector("[data-action='save']")?.addEventListener("click", () => {
          const selectedActions = normalizeSelectedActions(slotInputs.map((input) => input.value), actionMap);
          if (!selectedActions.length) {
            ui.notifications?.warn?.("Select at least one combat action.");
            return;
          }
          if (selectedActions.filter((entry) => entry.isAttack).length > 1) {
            ui.notifications?.warn?.("Only one Attack action can be selected.");
            return;
          }

          finish({
            combatId: combatant.combat?.id,
            combatantId: combatant.id,
            round,
            actionUuids: selectedActions.map((entry) => entry.uuid)
          });
          dialog?.close();
        });

        root.querySelector("[data-action='cancel']")?.addEventListener("click", () => {
          finish(null);
          dialog?.close();
        });

        updateSelectOptions();
        updatePreview();
      },
      close: () => finish(null)
    }, {
      classes: ["fs2e", "dialog", "initiative-dialog"],
      width: 520,
      height: "auto",
      resizable: true
    });

    dialog.render(true);
  });
};

export const requestInitiativePlansForCombatants = async ({ combatId, round, combatantIds = [] } = {}) => {
  const combat = game.combats?.get?.(String(combatId ?? "").trim()) ?? null;
  if (!combat || toNumber(combat.round, 0) !== toNumber(round, 0)) return;

  for (const combatantId of combatantIds) {
    const combatant = combat.combatants.get(String(combatantId ?? "").trim());
    if (!combatant?.actor) continue;

    const submission = await promptInitiativePlanForCombatant({ combatant, round });
    if (!submission) continue;

    if (game.user?.isGM) {
      await applySubmittedInitiativePlan(submission);
      continue;
    }

    game.socket?.emit?.(SOCKET_NAME, {
      type: "initiative-plan-submit",
      submittedByUserId: game.user?.id,
      ...submission
    });
  }
};

export const dispatchRoundInitiativePlanning = async (combat) => {
  if (!game.user?.isGM || !combat) return;

  const round = toNumber(combat.round, 0);
  if (round < 1) return;

  const groups = new Map();
  for (const combatant of combat.combatants ?? []) {
    if (!combatant?.actor || combatant?.defeated) continue;
    const owner = findTargetOwner(combatant.actor);
    const userId = String(owner?.id ?? "").trim();
    if (!userId) continue;
    const entry = groups.get(userId) ?? [];
    entry.push(combatant.id);
    groups.set(userId, entry);
  }

  for (const [userId, combatantIds] of groups.entries()) {
    if (userId === game.user?.id) {
      await requestInitiativePlansForCombatants({ combatId: combat.id, round, combatantIds });
      continue;
    }

    game.socket?.emit?.(SOCKET_NAME, {
      type: "initiative-plan-request",
      targetUserId: userId,
      combatId: combat.id,
      round,
      combatantIds
    });
  }
};
