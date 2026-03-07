import Tagify from "./ui/tagify/index.mjs";
import * as ProseMirror from "./ui/prosemirror/index.mjs";
import { aggregateActorLanguages } from "./global/languages.mjs";
import { aggregateActorDerivedData } from "./global/derived/index.mjs";
import { ensureHistoriesCompendiumSeed } from "./global/compendiums/histories.mjs";
import { ensurePlanetsCompendiumSeed } from "./global/compendiums/planets.mjs";
import { registerActorSheets } from "./sheets/actor/register-actor-sheets.mjs";
import { registerItemSheets } from "./sheets/items/register-item-sheets.mjs";
import { preloadHandlebarsTemplates } from "./sheets/preload-templates.mjs";
import { openSkillRollDialog, rollFromPreset } from "./ui/dice-roller.mjs";

Hooks.once("init", async () => {
  console.log("fs2e system | Initializing Fading Suns 2e system");
  await preloadHandlebarsTemplates();
  registerActorSheets();
  registerItemSheets();

  game.fs2e = game.fs2e ?? {};
  game.fs2e.ui = {
    Tagify,
    ProseMirror
  };
});

Hooks.on("prepareActorData", (actor) => {
  aggregateActorDerivedData(actor);
  if (!actor?.system?.languages) return;
  aggregateActorLanguages(actor);
});

const getActorFromPreset = async (preset) => {
  const actorUuid = String(preset?.actorUuid ?? "").trim();
  if (!actorUuid) return null;
  const actor = await fromUuid(actorUuid).catch(() => null);
  return actor ?? null;
};

Hooks.on("renderChatMessage", (message, html) => {
  const preset = message?.flags?.fs2e?.rollPreset;
  const root = html?.[0];
  if (!preset || !root) return;

  const retryBtn = root.querySelector(".fs2e-chat-card__retry");
  if (retryBtn) {
    retryBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      const actor = await getActorFromPreset(preset);
      if (!actor) return;
      const nextPreset = {
        ...preset,
        retries: Math.min(2, Number(preset.retries ?? 0) + 1)
      };
      await rollFromPreset({ actor, preset: nextPreset });
    });
  }

  const continueBtn = root.querySelector(".fs2e-chat-card__continue");
  if (continueBtn) {
    continueBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      const actor = await getActorFromPreset(preset);
      const skillKey = String(preset?.skillKey ?? "").trim();
      if (!actor || !skillKey) return;
      await openSkillRollDialog({ actor, skillKey });
    });
  }
});

Hooks.once("ready", async () => {
  await ensureHistoriesCompendiumSeed();
  await ensurePlanetsCompendiumSeed();

  game.socket?.on("system.fs2e", async (data) => {
    if (!data || data.type !== "contested-request") return;
    if (data.targetUserId && data.targetUserId !== game.user?.id) return;

    const actor = await fromUuid(data.targetActorUuid).catch(() => null);
    if (!actor) return;

    await openSkillRollDialog({
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
