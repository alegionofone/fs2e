import { registerCharacterSheet } from "./sheets/actor/character-sheet.mjs";
import { FS2EItemSheet } from "./sheets/item/item-sheet.mjs";
import { FS2ESpeciesSheet } from "./sheets/item/species-sheet.mjs";
import { FS2EHistorySheet } from "./sheets/item/history-sheet.mjs";
import { tagifyValue } from "./ui/tagify/tagify.mjs";
import { openDiceRoller, rollFromPreset } from "./dice-roller.mjs";

const FS2E = {
  ID: "fs2e",
  TITLE: "Fading Suns 2e",
  VERSION: "0.0.1"
};

Hooks.once("init", async () => {
  console.log("%cfs2e | Initializing Fading Suns 2e system", "color: #42b983; font-weight: bold;");

  CONFIG.fs2e = CONFIG.fs2e ?? {};
  game.fs2e = game.fs2e ?? {
    log: (...args) => game.settings?.get?.(FS2E.ID, "debug") && console.log("fs2e |", ...args),
    warn: (...args) => console.warn("fs2e |", ...args),
    error: (...args) => console.error("fs2e |", ...args),
    openDiceRoller: (options = {}) => openDiceRoller(options)
  };

  registerSettings();

  if (!Handlebars.helpers.fs2eTagify) {
    Handlebars.registerHelper("fs2eTagify", (value) => tagifyValue(value));
  }

  await preloadHandlebarsTemplates();
  await loadStaticData();
  registerCharacterSheet();

  CONFIG.Combat.initiative = { formula: "1d20", decimals: 0 };

  try {
    Items.unregisterSheet("core", ItemSheet);
  } catch (e) {
  }

  Items.registerSheet(FS2E.ID, FS2EItemSheet, {
    makeDefault: true,
    types: ["armor", "beneficeAffliction", "blessingCurse", "equipment", "faction", "maneuver", "planet", "weapon"]
  });

  Items.registerSheet(FS2E.ID, FS2ESpeciesSheet, { makeDefault: true, types: ["species"] });
  Items.registerSheet(FS2E.ID, FS2EHistorySheet, { makeDefault: true, types: ["history"] });
});

Hooks.once("setup", () => game.fs2e?.log?.("Setup complete"));
Hooks.once("ready", () => game.fs2e?.log?.(`Ready (v${FS2E.VERSION})`));

const getActorFromPreset = async (preset) => {
  const actorUuid = preset?.actorUuid;
  if (!actorUuid) return null;
  const actor = await fromUuid(actorUuid);
  return actor ?? null;
};

Hooks.on("renderChatMessage", (message, html) => {
  const preset = message?.flags?.fs2e?.rollPreset;
  const root = html?.[0];
  if (!preset || !root) return;

  const retryBtn = root.querySelector(".fs2e-chat-card__retry");
  if (retryBtn) {
    retryBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const actor = await getActorFromPreset(preset);
      if (!actor) return;
      const nextPreset = { ...preset, retries: Math.min(2, Number(preset.retries ?? 0) + 1) };
      await rollFromPreset({ actor, preset: nextPreset });
    });
  }

  const continueBtn = root.querySelector(".fs2e-chat-card__continue");
  if (continueBtn) {
    continueBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const actor = await getActorFromPreset(preset);
      if (!actor) return;
      const lastVP = Number(message?.flags?.fs2e?.lastVP ?? 0);
      game.fs2e?.openDiceRoller?.({
        actor,
        preset: {
          ...preset,
          sustainEnabled: true,
          sustainCurrent: lastVP,
          compLocked: false,
          compResult: null
        }
      });
    });
  }
});

Hooks.once("ready", () => {
  game.socket?.on("system.fs2e", async (data) => {
    if (!data || data.type !== "contested-request") return;
    if (data.targetUserId && data.targetUserId !== game.user?.id) return;
    const actor = await fromUuid(data.targetActorUuid);
    if (!actor) return;
    game.fs2e?.openDiceRoller?.({
      actor,
      preset: {
        contestedResponder: true,
        contestedEnabled: false,
        contestedRequest: {
          attackerUuid: data.attackerUuid,
          attackerResult: data.attackerResult
        }
      }
    });
  });
});

Hooks.on("preUpdateActor", (actor, updateData) => {
  if (actor?.type !== "character") return;
  const hasPrimaryCharacteristics = !!foundry.utils.getProperty(actor.system, "characteristics");
  const hasLegacyCharacteristics = !!foundry.utils.getProperty(actor.system, "system.characteristics");

  const getBase = (key) => {
    const currentPrimary = actor.system?.characteristics?.spirit?.[key]?.base;
    const currentLegacy = actor.system?.system?.characteristics?.spirit?.[key]?.base;
    const pendingPrimary = foundry.utils.getProperty(updateData, `system.characteristics.spirit.${key}.base`);
    const pendingLegacy = foundry.utils.getProperty(updateData, `system.system.characteristics.spirit.${key}.base`);
    const pending = pendingPrimary ?? pendingLegacy;
    const current = currentPrimary ?? currentLegacy ?? 0;
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
    if (hasPrimaryCharacteristics) {
      foundry.utils.setProperty(updateData, `system.characteristics.spirit.${key}.max`, value);
    }
    if (hasLegacyCharacteristics) {
      foundry.utils.setProperty(updateData, `system.system.characteristics.spirit.${key}.max`, value);
    }
  };
  setMax("extrovert", 10 - bases.introvert);
  setMax("introvert", 10 - bases.extrovert);
  setMax("passion", 10 - bases.calm);
  setMax("calm", 10 - bases.passion);
  setMax("faith", 10 - bases.ego);
  setMax("ego", 10 - bases.faith);
});

