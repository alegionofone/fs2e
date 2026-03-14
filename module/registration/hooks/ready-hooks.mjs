import { openSkillRollDialog } from "../../rolls/roll-dialog.mjs";
import {
  applySubmittedInitiativePlan,
  requestInitiativePlansForCombatants
} from "../../ui/dialogs/initiative-dialog.mjs";

export const registerReadyHooks = () => {
  Hooks.once("ready", async () => {
    game.socket?.on("system.fs2e", async (data) => {
      if (!data || !data.type) return;

      if (data.type === "contested-request") {
        if (data.targetUserId && data.targetUserId !== game.user?.id) return;

        const actor = await fromUuid(data.targetActorUuid).catch(() => null);
        if (!actor) return;

        await openSkillRollDialog({
          actor,
          preset: {
            contestedResponder: true,
            contestedEnabled: false,
            skillKey: String(data.attackerResult?.skillKey ?? "").trim(),
            characteristicKey: String(data.attackerResult?.characteristicKey ?? "").trim(),
            contestedRequest: {
              attackerUuid: data.attackerUuid,
              attackerResult: data.attackerResult
            }
          }
        });
        return;
      }

      if (data.type === "initiative-plan-request") {
        if (data.targetUserId && data.targetUserId !== game.user?.id) return;
        await requestInitiativePlansForCombatants({
          combatId: data.combatId,
          round: data.round,
          combatantIds: Array.isArray(data.combatantIds) ? data.combatantIds : []
        });
        return;
      }

      if (data.type === "initiative-plan-submit") {
        if (!game.user?.isGM) return;
        await applySubmittedInitiativePlan({
          combatId: data.combatId,
          combatantId: data.combatantId,
          round: data.round,
          actionUuids: Array.isArray(data.actionUuids) ? data.actionUuids : []
        });
      }
    });
  });
};
