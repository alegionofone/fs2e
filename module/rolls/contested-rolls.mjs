import { toNumber } from "../global/derived/shared.mjs";
import { getVpOutcome } from "./roll-engine.mjs";

export const findTargetOwner = (actor) => {
  const owner = game.users?.find((user) => user.active && actor?.testUserPermission?.(user, "OWNER"));
  return owner ?? game.users?.find((user) => user.active && user.isGM) ?? game.user ?? null;
};

export const postContestedChat = async ({ attacker, attackerResult, defender, defenderResult }) => {
  const attackerAccent = toNumber(attackerResult?.accent, 0);
  const defenderAccent = toNumber(defenderResult?.accent, 0);
  const attackerEffective = attackerResult.critSuccess
    ? (attackerResult.successes ?? 0) * 2
    : (attackerResult.successes ?? 0);
  const defenderEffective = defenderResult.critSuccess
    ? (defenderResult.successes ?? 0) * 2
    : (defenderResult.successes ?? 0);

  const netSuccesses = attackerEffective - defenderEffective;
  const success = netSuccesses > 0;
  const outcome = success
    ? getVpOutcome(netSuccesses, attackerResult.gn ?? 0, !!attackerResult.critSuccess, attackerResult.accent ?? 0)
    : { vp: 0, quality: "Failure" };

  const html = await renderTemplate("systems/fs2e/templates/chat/contested-card.hbs", {
    attacker: {
      title: attackerResult.skillLabel ? `${attackerResult.skillLabel} Roll` : "Roll",
      actorName: attacker?.name ?? "",
      actorImg: attacker?.img ?? "",
      roll: attackerResult.roll,
      rollAdjusted: attackerResult.rollAdjusted,
      accent: attackerAccent,
      gn: attackerResult.gn,
      breakdown: attackerResult.breakdown ?? []
    },
    defender: {
      title: defenderResult.skillLabel ? `${defenderResult.skillLabel} Roll` : "Roll",
      actorName: defender?.name ?? "",
      actorImg: defender?.img ?? "",
      roll: defenderResult.roll,
      rollAdjusted: defenderResult.rollAdjusted,
      accent: defenderAccent,
      gn: defenderResult.gn,
      breakdown: defenderResult.breakdown ?? []
    },
    outcome: {
      success,
      successes: success ? netSuccesses : 0,
      vp: success ? outcome.vp : 0,
      quality: attackerResult.critFailure ? "Critical Failure" : outcome.quality
    }
  });

  await ChatMessage.create({
    user: game.user?.id,
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: html
  });
};
