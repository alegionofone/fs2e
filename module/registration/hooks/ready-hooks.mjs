import { openSkillRollDialog } from "../../rolls/roll-dialog.mjs";

export const registerReadyHooks = () => {
  Hooks.once("ready", async () => {
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
};
