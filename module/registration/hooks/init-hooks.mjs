import Tagify from "../../ui/tagify/index.mjs";
import * as ProseMirror from "../../ui/prosemirror/index.mjs";
import { registerActorSheets } from "../register-actor-sheets.mjs";
import { registerItemSheets } from "../register-item-sheets.mjs";
import { preloadHandlebarsTemplates } from "../preload-templates.mjs";
import { registerSheetLockMode } from "../../ui/sheet-lock-mode.mjs";

export const registerInitHooks = () => {
  Hooks.once("init", async () => {
    console.log("fs2e system | Initializing Fading Suns 2e system");
    await preloadHandlebarsTemplates();
    registerActorSheets();
    registerItemSheets();
    registerSheetLockMode();

    game.fs2e = game.fs2e ?? {};
    game.fs2e.ui = {
      Tagify,
      ProseMirror,
      registerSheetLockMode
    };
  });
};
