export const LEARNED_SKILL_GROUP_KEYS = new Set([
  "artisan",
  "arts",
  "drive",
  "lore",
  "science",
  "social",
  "techRedemption",
  "warfare"
]);

export const LEARNED_GROUP_OPTION_LABELS = {
  artisan: [
    "Blacksmith",
    "Carpenter",
    "Cartographer",
    "Cook",
    "Jeweler",
    "Leatherworker",
    "Locksmith",
    "Mason",
    "Potter",
    "Tailor",
    "Weaver"
  ],
  arts: [
    "Calligraphy",
    "Drawing",
    "Embroidery",
    "Illumination",
    "Music Composition",
    "Painting",
    "Poetry",
    "Rhetoric (Writing)",
    "Sculpting",
    "Stained Glass"
  ],
  drive: ["Aircraft", "Beastcraft", "Landcraft", "Spacecraft", "Watercraft"],
  lore: ["Jumpweb", "Xeno"],
  science: [
    "Anthropology",
    "Archaeology",
    "Astronomy",
    "Biology",
    "Chemistry",
    "Cybernetics",
    "Engineering",
    "Genetics",
    "Geology",
    "Meteorology",
    "Physics",
    "Terraforming",
    "Xeno Biology"
  ],
  social: ["Acting", "Debate", "Leadership", "Oratory"],
  techRedemption: ["Craft Redemption", "High Tech Redemption", "Mech Redemption", "Volt Redemption"],
  warfare: ["Artillery", "Demolitions", "Gunnery", "Military Tactics"]
};

export const normalizeSkillKey = (value) => {
  const parts = String(value ?? "")
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (!parts.length) return "";

  const joined = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  return joined.charAt(0).toLowerCase() + joined.slice(1);
};

export const formatSkillLabel = (key) => String(key ?? "")
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/[._-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .replace(/^./, (char) => char.toUpperCase());