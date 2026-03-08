export const createSkillRollChatMessage = async ({
  actor,
  skillLabel,
  characteristicLabel,
  result,
  breakdown,
  gn,
  complementary,
  sustain,
  preset
}) => {
  const title = `${skillLabel} (${characteristicLabel})`;
  const qualityText = result.critFailure
    ? "Critical Failure"
    : (result.critSuccess ? "Critical Success" : (result.success ? "Success" : "Failure"));
  const accentValue = Number(result?.accent ?? 0);

  const content = await renderTemplate("systems/fs2e/templates/chat/roll-card.hbs", {
    title,
    actorName: actor?.name ?? "",
    actorImg: actor?.img ?? "",
    roll: result.die,
    rollAdjusted: result.adjustedRoll ?? result.die,
    accent: accentValue,
    gn,
    quality: result.quality ?? qualityText,
    success: !!result.success,
    successes: result.successes,
    vp: result.vp,
    showRetry: Number(preset?.retries ?? 0) < 2,
    showContinue: !!sustain,
    complementary,
    sustainEnabled: !!sustain,
    sustainCurrent: sustain?.current ?? 0,
    sustainTotal: sustain?.total ?? 0,
    sustainCompleted: !!sustain?.completed,
    breakdown: breakdown ?? []
  });

  await ChatMessage.create({
    user: game.user?.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: {
      fs2e: {
        rollPreset: preset ?? null,
        lastVP: sustain ? (sustain.total ?? 0) : (result.vp ?? 0)
      }
    }
  });
};
