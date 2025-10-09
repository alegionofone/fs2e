// systems/fs2e/module/fs2e.mjs
// Entrypoint for the fs2e system (Foundry VTT v13)

import { registerCharacterSheet } from "./sheets/actor/character-sheet.mjs";

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
    error: (...args) => console.error("fs2e |", ...args)
  };

  // Settings
  registerSettings();

  // Preload any Handlebars partials you use with {{> "path"}}
  await preloadHandlebarsTemplates();

  // Actor sheets
  registerCharacterSheet();

  // Initiative (placeholder)
  CONFIG.Combat.initiative = { formula: "1d20", decimals: 0 };

  // -----------------------------
  // Item sheets (what you asked for)
  // Replace core item sheet with ours (we can use the core ItemSheet for now)
  // and limit it to only the item types you defined.
  // -----------------------------
  try {
    Items.unregisterSheet("core", ItemSheet);
  } catch (e) {
    // If already unregistered, ignore
  }

  Items.registerSheet(FS2E.ID, ItemSheet, {
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
      "species",
      "weapon"
    ]
  });

  // (Optional) If your type labels look wrong, add lang entries or set CONFIG.Item.typeLabels in code.
});

Hooks.once("setup", () => {
  game.fs2e?.log?.("Setup complete");
});

Hooks.once("ready", () => {
  game.fs2e?.log?.(`Ready (v${FS2E.VERSION})`);
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
    "systems/fs2e/templates/actor/actor-tabs/skills-tab.hbs"
  ];
  await loadTemplates(templatePaths);
}
