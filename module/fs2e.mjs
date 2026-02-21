// systems/fs2e/module/fs2e.mjs
// Entrypoint for the fs2e system (Foundry VTT v13)

import { registerCharacterSheet } from "./sheets/actor/character-sheet.mjs";
import { FS2EItemSheet } from "./sheets/item/item-sheet.mjs";
import { FS2ESpeciesSheet } from "./sheets/item/species-sheet.mjs";
import { openDiceRoller } from "./dice-roller.mjs";

const FS2E = {
  ID: "fs2e",
  TITLE: "Fading Suns 2e",
  VERSION: "0.0.1"
};

Hooks.once("init", async () => {
  console.log("%cfs2e | Initializing Fading Suns 2e system", "color: #42b983; font-weight: bold;");

  // Namespaces
  CONFIG.fs2e = CONFIG.fs2e ?? {};
  game.fs2e = game.fs2e ?? {
    log: (...args) => {
      if (game.settings?.get?.(FS2E.ID, "debug")) console.log("fs2e |", ...args);
    },
    warn: (...args) => console.warn("fs2e |", ...args),
    error: (...args) => console.error("fs2e |", ...args),
    openDiceRoller: (options = {}) => openDiceRoller(options)
  };

  // Settings
  registerSettings();

  // Preload any Handlebars partials you use with {{> "path"}}
  await preloadHandlebarsTemplates();

  // Load static mapping data
  await loadStaticData();

  // Actor sheets
  registerCharacterSheet();

  // Initiative (placeholder)
  CONFIG.Combat.initiative = { formula: "1d20", decimals: 0 };

  // -----------------------------
  // Item sheets
  // -----------------------------
  try {
    Items.unregisterSheet("core", ItemSheet);
  } catch (e) {
    // If already unregistered, ignore
  }

  Items.registerSheet(FS2E.ID, FS2EItemSheet, {
    makeDefault: true,
    types: [
      "armor",
      "beneficeAffliction",
      "blessingCurse",
      "equipment",
      "faction",
      "history",
      "maneuver",
      "planet",
      "weapon"
    ]
  });

  Items.registerSheet(FS2E.ID, FS2ESpeciesSheet, {
    makeDefault: true,
    types: ["species"]
  });

  // (Optional) If your type labels look wrong, add lang entries or set CONFIG.Item.typeLabels in code.
});

Hooks.once("setup", () => {
  game.fs2e?.log?.("Setup complete");
});

Hooks.once("ready", () => {
  game.fs2e?.log?.(`Ready (v${FS2E.VERSION})`);
});

Hooks.on("preUpdateActor", (actor, updateData) => {
  if (actor?.type !== "character") return;

  const getBase = (key) => {
    const current = actor.system?.characteristics?.spirit?.[key]?.base ?? 0;
    const path = `system.characteristics.spirit.${key}.base`;
    const pending = foundry.utils.getProperty(updateData, path);
    return Number(pending ?? current ?? 0);
  };

  const bases = {
    extrovert: getBase("extrovert"),
    introvert: getBase("introvert"),
    passion: getBase("passion"),
    calm: getBase("calm"),
    faith: getBase("faith"),
    ego: getBase("ego")
  };

  const setMax = (key, value) => {
    const path = `system.characteristics.spirit.${key}.max`;
    foundry.utils.setProperty(updateData, path, value);
  };

  setMax("extrovert", 10 - bases.introvert);
  setMax("introvert", 10 - bases.extrovert);
  setMax("passion", 10 - bases.calm);
  setMax("calm", 10 - bases.passion);
  setMax("faith", 10 - bases.ego);
  setMax("ego", 10 - bases.faith);
});

Hooks.on("updateItem", async (item) => {
  const actor = item?.parent;
  if (!actor || actor.type !== "character") return;
  if (item.type !== "species") return;

  const updateData = {
    "system.data.species": { uuid: item.uuid, name: item.name }
  };

  const speciesChars = item.system?.characteristics ?? {};
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

  const spiritBase = speciesChars.spirit ?? {};
  const opp = { extrovert: "introvert", introvert: "extrovert", passion: "calm", calm: "passion", faith: "ego", ego: "faith" };
  for (const key of Object.keys(opp)) {
    const other = opp[key];
    const otherBase = Number(spiritBase?.[other]?.base ?? 0);
    updateData[`system.characteristics.spirit.${key}.max`] = 10 - otherBase;
  }

  await actor.update(updateData);
});

function registerSettings() {
  game.settings.register(FS2E.ID, "debug", {
    name: "Enable debug logging",
    hint: "If enabled, fs2e will print additional logs to the console.",
    scope: "client",
    config: true,
    default: false,
    type: Boolean
  });
}

/** Preload templates/partials used with {{> "path"}} */
async function preloadHandlebarsTemplates() {
  const templatePaths = [
    // Actor sheet partials
    "systems/fs2e/templates/actor/actor-tabs/characteristics-tab.hbs",
    "systems/fs2e/templates/actor/actor-tabs/skills-tab.hbs",
    // Chat cards
    "systems/fs2e/templates/chat/roll-card.hbs"
  ];
  await loadTemplates(templatePaths);
}

async function loadStaticData() {
  try {
    const res = await fetch("systems/fs2e/module/data/central-mapping.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    CONFIG.fs2e.mappingData = data ?? {};
  } catch (err) {
    console.warn("fs2e | Failed to load central-mapping.json", err);
    CONFIG.fs2e.mappingData = {};
  }
}
