import { FS2ECharacterSheet } from "./character.mjs";

export const registerActorSheets = () => {
  Actors.registerSheet("fs2e", FS2ECharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "FS2E Character Sheet"
  });
};
