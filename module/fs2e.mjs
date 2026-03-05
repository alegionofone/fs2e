import Tagify from "./ui/tagify/index.mjs";
import * as ProseMirror from "./ui/prosemirror/index.mjs";
import { aggregateActorLanguages } from "./models/languages.mjs";
import { registerActorSheets } from "./sheets/actor/register-actor-sheets.mjs";
import { registerItemSheets } from "./sheets/items/register-item-sheets.mjs";
import { preloadHandlebarsTemplates } from "./sheets/preload-templates.mjs";

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
  if (!actor?.system?.languages) return;
  aggregateActorLanguages(actor);
});
