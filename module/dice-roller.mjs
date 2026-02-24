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

const toCamelSuffix = (name) => {
  const parts = (name ?? "")
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (!parts.length) return "";
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
};

const toCamelLower = (name) => {
  const suffix = toCamelSuffix(name);
  if (!suffix) return "";
  return suffix.charAt(0).toLowerCase() + suffix.slice(1);
};

const normalizeCharKey = (value) => toCamelLower(String(value ?? ""));

const mappingDefaultForSkill = (skillKey) => {
  if (!skillKey) return "";
  const mapping = CONFIG?.fs2e?.mappingData ?? {};
  const parts = skillKey.split(".");
  const type = parts[0];
  if (type === "natural" && parts[1]) {
    return normalizeCharKey(mapping?.natural?.[parts[1]]?.default ?? "");
  }
  if (type === "learned" && parts[1]) {
    return normalizeCharKey(mapping?.learned?.[parts[1]]?.default ?? "");
  }
  if (type === "group" && parts[1] && parts[2]) {
    const fallback =
      mapping?.groups?.[parts[1]]?.[parts[2]]?.default ??
      mapping?.groups?.[parts[1]]?.default ??
      "";
    return normalizeCharKey(fallback);
  }
  return "";
};

const vpFromSuccesses = (successes) => {
  const band = QUALITY_BANDS.find((b) => successes >= b.min && successes <= b.max);
  if (band) return { vp: band.vp, quality: band.label };
  if (successes >= 21) {
    const vp = 6 + Math.ceil((successes - 20) / 3);
    return { vp, quality: "Virtuoso" };
  }
  return { vp: 0, quality: "Failure" };
};

const vpFromAccentedSuccesses = (successes, accent) => {
  if (!successes || successes <= 0) return { vp: 0, quality: "Failure" };
  if (accent > 0) {
    const vp = Math.max(1, Math.floor((successes + 1) / 2));
    return { vp, quality: "Accented (+)" };
  }
  if (accent < 0) {
    const vp = Math.max(1, Math.floor((successes + 3) / 4));
    return { vp, quality: "Accented (-)" };
  }
  return vpFromSuccesses(successes);
};

const resolveRoll = ({ die, gn, accent }) => {
  const adjustedRoll = die + accent;
  const natural1 = die === 1;
  const natural18 = die === 18;
  const natural19 = die === 19;
  const natural20 = die === 20;
  const critSuccess = (gn >= 18 && natural18) || (gn < 18 && die === gn);
  const critFailure = natural20;
  const success = natural1 || critSuccess || (!critFailure && !natural19 && adjustedRoll <= gn);

  const successes = success ? Math.max(1, gn - adjustedRoll) : 0;
  const { vp: baseVP, quality: baseQuality } = success
    ? vpFromAccentedSuccesses(successes, accent)
    : { vp: 0, quality: "Failure" };
  const extraVP = extendedBonus(gn);
  const totalVP = success
    ? (critSuccess ? (baseVP + extraVP) * 2 : (baseVP + extraVP))
    : 0;
  const quality = critFailure ? "Critical Failure" : baseQuality;

  return {
    adjustedRoll,
    natural1,
    natural20,
    critSuccess,
    critFailure,
    success,
    successes,
    baseVP,
    extraVP,
    totalVP,
    quality
  };
};

