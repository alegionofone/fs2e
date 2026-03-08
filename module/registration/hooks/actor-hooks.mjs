import { aggregateActorLanguages } from "../../global/languages.mjs";
import { aggregateActorDerivedData } from "../../global/derived/index.mjs";

export const registerActorHooks = () => {
  Hooks.on("prepareActorData", (actor) => {
    aggregateActorDerivedData(actor);
    if (!actor?.system?.languages) return;
    aggregateActorLanguages(actor);
  });
};
