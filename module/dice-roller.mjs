// systems/fs2e/module/dice-roller.mjs
// FS2E Dice Roller (Foundry VTT v13)

const DIFFICULTY_OPTIONS = [
  { label: "None (0)", value: 0 },
  { label: "Natural (+2)", value: 2 },
  { label: "Easy (+4)", value: 4 },
  { label: "Piece of cake (+6)", value: 6 },
  { label: "Child's play (+8)", value: 8 },
  { label: "Effortless (+10)", value: 10 },
  { label: "Hard (-2)", value: -2 },
  { label: "Demanding (-4)", value: -4 },
  { label: "Tough (-6)", value: -6 },
  { label: "Severe (-8)", value: -8 },
  { label: "Herculean (-10)", value: -10 },
  { label: "Custom (0)", value: 0 }
];

const QUALITY_BANDS = [
  { min: 1, max: 2, vp: 1, label: "Barely satisfactory" },
  { min: 3, max: 5, vp: 1, label: "Mediocre" },
  { min: 6, max: 8, vp: 2, label: "Pretty good" },
  { min: 9, max: 11, vp: 3, label: "Good job" },
  { min: 12, max: 14, vp: 4, label: "Excellent" },
  { min: 15, max: 17, vp: 5, label: "Brilliant" },
  { min: 18, max: 20, vp: 6, label: "Virtuoso" }
];