const resolveSustain = ({ sustainEnabled, sustainCurrent, sustainTaskValue, totalVP }) => {
  const sustainTotal = sustainEnabled ? (sustainCurrent + totalVP) : totalVP;
  const sustainCompleted = sustainEnabled && sustainTaskValue > 0 && sustainTotal >= sustainTaskValue;
  return { sustainTotal, sustainCompleted };
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

const getCharacteristicValue = (actor, key) => {
  if (!actor || !key) return 0;
  const ch = actor.system?.characteristics ?? actor.system?.system?.characteristics ?? {};
  const groups = ["body", "mind", "spirit", "occult"];
  for (const group of groups) {
    if (ch[group]?.[key]) return sumStat(ch[group][key]);
  }
  return 0;
};

const getCharacteristicLabel = (key) => labelize(key ?? "");

const getSkillValue = (actor, key) => {
  if (!actor || !key) return 0;
  const parts = key.split(".");
  const type = parts[0];
  const skills = actor.system?.skills ?? actor.system?.system?.skills ?? {};
  if (type === "natural" && parts[1]) return sumStat(skills.natural?.[parts[1]]);
  if (type === "learned" && parts[1]) return sumStat(skills.learned?.[parts[1]]);
  if (type === "group" && parts[1] && parts[2]) return sumStat(skills.learned?.[parts[1]]?.[parts[2]]);
  return 0;
};

const getSkillLabel = (actor, key) => {
  if (!actor || !key) return "";
  const parts = key.split(".");
  const type = parts[0];
  const skills = actor.system?.skills ?? actor.system?.system?.skills ?? {};
  if (type === "natural" && parts[1]) return labelize(parts[1]);
  if (type === "learned" && parts[1]) return labelize(parts[1]);
  if (type === "group" && parts[1] && parts[2]) {
    const sub = skills.learned?.[parts[1]]?.[parts[2]];
    if (typeof sub?.display === "string" && sub.display.trim()) return sub.display;
    return labelize(parts[2]);
  }
  return labelize(parts[parts.length - 1] ?? "");
};

const findTargetOwner = (actor) => {
  const owner = game.users?.find((u) => u.active && actor?.testUserPermission?.(u, "OWNER"));
  return owner ?? game.users?.find((u) => u.active && u.isGM) ?? game.user ?? null;
};

const postContestedChat = async ({ attacker, attackerResult, defender, defenderResult }) => {
  const template = "systems/fs2e/templates/chat/contested-card.hbs";
  const eff = (r) => (r.critSuccess ? (r.successes ?? 0) * 2 : (r.successes ?? 0));
  const netSuccesses = eff(attackerResult) - eff(defenderResult);
  const success = netSuccesses > 0;
  const { vp: baseVP, quality: baseQuality } = success
    ? vpFromAccentedSuccesses(netSuccesses, attackerResult.accent ?? 0)
    : { vp: 0, quality: "Failure" };
  const extraVP = extendedBonus(attackerResult.gn ?? 0);
  const totalVP = success
    ? (attackerResult.critSuccess ? (baseVP + extraVP) * 2 : (baseVP + extraVP))
    : 0;
  const quality = attackerResult.critFailure ? "Critical Failure" : baseQuality;
  const html = await renderTemplate(template, {
    attacker: {
      title: attackerResult.skillLabel ? `${attackerResult.skillLabel} Roll` : "Roll",
      actorName: attacker?.name ?? "",
      actorImg: attacker?.img ?? "",
      roll: attackerResult.roll,
      rollAdjusted: attackerResult.rollAdjusted,
      accent: attackerResult.accent,
      gn: attackerResult.gn,
      breakdown: attackerResult.breakdown
    },
    defender: {
      title: defenderResult.skillLabel ? `${defenderResult.skillLabel} Roll` : "Roll",
      actorName: defender?.name ?? "",
      actorImg: defender?.img ?? "",
      roll: defenderResult.roll,
      rollAdjusted: defenderResult.rollAdjusted,
      accent: defenderResult.accent,
      gn: defenderResult.gn,
      breakdown: defenderResult.breakdown
    },
    outcome: {
      success,
      successes: success ? netSuccesses : 0,
      vp: totalVP,
      quality
    }
  });
  await ChatMessage.create({
    user: game.user?.id,
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: html
  });
};

const buildResultFromPreset = async (actor, preset = {}) => {
  const skillKey = preset.skillKey ?? "";
  const charKey = preset.charKey ?? "";
  const skillVal = getSkillValue(actor, skillKey);
  const charVal = getCharacteristicValue(actor, charKey);
  const diff = Number(preset.diffValue ?? 0) + Number(preset.customDiff ?? 0);
  const actions = Number(preset.actions ?? 1);
  const retries = Number(preset.retries ?? 0);
  const multiPenalty = actions === 1 ? 0 : (actions === 2 ? -4 : -6);
  const retryPenalty = retries === 0 ? 0 : (retries === 1 ? -2 : -4);
  const woundPenalty = getWoundPenalty(actor);
  const compVP = Number(preset.compResult?.totalVP ?? 0);
  const sustainEnabled = !!preset.sustainEnabled;
  const sustainTaskValue = Number(preset.sustainTaskValue ?? 0);
  const sustainCurrent = Number(preset.sustainCurrent ?? 0);
  const accentMax = Math.max(0, Number.isFinite(skillVal) ? skillVal : 0);
  const accent = clamp(Number(preset.accent ?? 0), -accentMax, accentMax);

  const base = charVal + skillVal;
  const gn = base + diff + multiPenalty + retryPenalty + woundPenalty + compVP;

  const skillLabel = getSkillLabel(actor, skillKey);
  const charLabel = getCharacteristicLabel(charKey);
  const breakdown = [
    { label: `${charLabel} + ${skillLabel}`, value: `${base}` },
    { label: "Difficulty", value: `${diff}` },
    { label: "Multi-action", value: `${multiPenalty}` },
    { label: "Retry", value: `${retryPenalty}` },
    { label: "Wound penalty", value: `${woundPenalty}` },
    { label: "Complementary VP", value: `${compVP}` }
  ];

  const roll = await (new Roll("1d20")).roll({ async: true });
  const die = Number(roll.total);
  const rollResult = resolveRoll({ die, gn, accent });
  const sustainResult = resolveSustain({
    sustainEnabled,
    sustainCurrent,
    sustainTaskValue,
    totalVP: rollResult.totalVP
  });

  const trace = [
    `Base (char + skill): ${charVal} + ${skillVal} = ${base}`,
    `Difficulty: ${diff >= 0 ? "+" : ""}${diff}`,
    `Multi-action: ${multiPenalty}`,
    `Retry: ${retryPenalty}`,
    `Wound penalty: ${woundPenalty}`,
    `Accent: ${accent}`,
    `Complementary VP: ${compVP}`,
    `Final GN: ${base} + ${diff} + ${multiPenalty} + ${retryPenalty} + ${woundPenalty} + ${compVP} = ${gn}`
  ].join("\n");

  return {
    gn,
    roll: die,
    rollAdjusted: rollResult.adjustedRoll,
    accent,
    success: rollResult.success,
    natural1: rollResult.natural1,
    natural20: rollResult.natural20,
    critSuccess: rollResult.critSuccess,
    critFailure: rollResult.critFailure,
    successes: rollResult.successes,
    baseVP: rollResult.baseVP,
    extraVP: rollResult.extraVP,
    totalVP: rollResult.totalVP,
    sustainEnabled,
    sustainCurrent,
    sustainTaskValue,
    sustainTotal: sustainResult.sustainTotal,
    sustainCompleted: sustainResult.sustainCompleted,
    quality: rollResult.quality,
    breakdown,
    trace,
    skillLabel
  };
};

const postChatCard = async (actor, result, preset) => {
  const retries = Number(preset?.retries ?? 0);
  const showRetry = retries < 2;
  const template = "systems/fs2e/templates/chat/roll-card.hbs";
  const html = await renderTemplate(template, {
    title: result.skillLabel ? `${result.skillLabel} Roll` : "Roll",
    skillLabel: result.skillLabel ?? "",
    actorName: actor?.name ?? "",
    actorImg: actor?.img ?? "",
    showRetry,
    showContinue: !!result.sustainEnabled,
    roll: result.roll,
    rollAdjusted: result.rollAdjusted,
    accent: result.accent,
    gn: result.gn,
    success: result.success,
    successes: result.successes,
    vp: result.totalVP,
    sustainEnabled: result.sustainEnabled,
    sustainCurrent: result.sustainCurrent,
    sustainTaskValue: result.sustainTaskValue,
    sustainTotal: result.sustainTotal,
    sustainCompleted: result.sustainCompleted,
    quality: result.quality,
    critSuccess: result.critSuccess,
    critFailure: result.critFailure,
    natural1: result.natural1,
    natural20: result.natural20,
    breakdown: result.breakdown,
    trace: result.trace
  });
  await ChatMessage.create({
    user: game.user?.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    flags: {
      fs2e: {
        rollPreset: preset ?? null,
        lastVP: result.sustainEnabled ? (result.sustainTotal ?? 0) : (result.totalVP ?? 0)
      }
    }
  });
};


export class FS2EDiceRoller extends Application {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
    this.defaults = {
      skillKey: options.defaultSkillKey ?? "",
      charKey: options.defaultCharacteristicKey ?? ""
    };
    this.preset = options.preset ?? null;
    this.state = {
      compResult: null,
      mainResult: null,
      compLocked: false,
      sustainEnabled: false,
      sustainTaskValue: 6,
      sustainCurrent: 0,
      contestedEnabled: false
    };
    if (this.preset?.compResult) {
      this.state.compResult = this.preset.compResult;
    }
    if (typeof this.preset?.compLocked === "boolean") {
      this.state.compLocked = this.preset.compLocked;
    }
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

  get title() {
    if (this.preset?.contestedResponder) {
      const attackerSkill = this.preset?.contestedRequest?.attackerResult?.skillLabel ?? "";
      return attackerSkill ? `Contested ${attackerSkill}` : "Contested Roll";
    }
    return this.defaults?.skillLabel ? `${this.defaults.skillLabel} Roll` : "Dice Roller";
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
    if (this.defaults.skillKey) {
      const hasChar = characteristics.some((c) => c.key === this.defaults.charKey);
      if (!this.defaults.charKey || !hasChar) {
        this.defaults.charKey = mappingDefaultForSkill(this.defaults.skillKey);
      }
    }
    return {
      actor: this.actor,
      skills,
      characteristics,
      difficulties: DIFFICULTY_OPTIONS,
      state: this.state,
      defaults: this.defaults,
      contestedAvailable: (game?.user?.targets?.size ?? 0) > 0 && !this.preset?.contestedResponder,
      contestedEnabled: this.preset?.contestedEnabled ?? this.state.contestedEnabled,
      contestedResponder: !!this.preset?.contestedResponder,
      contestedTitle: this.preset?.contestedResponder
        ? (() => {
          const attackerSkill = this.preset?.contestedRequest?.attackerResult?.skillLabel ?? "";
          return attackerSkill ? `Contested ${attackerSkill}` : "Contested Roll";
        })()
        : ""
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
      const mainSkillSelect = root.querySelector("#fs2e-main-skill");
      const skillVal = mainSkillSelect
        ? Number(mainSkillSelect.selectedOptions?.[0]?.dataset?.value ?? 0)
        : Number(this.defaults.skillValue ?? 0);
      const accentMax = Math.max(0, Number.isFinite(skillVal) ? skillVal : 0);
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

      const sustainTaskSelect = root.querySelector("#fs2e-sustain-task-select");
      if (sustainTaskSelect) {
        const sustainOpt = sustainTaskSelect.selectedOptions?.[0];
        const sustainVal = Number(sustainOpt?.dataset?.value ?? sustainTaskSelect.value ?? 0);
        const sustainTotal = root.querySelector("#fs2e-sustain-required");
        if (sustainTotal) sustainTotal.value = Number.isFinite(sustainVal) ? sustainVal : 0;
      }
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

      const accentInput = root.querySelector("#fs2e-accent-value");
      if (accentInput) {
        const accentVal = getNumber("#fs2e-accent-value", 0);
        accentInput.value = clamp(accentVal, -accentMax, accentMax);
      }
    };

    const cacheSustainState = () => {
      this.state.sustainEnabled = root.querySelector("#fs2e-sustain-toggle")?.checked ?? false;
      const sustainTaskSelect = root.querySelector("#fs2e-sustain-task-select");
      this.state.sustainTaskValue = Number(
        sustainTaskSelect?.selectedOptions?.[0]?.dataset?.value ?? sustainTaskSelect?.value ?? this.state.sustainTaskValue
      );
      this.state.sustainCurrent = Number(root.querySelector("#fs2e-sustain-current-successes")?.value ?? 0);
    };
    const cacheContestedState = () => {
      const contestedToggle = root.querySelector("#fs2e-contested-toggle");
      if (contestedToggle) this.state.contestedEnabled = contestedToggle.checked;
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

    if (this.defaults.skillKey) {
      const mainCharSelect = root.querySelector("#fs2e-main-char");
      const hasChar =
        !!mainCharSelect &&
        Array.from(mainCharSelect.options).some((opt) => opt.value === this.defaults.charKey);
      if (!this.defaults.charKey || !hasChar) {
        this.defaults.charKey = mappingDefaultForSkill(this.defaults.skillKey);
      }
    }

    applyDefault("#fs2e-main-char", "#fs2e-main-char-val", this.defaults.charKey);
    applyDefault("#fs2e-comp-char", "#fs2e-comp-char-val", this.defaults.charKey);

    const compSkillSelect = root.querySelector("#fs2e-comp-skill");
    if (compSkillSelect && this.defaults.skillKey) {
      const option = Array.from(compSkillSelect.options).find((opt) => opt.value === this.defaults.skillKey);
      if (option) compSkillSelect.value = this.defaults.skillKey;
    }

    const applyPreset = () => {
      if (!this.preset) return;
      const preset = this.preset;
      if (preset.compResult) {
        this.state.compResult = preset.compResult;
      }
      if (typeof preset.compLocked === "boolean") {
        this.state.compLocked = preset.compLocked;
      }
      if (typeof preset.contestedEnabled === "boolean") {
        this.state.contestedEnabled = preset.contestedEnabled;
      }
        const compToggle = root.querySelector("#fs2e-comp-toggle");
        if (compToggle && typeof preset.compEnabled === "boolean") {
          compToggle.checked = preset.compEnabled;
        }
        const sustainToggle = root.querySelector("#fs2e-sustain-toggle");
        if (sustainToggle && typeof preset.sustainEnabled === "boolean") {
          sustainToggle.checked = preset.sustainEnabled;
        }
        const contestedToggle = root.querySelector("#fs2e-contested-toggle");
        if (contestedToggle && typeof preset.contestedEnabled === "boolean") {
          contestedToggle.checked = preset.contestedEnabled;
        }
      if (preset.charKey) applyDefault("#fs2e-main-char", "#fs2e-main-char-val", preset.charKey);
      if (preset.compCharKey) applyDefault("#fs2e-comp-char", "#fs2e-comp-char-val", preset.compCharKey);
      if (preset.compSkillKey) {
        const compSkill = root.querySelector("#fs2e-comp-skill");
        if (compSkill) compSkill.value = preset.compSkillKey;
      }
        const mainDiff = root.querySelector("#fs2e-main-diff-select");
        if (mainDiff && preset.diffValue !== undefined) mainDiff.value = String(preset.diffValue);
        const compDiff = root.querySelector("#fs2e-comp-diff-select");
        if (compDiff && preset.compDiffValue !== undefined) compDiff.value = String(preset.compDiffValue);
        const sustainTask = root.querySelector("#fs2e-sustain-task-select");
        if (sustainTask && preset.sustainTaskValue !== undefined) {
          sustainTask.value = String(preset.sustainTaskValue);
        }
        const mainCustom = root.querySelector("#fs2e-main-diff-custom");
        if (mainCustom && preset.customDiff !== undefined) mainCustom.value = String(preset.customDiff);
        const compCustom = root.querySelector("#fs2e-comp-diff-custom");
        if (compCustom && preset.compCustomDiff !== undefined) compCustom.value = String(preset.compCustomDiff);
        const sustainCurrent = root.querySelector("#fs2e-sustain-current-successes");
        if (sustainCurrent && preset.sustainCurrent !== undefined) {
          sustainCurrent.value = String(preset.sustainCurrent);
        }
      if (preset.actions !== undefined) {
        const actionRadio = root.querySelector(`input[name="fs2e-actions"][value="${preset.actions}"]`);
        if (actionRadio) actionRadio.checked = true;
      }
      if (preset.retries !== undefined) {
        const retryRadio = root.querySelector(`input[name="fs2e-retries"][value="${preset.retries}"]`);
        if (retryRadio) retryRadio.checked = true;
      }
      if (preset.accent !== undefined) {
        const accentInput = root.querySelector("#fs2e-accent-value");
        if (accentInput) accentInput.value = String(preset.accent);
      }
      const compSection = root.querySelector(".fs2e-comp-section");
        if (compToggle && compSection) {
          compSection.dataset.enabled = compToggle.checked ? "1" : "0";
        }
        const sustainSection = root.querySelector(".fs2e-sustain-section");
      if (sustainToggle && sustainSection) {
        sustainSection.dataset.enabled = sustainToggle.checked ? "1" : "0";
      }
      cacheSustainState();
      cacheContestedState();
    };

    if (!this.preset) {
      const sustainToggle = root.querySelector("#fs2e-sustain-toggle");
      if (sustainToggle) sustainToggle.checked = !!this.state.sustainEnabled;
      const sustainTask = root.querySelector("#fs2e-sustain-task-select");
      if (sustainTask) sustainTask.value = String(this.state.sustainTaskValue ?? 6);
      const sustainCurrent = root.querySelector("#fs2e-sustain-current-successes");
      if (sustainCurrent) sustainCurrent.value = String(this.state.sustainCurrent ?? 0);
      const contestedToggle = root.querySelector("#fs2e-contested-toggle");
      if (contestedToggle) contestedToggle.checked = (game?.user?.targets?.size ?? 0) > 0;
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

    const sustainToggle = root.querySelector("#fs2e-sustain-toggle");
    const sustainSection = root.querySelector(".fs2e-sustain-section");
    if (sustainToggle && sustainSection) {
      const update = () => {
        sustainSection.dataset.enabled = sustainToggle.checked ? "1" : "0";
        cacheSustainState();
        updatePreview();
      };
      sustainToggle.addEventListener("change", update);
      update();
    }
    const contestedToggle = root.querySelector("#fs2e-contested-toggle");
    if (contestedToggle) {
      contestedToggle.addEventListener("change", () => cacheContestedState());
      cacheContestedState();
    }

    const rollComp = root.querySelector("#fs2e-roll-comp");
    if (rollComp) {
      rollComp.addEventListener("click", async (ev) => {
        ev.preventDefault();
        if (this.state.compLocked) return;
        cacheSustainState();
        cacheContestedState();
        const result = await this._rollFromForm(root, { isComplementary: true });
        this.state.compResult = result;
        this.render(false);
      });
    }

    const rollMain = root.querySelector("#fs2e-roll-main");
    if (rollMain) {
      rollMain.addEventListener("click", async (ev) => {
        ev.preventDefault();
        cacheSustainState();
        cacheContestedState();
        const result = await this._rollFromForm(root, { isComplementary: false });
        this.state.mainResult = result;
        this.state.compLocked = true;
        if (result.preset?.contestedEnabled && !result.preset?.contestedResponder) {
          const targets = Array.from(game.user?.targets ?? []);
          if (!targets.length) {
            ui.notifications?.warn?.("No valid target for contested roll.");
            return;
          }
          let sent = 0;
          for (const target of targets) {
            const targetActor = target?.actor ?? null;
            const owner = targetActor ? findTargetOwner(targetActor) : null;
            if (!targetActor || !owner) continue;
            const payload = {
              type: "contested-request",
              targetUserId: owner.id,
              targetActorUuid: targetActor.uuid,
              attackerUuid: this.actor?.uuid ?? "",
              attackerResult: result
            };
            if (owner.id === game.user?.id) {
              game.fs2e?.openDiceRoller?.({
                actor: targetActor,
                preset: {
                  contestedResponder: true,
                  contestedEnabled: false,
                  contestedRequest: {
                    attackerUuid: payload.attackerUuid,
                    attackerResult: payload.attackerResult
                  }
                }
              });
            } else {
              game.socket?.emit("system.fs2e", payload);
            }
            sent++;
          }
          if (!sent) {
            ui.notifications?.warn?.("No valid targets for contested roll.");
            return;
          }
          ui.notifications?.info?.("Contested roll sent to target.");
          this.close();
          return;
        }
        if (result.preset?.contestedResponder && result.preset?.contestedRequest) {
          const req = result.preset.contestedRequest;
          const attacker = await fromUuid(req.attackerUuid);
          if (attacker) {
      await postContestedChat({
        attacker,
        attackerResult: req.attackerResult,
        defender: this.actor,
        defenderResult: result
      });
          } else {
            await this._postChatCard(result);
          }
          this.close();
          return;
        }
        await this._postChatCard(result);
        this.close();
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

    root.querySelectorAll(".fs2e-accent-btn").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const step = Number(ev.currentTarget.dataset.accentStep ?? 0);
        const input = root.querySelector("#fs2e-accent-value");
        if (!input) return;
        const current = Number(input.value ?? 0);
        const skillVal = Number(this.defaults.skillValue ?? 0);
        const accentMax = Math.max(0, Number.isFinite(skillVal) ? skillVal : 0);
        const next = current + (Number.isFinite(step) ? step : 0);
        input.value = clamp(next, -accentMax, accentMax);
        updatePreview();
      });
    });

    root.addEventListener("input", (ev) => {
      if (!(ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement)) return;
      updatePreview();
    });
    root.addEventListener("change", (ev) => {
      if (!(ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement)) return;
      updatePreview();
    });

    applyPreset();
    updatePreview();
  }

  async _rollFromForm(root, { isComplementary }) {
    const getNumber = (sel, fallback = 0) => {
      const el = root.querySelector(sel);
      const val = Number(el?.value ?? fallback);
      return Number.isFinite(val) ? val : fallback;
    };

    const mainSkillSelect = root.querySelector("#fs2e-main-skill");
    const skillVal = isComplementary
      ? Number(root.querySelector("#fs2e-comp-skill")?.selectedOptions?.[0]?.dataset?.value ?? 0)
      : Number(
        mainSkillSelect?.selectedOptions?.[0]?.dataset?.value ?? this.defaults.skillValue ?? 0
      );
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
    const accentMax = Math.max(0, Number.isFinite(this.defaults.skillValue) ? this.defaults.skillValue : 0);
    const accent = clamp(getNumber("#fs2e-accent-value", 0), -accentMax, accentMax);
    const contestedEnabled = root.querySelector("#fs2e-contested-toggle")?.checked ?? false;
    const sustainEnabled = !contestedEnabled && (root.querySelector("#fs2e-sustain-toggle")?.checked ?? false);
    const sustainTaskSelect = root.querySelector("#fs2e-sustain-task-select");
    const sustainTaskValue = Number(
      sustainTaskSelect?.selectedOptions?.[0]?.dataset?.value ?? sustainTaskSelect?.value ?? 0
    );
    const sustainCurrent = getNumber("#fs2e-sustain-current-successes", 0);

    const base = charVal + skillVal;
    const gn = base + diff + multiPenalty + retryPenalty + woundPenalty + compVP;

    const skillLabel = isComplementary
      ? (root.querySelector("#fs2e-comp-skill")?.selectedOptions?.[0]?.textContent ?? "").trim()
      : (mainSkillSelect?.selectedOptions?.[0]?.textContent ?? this.defaults.skillLabel ?? "").trim();
    const charLabel = (charOpt?.textContent ?? "").trim();
    const preset = {
      actorUuid: this.actor?.uuid ?? "",
      skillKey: mainSkillSelect?.value ?? this.defaults.skillKey ?? "",
      charKey: charSelect?.value ?? "",
      diffValue: diffSelect?.value ?? 0,
      customDiff,
      actions,
      retries,
      compEnabled: root.querySelector("#fs2e-comp-toggle")?.checked ?? false,
      compSkillKey: root.querySelector("#fs2e-comp-skill")?.value ?? "",
      compCharKey: root.querySelector("#fs2e-comp-char")?.value ?? "",
      compDiffValue: root.querySelector("#fs2e-comp-diff-select")?.value ?? 0,
      compCustomDiff: getNumber("#fs2e-comp-diff-custom", 0),
      accent,
      compResult: this.state.compResult ? { totalVP: this.state.compResult.totalVP ?? 0 } : null,
      compLocked: this.state.compLocked,
      sustainEnabled,
      sustainTaskValue,
      sustainCurrent,
      contestedEnabled,
      contestedResponder: !!this.preset?.contestedResponder,
      contestedRequest: this.preset?.contestedRequest ?? null
    };
    const breakdown = [
      { label: `${charLabel} + ${skillLabel}`, value: `${base}` },
      { label: "Difficulty", value: `${diff}` },
      { label: "Multi-action", value: `${multiPenalty}` },
      { label: "Retry", value: `${retryPenalty}` },
      { label: "Wound penalty", value: `${woundPenalty}` },
      { label: "Complementary VP", value: `${compVP}` }
    ];


    const roll = await (new Roll("1d20")).roll({ async: true });
    const die = Number(roll.total);
    const rollResult = resolveRoll({ die, gn, accent });
    const sustainResult = resolveSustain({
      sustainEnabled,
      sustainCurrent,
      sustainTaskValue,
      totalVP: rollResult.totalVP
    });

    const trace = [
      `Base (char + skill): ${charVal} + ${skillVal} = ${base}`,
      `Difficulty: ${diff >= 0 ? "+" : ""}${diff}`,
      `Multi-action: ${multiPenalty}`,
      `Retry: ${retryPenalty}`,
      `Wound penalty: ${woundPenalty}`,
      `Accent: ${accent}`,
      `Complementary VP: ${compVP}`,
      `Final GN: ${base} + ${diff} + ${multiPenalty} + ${retryPenalty} + ${woundPenalty} + ${compVP} = ${gn}`
    ].join("\n");

    return {
      isComplementary,
      gn,
      roll: die,
      rollAdjusted: rollResult.adjustedRoll,
      accent,
      success: rollResult.success,
      natural1: rollResult.natural1,
      natural20: rollResult.natural20,
      critSuccess: rollResult.critSuccess,
      critFailure: rollResult.critFailure,
      successes: rollResult.successes,
      baseVP: rollResult.baseVP,
      extraVP: rollResult.extraVP,
      totalVP: rollResult.totalVP,
      sustainEnabled,
      sustainCurrent,
      sustainTaskValue,
      sustainTotal: sustainResult.sustainTotal,
      sustainCompleted: sustainResult.sustainCompleted,
      quality: rollResult.quality,
      breakdown,
      trace,
      preset,
      skillLabel
    };
  }

  async _postChatCard(result) {
    await postChatCard(this.actor, {
      ...result,
      skillLabel: result.skillLabel ?? this.defaults.skillLabel ?? ""
    }, result.preset ?? null);
  }
}

export function openDiceRoller(options = {}) {
  const app = new FS2EDiceRoller(options);
  if (options?.preset?.contestedResponder) {
    const attackerSkill = options?.preset?.contestedRequest?.attackerResult?.skillLabel ?? "";
    app.options.title = attackerSkill ? `Contested ${attackerSkill}` : "Contested Roll";
  }
  app.render(true);
  return app;
}

export async function rollFromPreset({ actor, preset }) {
  if (!actor || !preset) return;
  const result = await buildResultFromPreset(actor, preset);
  await postChatCard(actor, result, preset);
}