function recalcHistory(actor) {
  if (!actor || actor.type !== "character") return;
  const histories = actor.items?.filter((i) => i.type === "history") ?? [];
  const sumFor = (group, key) =>
    histories.reduce((acc, item) => acc + Number(item.system?.characteristics?.[group]?.[key]?.history ?? 0), 0);

  const bodyKeys = ["strength", "dexterity", "endurance"];
  const mindKeys = ["wits", "perception", "tech"];
  const updateData = {};

  for (const key of bodyKeys) {
    const value = sumFor("body", key);
    const current = Number(actor.system?.characteristics?.body?.[key]?.history ?? 0);
    if (value !== current) {
      updateData[`system.characteristics.body.${key}.history`] = value;
    }
  }

  for (const key of mindKeys) {
    const value = sumFor("mind", key);
    const current = Number(actor.system?.characteristics?.mind?.[key]?.history ?? 0);
    if (value !== current) {
      updateData[`system.characteristics.mind.${key}.history`] = value;
    }
  }

  if (Object.keys(updateData).length) actor.update(updateData);
}

const updateSpecies = async (item) => {
  const actor = item?.parent;
  if (!actor || actor.type !== "character" || item.type !== "species") return;
  const linkedSpeciesUuid =
    (actor.system?.data?.species?.uuid || "") ||
    (foundry.utils.getProperty(actor.system, "system.data.species.uuid") || "");
  if (!linkedSpeciesUuid || linkedSpeciesUuid !== item.uuid) return;
  const hasPrimaryCharacteristics = !!foundry.utils.getProperty(actor.system, "characteristics");
  const hasLegacyCharacteristics = !!foundry.utils.getProperty(actor.system, "system.characteristics");
  const updateData = {};
  updateData["system.data.species"] = { uuid: item.uuid, name: item.name };
  updateData["system.system.data.species"] = { uuid: item.uuid, name: item.name };
  const setCharacteristicValue = (pathSuffix, value) => {
    if (hasPrimaryCharacteristics) {
      updateData[`system.characteristics.${pathSuffix}`] = value;
    }
    if (hasLegacyCharacteristics) {
      updateData[`system.system.characteristics.${pathSuffix}`] = value;
    }
  };
  const speciesChars = item.system?.characteristics ?? {};
  const speciesPairs = speciesChars.spiritPairs ?? {};
  setCharacteristicValue("spiritPairs.extrovertIntrovert", speciesPairs.extrovertIntrovert ?? "extrovert");
  setCharacteristicValue("spiritPairs.passionCalm", speciesPairs.passionCalm ?? "passion");
  setCharacteristicValue("spiritPairs.faithEgo", speciesPairs.faithEgo ?? "faith");
  const charModel =
    game?.system?.documentTypes?.Actor?.character?.system?.characteristics ??
    game?.system?.model?.Actor?.character?.system?.characteristics ??
    {};
  const defaultBase = (group, key) => Number(charModel?.[group]?.[key]?.base ?? 0);
  const bodyKeys = ["strength", "dexterity", "endurance"];
  const mindKeys = ["wits", "perception", "tech"];
  for (const key of bodyKeys) {
    const value = speciesChars?.body?.[key]?.base;
    setCharacteristicValue(`body.${key}.base`, value !== undefined ? value : defaultBase("body", key));
  }
  for (const key of mindKeys) {
    const value = speciesChars?.mind?.[key]?.base;
    setCharacteristicValue(`mind.${key}.base`, value !== undefined ? value : defaultBase("mind", key));
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
    setCharacteristicValue(`spirit.${key}.base`, baseMap[key]);
    setCharacteristicValue(`spirit.${key}.max`, 10 - baseMap[opp[key]]);
  }
  await actor.update(updateData);
};

const onHistoryChange = (item) => {
  const actor = item?.parent;
  if (!actor || actor.type !== "character" || item.type !== "history") return;
  recalcHistory(actor);
};

Hooks.on("updateItem", async (item) => {
  await updateSpecies(item);
  onHistoryChange(item);
});
Hooks.on("createItem", onHistoryChange);
Hooks.on("deleteItem", onHistoryChange);

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
    "systems/fs2e/templates/chat/roll-card.hbs",
    "systems/fs2e/templates/chat/contested-card.hbs"
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
