import { dispatchRoundInitiativePlanning } from "../../ui/dialogs/initiative-dialog.mjs";

export const registerCombatHooks = () => {
  Hooks.on("updateCombat", async (combat, changed) => {
    if (!game.user?.isGM) return;
    if (!Object.prototype.hasOwnProperty.call(changed ?? {}, "round")) return;

    const round = Number(combat?.round ?? 0);
    if (!Number.isFinite(round) || round < 1) return;

    const promptedRound = Number(combat.getFlag("fs2e", "initiativePromptRound") ?? 0);
    if (promptedRound === round) return;

    await combat.setFlag("fs2e", "initiativePromptRound", round);
    await dispatchRoundInitiativePlanning(combat);
  });
};
