const HISTORIES_PACK_ID = "fs2e.histories";
const HISTORIES_SEED_PATH = "systems/fs2e/module/global/compendiums/history-seed-data.json";

const loadHistorySeedData = async () => {
  const response = await fetch(HISTORIES_SEED_PATH);
  if (!response.ok) {
    throw new Error(`Unable to load history seed data (${response.status}).`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

export const ensureHistoriesCompendiumSeed = async () => {
  if (!game.user?.isGM) return;

  const pack = game.packs?.get(HISTORIES_PACK_ID);
  if (!pack || pack.documentName !== "Item") return;

  const seedItems = await loadHistorySeedData().catch((error) => {
    console.warn("fs2e system | Unable to load history seed data.", error);
    return [];
  });
  if (!seedItems.length) return;

  await pack.getIndex();
  const existingHistoryNames = new Set(
    pack.index
      .filter((entry) => entry?.type === "history")
      .map((entry) => String(entry?.name ?? "").trim().toLowerCase())
      .filter(Boolean)
  );

  const missingItems = seedItems.filter((entry) => {
    const name = String(entry?.name ?? "").trim().toLowerCase();
    return name && !existingHistoryNames.has(name);
  });

  if (!missingItems.length) return;

  const wasLocked = !!pack.locked;

  try {
    if (wasLocked) await pack.configure({ locked: false });
    await Item.createDocuments(missingItems, { pack: pack.collection });
    console.log(`fs2e system | Seeded histories compendium with ${missingItems.length} migrated item(s).`);
  } catch (error) {
    console.warn("fs2e system | Unable to seed histories compendium.", error);
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
};
