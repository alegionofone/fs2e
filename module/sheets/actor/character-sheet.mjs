// systems/fs2e/module/sheets/actor/character-sheet.mjs
// FS2E Character sheet (Foundry VTT v13)

export class FS2ECharacterSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["fs2e", "sheet", "actor", "character"],
      template: "systems/fs2e/templates/actor/character-sheet.hbs",
      width: 620,
      height: 720,
      submitOnChange: true // update as you type
    });
  }

  /** @override */
  getData(options = {}) {
    const context = super.getData(options);
    context.actor = this.actor;
    context.system = this.actor.system;

    // ---------------- helpers ----------------
    const num  = (n, d = 0) => Number(n ?? d);
    const sum  = (s) => num(s?.base) + num(s?.temp) + num(s?.mod);
    const clamp = (n, min, max) => Math.min(Math.max(num(n), min), max);
    const labelize = (k) =>
      (k ?? "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    const toCamelSuffix = (name) => {
      const parts = (name ?? "")
        .trim()
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean);
      if (!parts.length) return "";
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
    };
    const toCamelLower = (name) => {
      const suffix = toCamelSuffix(name);
      if (!suffix) return "";
      return suffix.charAt(0).toLowerCase() + suffix.slice(1);
    };
    const normalizeSkillKey = (value) => toCamelLower(String(value ?? ""));

    // Tooltips WITHOUT the "— / Total" line
    const breakdown = (_label, s) => {
      const b = num(s?.base), h = num(s?.history), x = num(s?.xp);
      const m = num(s?.mod), t = num(s?.temp);
      const trait = b + h + x;
      return `Trait: ${trait}\nMod: ${m}\nTemp: ${t}`;
    };

    const skillInfo = CONFIG?.fs2e?.mappingData ?? {};
    const charInfo = skillInfo?.characteristics ?? {};
    const getSkillInfo = (type, key, groupKey) => {
      if (!key) return "";
      if (type === "group") {
        return skillInfo?.groups?.[groupKey]?.[key] ?? "";
      }
      if (type === "natural") {
        return skillInfo?.natural?.[key] ?? "";
      }
      return skillInfo?.learned?.[key] ?? "";
    };
    const formatSkillTooltip = (info) => {
      const desc = typeof info?.desc === "string" ? info.desc.trim() : "";
      const comp = typeof info?.comp === "string" ? info.comp.trim() : "";
      const options = typeof info?.options === "string" ? info.options.trim() : "";
      if (!desc && !comp && !options) return "";
      const descHtml = desc ? `<div class="fs2e-tooltip-desc">${desc}</div>` : "";
      const compHtml = comp
        ? `<div class="fs2e-tooltip-comp"><span class="fs2e-tooltip-comp-label">Complimentary Skills:</span> ${comp}</div>`
        : "";
      const optionsHtml = options
        ? `<div class="fs2e-tooltip-comp"><span class="fs2e-tooltip-comp-label">Optional Skills:</span> ${options}</div>`
        : "";
      return `${descHtml}${compHtml}${optionsHtml}`;
    };
    const getCharDesc = (key) =>
      typeof charInfo?.[key]?.desc === "string" ? charInfo[key].desc.trim() : "";
    const formatCharTooltip = (key) => {
      const desc = getCharDesc(key);
      return desc ? `<div class="fs2e-tooltip-desc">${desc}</div>` : "";
    };

    const buildAttrEntry = (key, src = {}, { type = "learned" } = {}) => {
      const s = src?.[key] ?? {};
      const base = num(s.base), history = num(s.history), xp = num(s.xp);
      const mod = num(s.mod), temp = num(s.temp), max = num(s.max);
      const total = base + temp + mod;
      const label = labelize(key);
      const info = getSkillInfo(type, key);
      const tooltipDesc = formatSkillTooltip(info);
      const trait = base + history + xp;
      const tooltipStats = `Trait: ${trait}\nMod: ${mod}\nTemp: ${temp}`;
      return {
        key,
        label,
        base, history, xp, mod, temp, max, total,
        tooltipStats,
        tooltipDesc
      };
    };
    const buildCharEntry = (key, src = {}) => {
      const s = src?.[key] ?? {};
      const base = num(s.base), history = num(s.history), xp = num(s.xp);
      const mod = num(s.mod), temp = num(s.temp), max = num(s.max);
      const total = base + temp + mod;
      const label = labelize(key);
      const trait = base + history + xp;
      return {
        key,
        label,
        base, history, xp, mod, temp, max, total,
        tooltipStats: `Trait: ${trait}\nMod: ${mod}\nTemp: ${temp}`,
        tooltipDesc: formatCharTooltip(key)
      };
    };

    // ---------------- characteristics ----------------
    const ch = context.system?.characteristics ?? {};
    const body   = ch.body   ?? {};
    const mind   = ch.mind   ?? {};
    const spirit = ch.spirit ?? {};
    const occult = ch.occult ?? {};

    const spiritOpposite = {
      extrovert: "introvert",
      introvert: "extrovert",
      passion: "calm",
      calm: "passion",
      faith: "ego",
      ego: "faith"
    };
    const spiritMax = (key) => 10 - num(spirit?.[spiritOpposite[key]]?.base);

    // Totals (used by characteristics HBS)
    context.totals = {
      characteristics: {
        body: {
          strength: sum(body.strength),
          dexterity: sum(body.dexterity),
          endurance: sum(body.endurance)
        },
        mind: {
          wits: sum(mind.wits),
          perception: sum(mind.perception),
          tech: sum(mind.tech)
        },
        spirit: {
          extrovert: sum(spirit.extrovert),
          introvert: sum(spirit.introvert),
          passion: sum(spirit.passion),
          calm: sum(spirit.calm),
          faith: sum(spirit.faith),
          ego: sum(spirit.ego)
        },
        occult: {
          psi: sum(occult.psi),
          theurgy: sum(occult.theurgy)
        }
      }
    };

    // Tooltips (no Total line)
    context.tooltips = {
      characteristics: {
        body: {
          strength: breakdown("Strength", body.strength),
          dexterity: breakdown("Dexterity", body.dexterity),
          endurance: breakdown("Endurance", body.endurance)
        },
        mind: {
          wits: breakdown("Wits", mind.wits),
          perception: breakdown("Perception", mind.perception),
          tech: breakdown("Tech", mind.tech)
        },
        spirit: {
          extrovert: breakdown("Extrovert", spirit.extrovert),
          introvert: breakdown("Introvert", spirit.introvert),
          passion: breakdown("Passion", spirit.passion),
          calm: breakdown("Calm", spirit.calm),
          faith: breakdown("Faith", spirit.faith),
          ego: breakdown("Ego", spirit.ego)
        },
        occult: {
          psi: breakdown("Psi", occult.psi),
          theurgy: breakdown("Theurgy", occult.theurgy)
        }
      }
    };

    // Iterable view model for characteristics
    const BODY_ORDER = ["strength", "dexterity", "endurance"];
    const MIND_ORDER = ["wits", "perception", "tech"];
    const SPIRIT_AXES = [
      { left: { key: "extrovert", label: "Extrovert" }, right: { key: "introvert", label: "Introvert" } },
      { left: { key: "passion",   label: "Passion"   }, right: { key: "calm",      label: "Calm"      } },
      { left: { key: "faith",     label: "Faith"     }, right: { key: "ego",       label: "Ego"       } }
    ];

    context.view = context.view ?? {};
    context.view.characteristics = {
      body: BODY_ORDER.map((k) => buildCharEntry(k, body)),
      mind: MIND_ORDER.map((k) => buildCharEntry(k, mind)),
      spirit: {
        left:  SPIRIT_AXES.map(ax => ({
          leftKey: ax.left.key,
          leftLabel: ax.left.label,
          total: sum(spirit[ax.left.key]),
          max: spiritMax(ax.left.key),
          tooltipStats: breakdown(labelize(ax.left.key), spirit[ax.left.key]),
          tooltipDesc: formatCharTooltip(ax.left.key)
        })),
        right: SPIRIT_AXES.map(ax => ({
          rightKey: ax.right.key,
          rightLabel: ax.right.label,
          total: sum(spirit[ax.right.key]),
          max: spiritMax(ax.right.key),
          tooltipStats: breakdown(labelize(ax.right.key), spirit[ax.right.key]),
          tooltipDesc: formatCharTooltip(ax.right.key)
        }))
      }
    };

    // ---------------- vitality / wyrd ----------------
    const enduranceTotal = sum(body.endurance);
    const nonVitalMax = Math.max(0, enduranceTotal);
    const vitalMax = 5;
    const vitalityData = context.system?.vitality ?? {};
    const nonVital = clamp(vitalityData.nonVital ?? nonVitalMax, 0, nonVitalMax);
    const vital = clamp(vitalityData.vital ?? vitalMax, 0, vitalMax);
    const totalMax = nonVitalMax + vitalMax;
    const total = nonVital + vital;
    const vitalLost = Math.max(0, vitalMax - vital);
    const woundPenalty = nonVital > 0 ? 0 : -2 * vitalLost;

    const buildTrack = (filledCount, maxCount, { nonVitalCount = 0 } = {}) => {
      const track = [];
      for (let i = 1; i <= 20; i += 1) {
        const active = i <= maxCount;
        const filled = i <= filledCount;
        const type = i <= nonVitalCount ? "nonvital" : (i <= maxCount ? "vital" : "");
        track.push({ index: i, active, filled, type });
      }
      return track;
    };

    context.view.vitality = {
      nonVital,
      vital,
      nonVitalMax,
      vitalMax,
      total,
      totalMax,
      woundPenalty,
      track: buildTrack(total, totalMax, { nonVitalCount: nonVitalMax })
    };

    const wyrdData = context.system?.wyrd ?? {};
    const wyrdMax = Math.max(0, num(wyrdData.max, 20));
    const wyrdValue = clamp(wyrdData.value ?? 0, 0, wyrdMax);
    context.view.wyrd = {
      value: wyrdValue,
      max: wyrdMax,
      track: buildTrack(wyrdValue, wyrdMax)
    };

    // ---------------- skills (iterable) ----------------
    const systemSkills = context.system?.skills ?? {};
    const legacySkills = context.system?.system?.skills ?? {};
    // Merge to support legacy data stored under system.system.skills.*
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
    const NATURAL_ORDER = ["charm","dodge","fight","impress","melee","observe","shoot","sneak","vigor"];
    const LEARNED_GROUPS = [
      { key: "artisan", label: "Artisan" },
      { key: "arts", label: "Arts" },
      { key: "drive", label: "Drive" },
      { key: "lore", label: "Lore" },
      { key: "science", label: "Science" },
      { key: "social", label: "Social" },
      { key: "techRedemption", label: "Tech Redemption" },
      { key: "warfare", label: "Warfare" }
    ];

    const isSkillEntry = (v) =>
      v && typeof v === "object" && !Array.isArray(v);

    const buildSkillList = (src = {}, order = [], { exclude = [], type = "learned" } = {}) => {
      const ordered = order.map((k) => buildAttrEntry(k, src, { type }));
      const extras = Object.keys(src)
        .filter((k) => !order.includes(k) && !exclude.includes(k) && isSkillEntry(src[k]))
        .sort((a, b) => a.localeCompare(b));
      return [...ordered, ...extras.map((k) => buildAttrEntry(k, src, { type }))];
    };

    const normalizeGroupObject = (value) => {
      if (value && typeof value === "object" && !Array.isArray(value)) return value;
      if (Array.isArray(value)) return {};
      return {};
    };

    const buildSkillGroup = (k) => {
      const group = normalizeGroupObject(learned?.[k]);
      return Object.keys(group)
        .sort((a, b) => a.localeCompare(b))
        .filter((entryKey) => !entryKey.startsWith("__new"))
        .map((entryKey, idx) => {
          const entry = group[entryKey] ?? {};
          const displayKey =
            typeof entry.display === "string" && entry.display.trim()
              ? entry.display
              : (entryKey.startsWith("__new") ? "" : entryKey);
            const base = num(entry?.base);
            const history = num(entry?.history);
            const xp = num(entry?.xp);
            const mod = num(entry?.mod);
            const temp = num(entry?.temp);
            const max = num(entry?.max);
            const total = base + temp + mod;
            const trait = base + history + xp;
            const info = getSkillInfo("group", entryKey, k);
            const tooltipDesc = formatSkillTooltip(info);
            return {
              key: k,
              idx,
              entryKey,
              displayKey,
              label: labelize(entryKey),
              base,
              history,
              xp,
              mod,
              temp,
              max,
              total,
              tooltipStats: `Trait: ${trait}\nMod: ${mod}\nTemp: ${temp}`,
              tooltipDesc
            };
          });
      };

    const learnedKeys = new Set([
      ...Object.keys(learned),
      ...LEARNED_GROUPS.map((g) => g.key)
    ]);

    const isGroupDerivedKey = (k) =>
      LEARNED_GROUPS.some((g) => {
        if (!k.startsWith(g.key) || k.length <= g.key.length) return false;
        const next = k.charAt(g.key.length);
        return next >= "A" && next <= "Z";
      });

    const learnedEntries = Array.from(learnedKeys)
      .filter((k) => isSkillEntry(learned[k]) || Array.isArray(learned[k]) || LEARNED_GROUPS.some((g) => g.key === k))
      .map((k) => {
        const group = LEARNED_GROUPS.find((g) => g.key === k);
        if (group) {
          const groupInfo = skillInfo?.groups?.[group.key] ?? {};
          const groupTooltip = formatSkillTooltip(groupInfo);
          return {
            type: "group",
            isGroup: true,
            key: group.key,
            label: group.label,
            tooltipDesc: groupTooltip,
            items: buildSkillGroup(group.key)
          };
        }
        if (isSkillEntry(learned[k]) && !isGroupDerivedKey(k)) {
          return { type: "skill", isGroup: false, ...buildAttrEntry(k, learned, { type: "learned" }) };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.label.localeCompare(b.label));

    context.view.skills = {
      natural: buildSkillList(natural, NATURAL_ORDER, { type: "natural" }),
      learned: learnedEntries
    };

    const historyLabels = [
      "Upbringing",
      "Apprenticeship",
      "Early Career",
      "Tour of Duty",
      "Tour of Duty"
    ];
    const historySlots = context.system?.data?.histories ?? [];
    context.view.histories = historyLabels.map((label, idx) => {
      const slot = historySlots[idx] ?? {};
      return {
        idx,
        label,
        uuid: slot.uuid ?? "",
        name: slot.name ?? ""
      };
    });

    return context;
  }


  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0];
    const num = (n, d = 0) => Number(n ?? d);
    const sum = (s) => num(s?.base) + num(s?.temp) + num(s?.mod);
    const clamp = (n, min, max) => Math.min(Math.max(num(n), min), max);
    const toCamelSuffix = (name) => {
      const parts = (name ?? "")
        .trim()
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean);
      if (!parts.length) return "";
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
    };
    const toCamelLower = (name) => {
      const suffix = toCamelSuffix(name);
      if (!suffix) return "";
      return suffix.charAt(0).toLowerCase() + suffix.slice(1);
    };
    const normalizeSkillKey = (value) => toCamelLower(String(value ?? ""));
    const normalizeGroupObject = (value) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return foundry.utils.deepClone(value);
      }
      if (Array.isArray(value)) return {};
      return {};
    };
    // ----- Tabs (manual, v13-safe)
    const showTab = (tab) => {
      root.querySelectorAll('.sheet-tabs .item').forEach(a => a.classList.remove('active'));
      root.querySelectorAll('.sheet-body .tab').forEach(p => {
        p.classList.remove('active');
        p.style.display = "none";
      });
      const nav  = root.querySelector(`.sheet-tabs .item[data-tab="${tab}"]`);
      const pane = root.querySelector(`.sheet-body .tab[data-tab="${tab}"]`);
      if (nav) nav.classList.add('active');
      if (pane) {
        pane.classList.add('active');
        pane.style.display = "block";
      }
    };
    const lastTab = this.actor?.getFlag?.("fs2e", "lastTab");
    showTab(lastTab || "characteristics");
    root.querySelectorAll('.sheet-tabs .item').forEach(el => {
      el.addEventListener('click', ev => {
        ev.preventDefault();
        const tab = ev.currentTarget.dataset.tab;
        showTab(tab);
        this.actor?.setFlag?.("fs2e", "lastTab", tab);
      });
    });

    // ----- Species: drop to set, click to open, × to clear
    const speciesField = root.querySelector('[data-drop-species]');
    if (speciesField) {
      // Allow dropping
      speciesField.addEventListener('dragover', ev => ev.preventDefault());
      speciesField.addEventListener('drop', this.#onDropSpecies.bind(this));

      // Open linked species item
      root.querySelectorAll('.open-species').forEach(el => {
        el.addEventListener('click', async ev => {
          ev.preventDefault();
          const uuid = ev.currentTarget.dataset.uuid;
          if (!uuid) return;
          const doc = await fromUuid(uuid);
          if (doc?.sheet) return doc.sheet.render(true);
          ui.notifications?.warn("Could not open Species item.");
        });
      });

      // Clear link
      root.querySelectorAll('.clear-species').forEach(el => {
        el.addEventListener('click', async ev => {
          ev.preventDefault();
          await this.actor.update({ "system.data.species": { uuid: "", name: "" } });
        });
      });
    }

    // ----- Planet: drop to set, click to open, × to clear
    const planetField = root.querySelector('[data-drop-planet]');
    if (planetField) {
      // Allow dropping
      planetField.addEventListener('dragover', ev => ev.preventDefault());
      planetField.addEventListener('drop', this.#onDropPlanet.bind(this));

      // Open linked planet item
      root.querySelectorAll('.open-planet').forEach(el => {
        el.addEventListener('click', async ev => {
          ev.preventDefault();
          const uuid = ev.currentTarget.dataset.uuid;
          if (!uuid) return;
          const doc = await fromUuid(uuid);
          if (doc?.sheet) return doc.sheet.render(true);
          ui.notifications?.warn("Could not open Planet item.");
        });
      });

      // Clear link
      root.querySelectorAll('.clear-planet').forEach(el => {
        el.addEventListener('click', async ev => {
          ev.preventDefault();
          await this.actor.update({ "system.data.planet": { uuid: "", name: "" } });
        });
      });
    }

    // ----- Histories: drop to set
    root.querySelectorAll('[data-drop-history]').forEach(el => {
      el.addEventListener('dragover', ev => ev.preventDefault());
      el.addEventListener('drop', async ev => {
        ev.preventDefault();
        try {
          const slotIndex = Number(ev.currentTarget.dataset.historySlot ?? -1);
          if (!Number.isInteger(slotIndex) || slotIndex < 0) return;
          const data = TextEditor.getDragEventData(ev);
          if (!data?.uuid) return ui.notifications?.warn("Drop a History item here.");
          const doc = await fromUuid(data.uuid);
          if (!(doc && doc.documentName === "Item")) {
            return ui.notifications?.warn("Only Items can be dropped here.");
          }
          if (doc.type !== "history") {
            return ui.notifications?.warn("Only History items are allowed.");
          }

          let historyItem = doc;
          if (doc.parent?.id !== this.actor.id) {
            const created = await this.actor.createEmbeddedDocuments("Item", [doc.toObject()]);
            historyItem = created?.[0] ?? doc;
          }

          const histories = foundry.utils.deepClone(this.actor.system?.data?.histories ?? []);
          while (histories.length < 5) histories.push({ uuid: "", name: "" });
          histories[slotIndex] = { uuid: historyItem.uuid, name: historyItem.name };
          await this.actor.update({ "system.data.histories": histories });
        } catch (err) {
          console.error("fs2e | History drop failed", err);
          ui.notifications?.error("Failed to set History from drop.");
        }
      });
    });

    root.querySelectorAll('.open-history').forEach(el => {
      el.addEventListener('click', async ev => {
        ev.preventDefault();
        const uuid = ev.currentTarget.dataset.uuid;
        if (!uuid) return;
        const doc = await fromUuid(uuid);
        if (doc?.sheet) return doc.sheet.render(true);
        ui.notifications?.warn("Could not open History item.");
      });
    });

    // Core tooltips
    if (ui?.tooltip?.activate) ui.tooltip.activate(root, { delay: 1000 });

    // ----- Learned skill groups: add temporary row (UI only)
    root.querySelectorAll('[data-action="add-skill"]').forEach(el => {
      el.addEventListener('mousedown', ev => {
        ev.preventDefault();
        ev.stopPropagation();
      });
      el.addEventListener('click', async ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const key = ev.currentTarget.dataset.skillGroup;
        if (!key) return;
        const groupBlock = ev.currentTarget.closest(".skills-group-block");
        if (!groupBlock) return;
        // Create a temporary row in the DOM only; no data saved until commit.
        const row = document.createElement("div");
        row.className = "stat skills-subskill";
        row.dataset.skill = `${key}:new`;
        row.innerHTML = `
          <span class="skills-name-actions">
            <button type="button" class="skills-remove skills-remove-prefix" data-action="remove-skill" data-skill-group="${key}" data-skill-new="1">-</button>
            <input class="name" type="text" placeholder="New ${key.charAt(0).toUpperCase() + key.slice(1)}" data-skill-group="${key}" data-skill-new="1" />
          </span>
          <span class="value">0</span>
        `;
        groupBlock.appendChild(row);
        const input = row.querySelector("input.name");
        if (input) input.focus();
        const removeBtn = row.querySelector('[data-action="remove-skill"]');
        if (removeBtn) {
          removeBtn.addEventListener("click", (e2) => {
            e2.preventDefault();
            e2.stopPropagation();
            row.remove();
          });
        }
      });
    });

    // Remove skills (delegated): supports persisted and temporary rows.
    root.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.('[data-action="remove-skill"]');
      if (!btn || !root.contains(btn)) return;
      ev.preventDefault();
      ev.stopPropagation();

      const groupKey = btn?.dataset?.skillGroup;
      let skillKey = btn?.dataset?.skillKey;
      const isTemp = btn?.dataset?.skillNew === "1";
      if (isTemp && !skillKey) {
        const row = btn.closest(".skills-subskill");
        if (row) row.remove();
        return;
      }
      if (!skillKey) {
        const nameEl = btn.closest(".skills-name-actions")?.querySelector(".name");
        const nameText = nameEl?.textContent?.trim();
        if (nameText) skillKey = normalizeSkillKey(nameText);
      }
      if (!groupKey || !skillKey) return;

      const learnedLegacy = foundry.utils.getProperty(this.actor.system, "system.skills.learned") ?? {};
      const learnedPrimary = foundry.utils.getProperty(this.actor.system, "skills.learned") ?? {};
      const learnedMerged = foundry.utils.mergeObject(learnedLegacy, learnedPrimary, {
        inplace: false,
        recursive: true
      });
      const group = normalizeGroupObject(learnedMerged?.[groupKey]);
      if (!Object.prototype.hasOwnProperty.call(group, skillKey)) return;
      delete group[skillKey];

      const updates = {
        [`system.skills.learned.${groupKey}.-=${skillKey}`]: null
      };
      if (foundry.utils.getProperty(this.actor.system, "system.skills.learned")) {
        updates[`system.system.skills.learned.${groupKey}.-=${skillKey}`] = null;
      }
      await this.actor.update(updates);
      const row = btn.closest(".skills-subskill");
      if (row) row.remove();
    });

    const commitNewGroupSkill = async (input) => {
      if (input?.dataset?.committed === "1") return;
      const groupKey = input?.dataset?.skillGroup;
      if (!groupKey) return;
      const rawName = String(input.value ?? "").trim();
      if (!rawName) {
        const row = input.closest(".skills-subskill");
        if (row && input.dataset.skillNew) row.remove();
        return;
      }
      const skillKey = normalizeSkillKey(rawName);
      if (!skillKey) return;

      const learnedLegacy = foundry.utils.getProperty(this.actor.system, "system.skills.learned") ?? {};
      const learnedPrimary = foundry.utils.getProperty(this.actor.system, "skills.learned") ?? {};
      const learnedMerged = foundry.utils.mergeObject(learnedLegacy, learnedPrimary, {
        inplace: false,
        recursive: true
      });
      const group = normalizeGroupObject(learnedMerged?.[groupKey]);

      if (Object.prototype.hasOwnProperty.call(group, skillKey)) {
        ui.notifications?.warn(`Skill "${rawName}" already exists in ${groupKey}.`);
        return;
      }
      input.dataset.committed = "1";

      group[skillKey] = { base: 0, temp: 0, mod: 0, display: rawName };

      const updates = {
        [`system.skills.learned.${groupKey}`]: group
      };
      if (foundry.utils.getProperty(this.actor.system, "system.skills.learned")) {
        updates[`system.system.skills.learned.${groupKey}`] = group;
      }

      await this.actor.update(updates);
      const row = input.closest(".skills-subskill");
      if (row && input.dataset.skillNew) row.remove();
    };

    root.addEventListener("keydown", (ev) => {
      const target = ev.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.matches('input.name[data-skill-new="1"]')) return;
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      ev.stopPropagation();
      commitNewGroupSkill(target);
    });

    root.addEventListener("blur", (ev) => {
      const target = ev.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.matches('input.name[data-skill-new="1"]')) return;
      commitNewGroupSkill(target);
    }, true);

    // Remove accidental name fields from learned skill entries (standalone).
    const stripLearnedNames = async () => {
      const updates = {};
      const learnedLegacy = foundry.utils.getProperty(this.actor.system, "system.skills.learned") ?? {};
      const learnedPrimary = foundry.utils.getProperty(this.actor.system, "skills.learned") ?? {};
      const clean = (rootPath, obj) => {
        Object.keys(obj || {}).forEach((k) => {
          const v = obj[k];
          if (v && typeof v === "object" && !Array.isArray(v) && typeof v.name === "string") {
            const { base = 0, temp = 0, mod = 0 } = v;
            updates[`${rootPath}.${k}`] = { base, temp, mod };
          }
        });
      };
      clean("system.system.skills.learned", learnedLegacy);
      clean("system.skills.learned", learnedPrimary);
      if (Object.keys(updates).length) await this.actor.update(updates);
    };
    stripLearnedNames();

    // ----- Vitality + Wyrd trackers
    root.addEventListener("click", async (ev) => {
      const dot = ev.target?.closest?.(".fs2e-vw-dot");
      if (!dot || !root.contains(dot)) return;
      const track = dot.dataset.track;
      const index = Number(dot.dataset.index ?? 0);
      if (!track || !Number.isFinite(index) || index <= 0) return;

      if (track === "vitality") {
        const enduranceTotal = sum(this.actor.system?.characteristics?.body?.endurance);
        const nonVitalMax = Math.max(0, enduranceTotal);
        const vitalMax = 5;
        const vitality = this.actor.system?.vitality ?? {};
        let nonVital = clamp(vitality.nonVital ?? nonVitalMax, 0, nonVitalMax);
        let vital = clamp(vitality.vital ?? vitalMax, 0, vitalMax);
        const totalMax = nonVitalMax + vitalMax;
        if (index > totalMax) return;

        if (index <= nonVitalMax) {
          nonVital = index;
        } else {
          vital = index - nonVitalMax;
        }
        await this.actor.update({
          "system.vitality": { nonVital, vital }
        });
        return;
      }

      if (track === "wyrd") {
        const wyrd = this.actor.system?.wyrd ?? {};
        const wyrdMax = Math.max(0, num(wyrd.max, 20));
        const next = clamp(index, 0, wyrdMax);
        await this.actor.update({
          "system.wyrd": { value: next, max: wyrdMax }
        });
      }
    });

    // ----- Open dice roller on skill click
    root.querySelectorAll(".skills .stat").forEach((el) => {
      el.addEventListener("click", (ev) => {
        const target = ev.target;
        if (target instanceof HTMLInputElement) return;
        if (target?.closest?.("button")) return;
        const type = el.dataset.skillType;
        const skillKey = el.dataset.skillKey;
        const groupKey = el.dataset.skillGroup;
        if (!type || !skillKey) return;
        let defaultSkillKey = "";
        if (type === "natural") defaultSkillKey = `natural.${skillKey}`;
        if (type === "learned") defaultSkillKey = `learned.${skillKey}`;
        if (type === "group" && groupKey) defaultSkillKey = `group.${groupKey}.${skillKey}`;
        if (!defaultSkillKey) return;
        const mapping = CONFIG?.fs2e?.mappingData ?? {};
        let defaultCharacteristicKey = "";
        if (type === "natural") {
          defaultCharacteristicKey = mapping?.natural?.[skillKey]?.default ?? "";
        } else if (type === "learned") {
          defaultCharacteristicKey = mapping?.learned?.[skillKey]?.default ?? "";
        } else if (type === "group" && groupKey) {
          defaultCharacteristicKey =
            mapping?.groups?.[groupKey]?.[skillKey]?.default ??
            mapping?.groups?.[groupKey]?.default ??
            "";
        }
        game.fs2e?.openDiceRoller?.({
          actor: this.actor,
          defaultSkillKey,
          defaultCharacteristicKey
        });
      });
    });
  }

  // ----- Handle dropping an Item on the Species field
  async #onDropSpecies(event) {
    event.preventDefault();
    try {
      const data = TextEditor.getDragEventData(event);
      // Expecting an Item drag with a UUID
      if (!data?.uuid) return ui.notifications?.warn("Drop a Species item here.");
      const doc = await fromUuid(data.uuid);
      if (!(doc && doc.documentName === "Item")) {
        return ui.notifications?.warn("Only Items can be dropped here.");
      }
      if (doc.type !== "species") {
        return ui.notifications?.warn("Only Species items are allowed.");
      }
      let speciesItem = doc;
      if (doc.parent?.id !== this.actor.id) {
        const created = await this.actor.createEmbeddedDocuments("Item", [doc.toObject()]);
        speciesItem = created?.[0] ?? doc;
      }

      const updateData = {
        "system.data.species": { uuid: speciesItem.uuid, name: speciesItem.name }
      };

      const speciesChars = speciesItem.system?.characteristics ?? {};
      const speciesPairs = speciesChars.spiritPairs ?? {};
      if (Object.keys(speciesPairs).length) {
        updateData["system.characteristics.spiritPairs.extrovertIntrovert"] = speciesPairs.extrovertIntrovert ?? "extrovert";
        updateData["system.characteristics.spiritPairs.passionCalm"] = speciesPairs.passionCalm ?? "passion";
        updateData["system.characteristics.spiritPairs.faithEgo"] = speciesPairs.faithEgo ?? "faith";
      }
      for (const group of ["body", "mind", "spirit"]) {
        const entries = speciesChars[group] ?? {};
        for (const [key, val] of Object.entries(entries)) {
          if (val?.base !== undefined) {
            updateData[`system.characteristics.${group}.${key}.base`] = val.base;
          }
          if (group !== "spirit" && val?.max !== undefined) {
            updateData[`system.characteristics.${group}.${key}.max`] = val.max;
          }
        }
      }

      const spiritPairs = {
        extrovertIntrovert: speciesPairs.extrovertIntrovert ?? "extrovert",
        passionCalm: speciesPairs.passionCalm ?? "passion",
        faithEgo: speciesPairs.faithEgo ?? "faith"
      };
      const baseMap = {
        extrovert: spiritPairs.extrovertIntrovert === "extrovert" ? 3 : 1,
        introvert: spiritPairs.extrovertIntrovert === "introvert" ? 3 : 1,
        passion: spiritPairs.passionCalm === "passion" ? 3 : 1,
        calm: spiritPairs.passionCalm === "calm" ? 3 : 1,
        faith: spiritPairs.faithEgo === "faith" ? 3 : 1,
        ego: spiritPairs.faithEgo === "ego" ? 3 : 1
      };
      const opp = { extrovert: "introvert", introvert: "extrovert", passion: "calm", calm: "passion", faith: "ego", ego: "faith" };
      for (const key of Object.keys(opp)) {
        updateData[`system.characteristics.spirit.${key}.base`] = baseMap[key];
        updateData[`system.characteristics.spirit.${key}.max`] = 10 - baseMap[opp[key]];
      }

      await this.actor.update(updateData);
    } catch (err) {
      console.error("fs2e | Species drop failed", err);
      ui.notifications?.error("Failed to set Species from drop.");
    }
  }

  // ----- Handle dropping an Item on the Planet field
  async #onDropPlanet(event) {
    event.preventDefault();
    try {
      const data = TextEditor.getDragEventData(event);
      // Expecting an Item drag with a UUID
      if (!data?.uuid) return ui.notifications?.warn("Drop a Planet item here.");
      const doc = await fromUuid(data.uuid);
      if (!(doc && doc.documentName === "Item")) {
        return ui.notifications?.warn("Only Items can be dropped here.");
      }
      if (doc.type !== "planet") {
        return ui.notifications?.warn("Only Planet items are allowed.");
      }
      // Store a lightweight reference
      await this.actor.update({
        "system.data.planet": { uuid: doc.uuid, name: doc.name }
      });
    } catch (err) {
      console.error("fs2e | Planet drop failed", err);
      ui.notifications?.error("Failed to set Planet from drop.");
    }
  }
}

/** Register */
export function registerCharacterSheet() {
  Actors.registerSheet("fs2e", FS2ECharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "FS2E Character Sheet"
  });
}
