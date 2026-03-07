const PLANETS_PACK_ID = "fs2e.planets";

const STARTER_PLANETS = [
  {
    name: "Byzantium Secundus",
    type: "planet",
    img: "icons/svg/planet.svg",
    system: {
      tags: ["Human", "Core Worlds"],
      description: "Capital world of the Known Worlds and seat of imperial power."
    }
  }
];

export const ensurePlanetsCompendiumSeed = async () => {
  if (!game.user?.isGM) return;

  const pack = game.packs?.get(PLANETS_PACK_ID);
  if (!pack || pack.documentName !== "Item") return;

  await pack.getIndex();
  const hasPlanet = pack.index.some((entry) => entry?.type === "planet");
  if (hasPlanet) return;

  const wasLocked = !!pack.locked;

  try {
    if (wasLocked) await pack.configure({ locked: false });
    await Item.createDocuments(STARTER_PLANETS, { pack: pack.collection });
    console.log("fs2e system | Seeded planets compendium with starter planet item.");
  } catch (error) {
    console.warn("fs2e system | Unable to seed planets compendium.", error);
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
};
