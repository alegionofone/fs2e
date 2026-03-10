const DEFAULT_TAG_MENU = [];

export const TAG_MENUS_BY_ITEM_TYPE = {
  action: [
    "Combat",
    "Basic",
    "Fencing",
    "Martial Arts",
    "Shield",
    "Firearms",
    "Normal",
    "Theurgic",
    "Psychic",
    "Attack",
    "Defend",
    "Social",
    "Psi",
    "Theurgy"
  ],
  armor: [
    "Tech Level 1",
    "Tech Level 2",
    "Tech Level 3",
    "Tech Level 4",
    "Tech Level 5",
    "Tech Level 6",
    "Tech Level 7",
    "Tech Level 8",
    "Tech Level 9",
    "Tech Level 10"
  ],
  beneficeAffliction: [
    "Benefice",
    "Affliction"
  ],
  blessingCurse: [
    "Blessing",
    "Curse"
  ],
  equipment: [
    "Tech Level 1",
    "Tech Level 2",
    "Tech Level 3",
    "Tech Level 4",
    "Tech Level 5",
    "Tech Level 6",
    "Tech Level 7",
    "Tech Level 8",
    "Tech Level 9",
    "Tech Level 10"
  ],
  faction: [
    "al-Malik",
    "Ascorbite",
    "Brother Battle",
    "Changed",
    "Charioteers",
    "Decados",
    "Engineers",
    "Eskatonic Order",
    "Etyri",
    "Gannok",
    "Hawkwood",
    "Hazat",
    "Hironem",
    "Human",
    "Imperial",
    "Keddah",
    "Li Halan",
    "Merchant League",
    "Oro'ym",
    "Sanctuary Aeon",
    "Scravers",
    "Shantor",
    "Symbiot",
    "Temple Avesti",
    "The Muster",
    "The Reeves",
    "Ur-Obun",
    "Ur-Ukar",
    "Urth Orthodox",
    "Vau",
    "Vorox"
  ],
  history: [
    "Upbringing",
    "Apprenticeship",
    "Early Career",
    "Tour of Duty",
    "Noble",
    "Church",
    "Guild"
  ],
  planet: [
    "al-Malik",
    "Brother Battle",
    "Decados",
    "Embattled",
    "Eskatonic Order",
    "Hawkwood",
    "Hazat",
    "Human",
    "Imperial",
    "Keddah",
    "Li Halan",
    "Merchant League",
    "Sanctuary Aeon",
    "Symbiot",
    "Temple Avesti",
    "Ur-Obun",
    "Ur-Ukar",
    "Urth Orthodox",
    "Vau",
    "Vorox"
  ],
  species: [
    "Ascorbite",
    "Changed",
    "Etyri",
    "Gannok",
    "Hironem",
    "Human",
    "Oro'ym",
    "Shantor",
    "Symbiot",
    "Ur-Obun",
    "Ur-Ukar",
    "Vau",
    "Vorox"
  ],
  weapon: [
    "Tech Level 1",
    "Tech Level 2",
    "Tech Level 3",
    "Tech Level 4",
    "Tech Level 5",
    "Tech Level 6",
    "Tech Level 7",
    "Tech Level 8",
    "Tech Level 9",
    "Tech Level 10"
  ]
};

function toItemTypeKey(itemType) {
  if (!itemType) return "";
  return String(itemType)
    .trim()
    .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    .replace(/^\w/, (c) => c.toLowerCase());
}

export function getTagMenuForItemType(itemType) {
  const key = toItemTypeKey(itemType);
  const menu = TAG_MENUS_BY_ITEM_TYPE[key] ?? DEFAULT_TAG_MENU;
  // Return a fresh copy so downstream UI libraries cannot mutate shared constants.
  return [...new Set((Array.isArray(menu) ? menu : []).map((entry) => String(entry).trim()).filter(Boolean))];
}

export function getAllTagMenus() {
  return Object.fromEntries(
    Object.entries(TAG_MENUS_BY_ITEM_TYPE).map(([key, menu]) => [
      key,
      [...new Set((Array.isArray(menu) ? menu : []).map((entry) => String(entry).trim()).filter(Boolean))]
    ])
  );
}
