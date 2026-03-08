import { openSkillRollDialog, rollFromPreset } from "../../rolls/roll-dialog.mjs";

const getActorFromPreset = async (preset) => {
  const actorUuid = String(preset?.actorUuid ?? "").trim();
  if (!actorUuid) return null;
  const actor = await fromUuid(actorUuid).catch(() => null);
  return actor ?? null;
};

export const registerChatHooks = () => {
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
};
