// systems/fs2e/module/sheets/actor/character-sheet.mjs
// FS2E Character sheet (Foundry VTT v13)

export class FS2ECharacterSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["fs2e", "sheet", "actor", "character"],
      template: "systems/fs2e/templates/actor/character-sheet.hbs",
      width: 800,
      height: 680,
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
    const labelize = (k) =>
      (k ?? "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

    // Tooltips WITHOUT the "— / Total" line
    const breakdown = (_label, s) => {
      const b = num(s?.base), t = num(s?.temp), m = num(s?.mod);
      return `Base: ${b}\nTemp: ${t}\nMod: ${m}`;
    };

    const buildAttrEntry = (key, src = {}) => {
      const s = src?.[key] ?? {};
      const base = num(s.base), temp = num(s.temp), mod = num(s.mod);
      const total = base + temp + mod;
      return {
        key,
        label: labelize(key),
        base, temp, mod, total,
        tooltip: `Base: ${base}\nTemp: ${temp}\nMod: ${mod}`
      };
    };

    // ---------------- characteristics ----------------
    const ch = context.system?.characteristics ?? {};
    const body   = ch.body   ?? {};
    const mind   = ch.mind   ?? {};
    const spirit = ch.spirit ?? {};
    const occult = ch.occult ?? {};

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
          social:   { extrovert: sum(spirit.social),  introvert: sum(spirit.social) },
          temper:   { passion:   sum(spirit.temper),  calm:      sum(spirit.temper) },
          devotion: { faith:     sum(spirit.devotion), ego:      sum(spirit.devotion) }
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
          social:   { extrovert: breakdown("Social", spirit.social),  introvert: breakdown("Social", spirit.social) },
          temper:   { passion:   breakdown("Temper", spirit.temper),  calm:      breakdown("Temper", spirit.temper) },
          devotion: { faith:     breakdown("Devotion", spirit.devotion), ego: breakdown("Devotion", spirit.devotion) }
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
      { key: "social",   left: { key: "extrovert", label: "Extrovert" }, right: { key: "introvert", label: "Introvert" } },
      { key: "temper",   left: { key: "passion",   label: "Passion"   }, right: { key: "calm",      label: "Calm"      } },
      { key: "devotion", left: { key: "faith",     label: "Faith"     }, right: { key: "ego",       label: "Ego"       } }
    ];

    context.view = context.view ?? {};
    context.view.characteristics = {
      body: BODY_ORDER.map((k) => buildAttrEntry(k, body)),
      mind: MIND_ORDER.map((k) => buildAttrEntry(k, mind)),
      spirit: {
        left:  SPIRIT_AXES.map(ax => ({
          axis: ax.key,
          leftKey: ax.left.key,
          leftLabel: ax.left.label,
          total: sum(spirit[ax.key]),
          tooltip: breakdown(labelize(ax.key), spirit[ax.key])
        })),
        right: SPIRIT_AXES.map(ax => ({
          axis: ax.key,
          rightKey: ax.right.key,
          rightLabel: ax.right.label,
          total: sum(spirit[ax.key]),
          tooltip: breakdown(labelize(ax.key), spirit[ax.key])
        }))
      }
    };

    // ---------------- skills (iterable) ----------------
    const skills = context.system?.skills ?? {};
    const natural = skills.natural ?? {};
    const learned = skills.learned ?? {};
    const NATURAL_ORDER = ["charm","dodge","fight","impress","melee","observe","shoot","sneak","vigor"];
    const LEARNED_ORDER = [
      "academia","empathy","etiquette","inquiry","lockpicking","physick","ride",
      "sleightOfHand","spacesuit","stoicBody","stoicMind","streetwise",
      "survival","thinkMachine","throwing","torture","xenoEmpathy"
    ];

    context.view.skills = {
      natural: NATURAL_ORDER.map((k) => buildAttrEntry(k, natural)),
      learned: LEARNED_ORDER.map((k) => buildAttrEntry(k, learned))
    };

    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0];

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
    showTab("characteristics");
    root.querySelectorAll('.sheet-tabs .item').forEach(el => {
      el.addEventListener('click', ev => {
        ev.preventDefault();
        showTab(ev.currentTarget.dataset.tab);
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

    // Core tooltips
    if (ui?.tooltip?.activate) ui.tooltip.activate(root);
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
      // Store a lightweight reference
      await this.actor.update({
        "system.data.species": { uuid: doc.uuid, name: doc.name }
      });
    } catch (err) {
      console.error("fs2e | Species drop failed", err);
      ui.notifications?.error("Failed to set Species from drop.");
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