const labelize = (k) =>
  (k ?? "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

const sumStat = (s) => Number(s?.base ?? 0) + Number(s?.temp ?? 0) + Number(s?.mod ?? 0);
const clamp = (n, min, max) => Math.min(Math.max(Number(n ?? 0), min), max);

const extendedBonus = (gn) => {
  if (gn <= 20) return 0;
  return Math.floor((gn - 21) / 3) + 1;
};

const vpFromSuccesses = (successes) => {
  const band = QUALITY_BANDS.find((b) => successes >= b.min && successes <= b.max);
  if (!band) return { vp: 0, quality: "Failure" };
  return { vp: band.vp, quality: band.label };
};

const buildSkillList = (actor) => {
  if (!actor) return [];
  const systemSkills = actor.system?.skills ?? {};
  const legacySkills = actor.system?.system?.skills ?? {};
  const skills = foundry.utils.mergeObject(legacySkills, systemSkills, {
    inplace: false,
    recursive: true
  });
  const natural = skills.natural ?? {};
  const learnedRaw = skills.learned ?? {};
  const learnedModel =
    game?.system?.documentTypes?.Actor?.character?.system?.skills?.learned ??
    game?.system?.model?.Actor?.character?.system?.skills?.learned ??
    {};
  const learned = foundry.utils.mergeObject(learnedModel, learnedRaw, {
    inplace: false,
    recursive: true
  });
  const entries = [];

  Object.keys(natural).forEach((k) => {
    const v = natural[k];
    if (!v || typeof v !== "object") return;
    entries.push({
      key: `natural.${k}`,
      label: labelize(k),
      value: sumStat(v)
    });
  });

  Object.keys(learned).forEach((k) => {
    const v = learned[k];
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return;
    if (v.base !== undefined || v.temp !== undefined || v.mod !== undefined) {
      entries.push({
        key: `learned.${k}`,
        label: labelize(k),
        value: sumStat(v)
      });
      return;
    }
    // group skills
    Object.keys(v).forEach((subKey) => {
      const sub = v[subKey];
      if (!sub || typeof sub !== "object") return;
      const display =
        typeof sub.display === "string" && sub.display.trim()
          ? sub.display
          : labelize(subKey);
      entries.push({
        key: `group.${k}.${subKey}`,
        label: display,
        value: sumStat(sub)
      });
    });
  });

  return entries.sort((a, b) => a.label.localeCompare(b.label));
};

const buildCharacteristicList = (actor) => {
  if (!actor) return [];
  const systemCh = actor.system?.characteristics ?? {};
  const legacyCh = actor.system?.system?.characteristics ?? {};
  const modelCh =
    game?.system?.documentTypes?.Actor?.character?.system?.characteristics ??
    game?.system?.model?.Actor?.character?.system?.characteristics ??
    {};
  const ch = foundry.utils.mergeObject(modelCh, foundry.utils.mergeObject(legacyCh, systemCh, {
    inplace: false,
    recursive: true
  }), {
    inplace: false,
    recursive: true
  });
  const list = [];
  const pushGroup = (group, keys) => {
    keys.forEach((k) => {
      if (!ch[group]?.[k]) return;
      list.push({
        key: k,
        label: labelize(k),
        value: sumStat(ch[group][k])
      });
    });
  };
  pushGroup("body", ["strength", "dexterity", "endurance"]);
  pushGroup("mind", ["wits", "perception", "tech"]);
  pushGroup("spirit", ["extrovert", "introvert", "passion", "calm", "faith", "ego"]);
  pushGroup("occult", ["psi", "theurgy"]);
  return list;
};

const getWoundPenalty = (actor) => {
  const vitality = actor?.system?.vitality ?? {};
  const nonVital = clamp(vitality.nonVital ?? 0, 0, 99);
  const vital = clamp(vitality.vital ?? 5, 0, 5);
  if (nonVital > 0) return 0;
  const vitalLost = Math.max(0, 5 - vital);
  return -2 * vitalLost;
};


export class FS2EDiceRoller extends Application {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
    this.defaults = {
      skillKey: options.defaultSkillKey ?? "",
      charKey: options.defaultCharacteristicKey ?? ""
    };
    this.state = {
      compResult: null,
      mainResult: null,
      compLocked: false
    };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["fs2e", "dialog", "dice-roller"],
      template: "systems/fs2e/templates/dialogs/dialogs.hbs",
      width: 350,
      height: "auto",
      resizable: true
    });
  }

  /** @override */
  async _render(...args) {
    await super._render(...args);
    this.setPosition({ height: "auto" });
  }

  getData() {
    const skills = buildSkillList(this.actor);
    const characteristics = buildCharacteristicList(this.actor);
    if (this.defaults.skillKey) {
      const match = skills.find((s) => s.key === this.defaults.skillKey);
      if (match) {
        this.defaults.skillLabel = match.label;
        this.defaults.skillValue = match.value;
      } else {
        this.defaults.skillLabel = "";
        this.defaults.skillValue = 0;
      }
    }
    if (!this.defaults.charKey && this.defaults.skillKey) {
      const mapping = CONFIG?.fs2e?.mappingData ?? {};
      const parts = this.defaults.skillKey.split(".");
      const type = parts[0];
      if (type === "natural" && parts[1]) {
        const skillKey = parts[1];
        this.defaults.charKey = mapping?.natural?.[skillKey]?.default ?? "";
      } else if (type === "learned" && parts[1]) {
        const skillKey = parts[1];
        this.defaults.charKey = mapping?.learned?.[skillKey]?.default ?? "";
      } else if (type === "group" && parts[1] && parts[2]) {
        const groupKey = parts[1];
        const skillKey = parts[2];
        this.defaults.charKey =
          mapping?.groups?.[groupKey]?.[skillKey]?.default ??
          mapping?.groups?.[groupKey]?.default ??
          "";
      }
    }
    return {
      actor: this.actor,
      skills,
      characteristics,
      difficulties: DIFFICULTY_OPTIONS,
      state: this.state,
      defaults: this.defaults
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0];

    const updatePreview = () => {
      const getNumber = (sel, fallback = 0) => {
        const el = root.querySelector(sel);
        const val = Number(el?.value ?? fallback);
        return Number.isFinite(val) ? val : fallback;
      };
      const skillVal = Number(this.defaults.skillValue ?? 0);
      const mainCharSelect = root.querySelector("#fs2e-main-char");
      const mainCharOpt = mainCharSelect?.selectedOptions?.[0];
      const charVal = Number(mainCharOpt?.dataset?.value ?? 0);
      const mainDiffSelect = root.querySelector("#fs2e-main-diff-select");
      const mainDiffOpt = mainDiffSelect?.selectedOptions?.[0];
      const diffVal = Number(mainDiffOpt?.dataset?.value ?? mainDiffSelect?.value ?? 0);
      const customDiff = getNumber("#fs2e-main-diff-custom", 0);
      const diff = diffVal + customDiff;
      const charSum = skillVal + charVal;
      const charInput = root.querySelector("#fs2e-main-char-val");
      if (charInput) charInput.value = charSum;
      const gnPreview = diff;
      const gnInput = root.querySelector("#fs2e-main-gn-preview");
      if (gnInput) gnInput.value = gnPreview;
      const baseGn = charSum + diff;

      const compEnabled = root.querySelector("#fs2e-comp-toggle")?.checked ?? false;
      const compSkillVal = Number(root.querySelector("#fs2e-comp-skill")?.selectedOptions?.[0]?.dataset?.value ?? 0);
      const compCharSelect = root.querySelector("#fs2e-comp-char");
      const compCharOpt = compCharSelect?.selectedOptions?.[0];
      const compCharVal = Number(compCharOpt?.dataset?.value ?? 0);
      const compDiffSelect = root.querySelector("#fs2e-comp-diff-select");
      const compDiffOpt = compDiffSelect?.selectedOptions?.[0];
      const compDiffVal = Number(compDiffOpt?.dataset?.value ?? compDiffSelect?.value ?? 0);
      const compCustomDiff = getNumber("#fs2e-comp-diff-custom", 0);
      const compDiff = compDiffVal + compCustomDiff;
      const compCharSum = compSkillVal + compCharVal;
      const compCharInput = root.querySelector("#fs2e-comp-char-val");
      if (compCharInput) compCharInput.value = compCharSum;
      const compPreview = compDiff;
      const compInput = root.querySelector("#fs2e-comp-gn-preview");
      if (compInput) compInput.value = compEnabled ? compPreview : 0;

      const actions = Number(root.querySelector('input[name="fs2e-actions"]:checked')?.value ?? 1);
      const retries = Number(root.querySelector('input[name="fs2e-retries"]:checked')?.value ?? 0);
      const multiPenalty = actions === 1 ? 0 : (actions === 2 ? -4 : -6);
      const retryPenalty = retries === 0 ? 0 : (retries === 1 ? -2 : -4);
      const penaltyInput = root.querySelector("#fs2e-penalty-total");
      if (penaltyInput) penaltyInput.value = multiPenalty + retryPenalty;

      const compVpInput = root.querySelector("#fs2e-comp-vp-total");
      if (compVpInput) compVpInput.value = this.state.compResult?.totalVP ?? 0;

      const woundPenalty = getWoundPenalty(this.actor);
      const woundInput = root.querySelector("#fs2e-wound-penalty");
      if (woundInput) woundInput.value = woundPenalty;
      const compWoundInput = root.querySelector("#fs2e-comp-wound-penalty");
      if (compWoundInput) compWoundInput.value = woundPenalty;

      const finalTn = baseGn + multiPenalty + retryPenalty + woundPenalty + (this.state.compResult?.totalVP ?? 0);
      const finalTnInput = root.querySelector("#fs2e-final-tn");
      if (finalTnInput) finalTnInput.value = finalTn;

      const compGoal = compCharSum + compDiff + multiPenalty + retryPenalty + woundPenalty;
      const compGoalInput = root.querySelector("#fs2e-comp-final-tn");
      if (compGoalInput) compGoalInput.value = compEnabled ? compGoal : 0;
    };

    // Characteristic values are derived from selected option; no direct sync.

    const applyDefault = (selectId, valueId, key) => {
      if (!key) return;
      const select = root.querySelector(selectId);
      if (!select) return;
      const option = Array.from(select.options).find((opt) => opt.value === key);
      if (!option) return;
      select.value = key;
      select.dispatchEvent(new Event("change"));
      const input = root.querySelector(valueId);
      if (input) input.value = Number(option.dataset.value ?? 0);
    };

    if (!this.defaults.charKey && this.defaults.skillKey) {
      const mapping = CONFIG?.fs2e?.mappingData ?? {};
      const parts = this.defaults.skillKey.split(".");
      const type = parts[0];
      if (type === "natural" && parts[1]) {
        const skillKey = parts[1];
        this.defaults.charKey = mapping?.natural?.[skillKey]?.default ?? "";
      } else if (type === "learned" && parts[1]) {
        const skillKey = parts[1];
        this.defaults.charKey = mapping?.learned?.[skillKey]?.default ?? "";
      } else if (type === "group" && parts[1] && parts[2]) {
        const groupKey = parts[1];
        const skillKey = parts[2];
        this.defaults.charKey =
          mapping?.groups?.[groupKey]?.[skillKey]?.default ??
          mapping?.groups?.[groupKey]?.default ??
          "";
      }
    }

    applyDefault("#fs2e-main-char", "#fs2e-main-char-val", this.defaults.charKey);
    applyDefault("#fs2e-comp-char", "#fs2e-comp-char-val", this.defaults.charKey);

    const compSkillSelect = root.querySelector("#fs2e-comp-skill");
    if (compSkillSelect && this.defaults.skillKey) {
      const option = Array.from(compSkillSelect.options).find((opt) => opt.value === this.defaults.skillKey);
      if (option) compSkillSelect.value = this.defaults.skillKey;
    }

    const diffSelects = root.querySelectorAll("[data-diff-select]");
    diffSelects.forEach((select) => {
      select.addEventListener("change", () => updatePreview());
      select.addEventListener("input", () => updatePreview());
    });

    const compToggle = root.querySelector("#fs2e-comp-toggle");
    const compSection = root.querySelector(".fs2e-comp-section");
    if (compToggle && compSection) {
      const update = () => {
        compSection.dataset.enabled = compToggle.checked ? "1" : "0";
        updatePreview();
      };
      compToggle.addEventListener("change", update);
      update();
    }

    const rollComp = root.querySelector("#fs2e-roll-comp");
    if (rollComp) {
      rollComp.addEventListener("click", async (ev) => {
        ev.preventDefault();
        if (this.state.compLocked) return;
        const result = await this.#rollFromForm(root, { isComplementary: true });
        this.state.compResult = result;
        this.render(false);
      });
    }

    const rollMain = root.querySelector("#fs2e-roll-main");
    if (rollMain) {
      rollMain.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const result = await this.#rollFromForm(root, { isComplementary: false });
        this.state.mainResult = result;
        this.state.compLocked = true;
        await this.#postChatCard(result);
        this.render(false);
      });
    }


    const resetBtn = root.querySelector("#fs2e-reset-rolls");
    if (resetBtn) {
      resetBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        this.state = { compResult: null, mainResult: null, compLocked: false };
        this.render(false);
      });
    }

    root.addEventListener("input", (ev) => {
      if (!(ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement)) return;
      updatePreview();
    });
    root.addEventListener("change", (ev) => {
      if (!(ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement)) return;
      updatePreview();
    });

    updatePreview();
  }

  async #rollFromForm(root, { isComplementary }) {
    const getNumber = (sel, fallback = 0) => {
      const el = root.querySelector(sel);
      const val = Number(el?.value ?? fallback);
      return Number.isFinite(val) ? val : fallback;
    };

    const skillVal = isComplementary
      ? Number(root.querySelector("#fs2e-comp-skill")?.selectedOptions?.[0]?.dataset?.value ?? 0)
      : Number(this.defaults.skillValue ?? 0);
    const charSelect = root.querySelector(isComplementary ? "#fs2e-comp-char" : "#fs2e-main-char");
    const charOpt = charSelect?.selectedOptions?.[0];
    const charVal = Number(charOpt?.dataset?.value ?? 0);
    const diffSelect = root.querySelector(isComplementary ? "#fs2e-comp-diff-select" : "#fs2e-main-diff-select");
    const diffVal = Number(diffSelect?.value ?? 0);
    const customDiff = getNumber(isComplementary ? "#fs2e-comp-diff-custom" : "#fs2e-main-diff-custom", 0);
    const diff = diffVal + customDiff;

    const actions = Number(root.querySelector('input[name="fs2e-actions"]:checked')?.value ?? 1);
    const retries = Number(root.querySelector('input[name="fs2e-retries"]:checked')?.value ?? 0);
    const multiPenalty = actions === 1 ? 0 : (actions === 2 ? -4 : -6);
    const retryPenalty = retries === 0 ? 0 : (retries === 1 ? -2 : -4);

    const compVP = isComplementary ? 0 : (this.state.compResult?.totalVP ?? 0);
    const woundPenalty = getWoundPenalty(this.actor);

    const base = charVal + skillVal;
    const gn = base + diff + multiPenalty + retryPenalty + woundPenalty + compVP;

    const roll = await (new Roll("1d20")).roll({ async: true });
    const die = Number(roll.total);

    const natural1 = die === 1;
    const natural20 = die === 20;
    const critSuccess = (die === gn) || (gn > 20 && die === 18);
    const critFailure = natural20;
    const success = natural1 || (!critFailure && die <= gn);

    const successes = success ? Math.max(0, gn - die) : 0;
    const { vp: baseVP, quality } = success ? vpFromSuccesses(successes) : { vp: 0, quality: "Failure" };
    const extraVP = extendedBonus(gn);
    const totalVP = success
      ? (critSuccess ? (baseVP + extraVP) * 2 : (baseVP + extraVP))
      : 0;

    const trace = [
      `Base (char + skill): ${charVal} + ${skillVal} = ${base}`,
      `Difficulty: ${diff >= 0 ? "+" : ""}${diff}`,
      `Multi-action: ${multiPenalty}`,
      `Retry: ${retryPenalty}`,
      `Wound penalty: ${woundPenalty}`,
      `Complementary VP: ${compVP}`,
      `Final GN: ${base} + ${diff} + ${multiPenalty} + ${retryPenalty} + ${woundPenalty} + ${compVP} = ${gn}`
    ].join("\n");

    return {
      isComplementary,
      gn,
      roll: die,
      success,
      natural1,
      natural20,
      critSuccess,
      critFailure,
      successes,
      baseVP,
      extraVP,
      totalVP,
      quality,
      trace
    };
  }

  async #postChatCard(result) {
    const template = "systems/fs2e/templates/chat/roll-card.hbs";
    const html = await renderTemplate(template, {
      title: this.defaults.skillLabel ? `${this.defaults.skillLabel} Roll` : "Roll",
      actorName: this.actor?.name ?? "",
      roll: result.roll,
      gn: result.gn,
      success: result.success,
      successes: result.successes,
      vp: result.totalVP,
      quality: result.quality,
      critSuccess: result.critSuccess,
      critFailure: result.critFailure,
      natural1: result.natural1,
      natural20: result.natural20,
      trace: result.trace
    });
    await ChatMessage.create({
      user: game.user?.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: html
    });
  }
}

export function openDiceRoller(options = {}) {
  const app = new FS2EDiceRoller(options);
  app.render(true);
  return app;
}
