import { isStatRecord, toNumberMap } from "./shared.mjs";

const AUTO_SKILL_FLAG = "fs2eAutoSkill";
const AUTO_SKILL_OWNERS = "fs2eGrantedBy";

const readSkillEffectMap = (item) => {
  const primary = item?.system?.effects?.skills;
  const dataPath = item?.system?.data?.effects?.skills;
  const legacy = item?.system?.system?.effects?.skills;
  const source = primary && typeof primary === "object"
    ? primary
    : (dataPath && typeof dataPath === "object" ? dataPath : legacy);
  return toNumberMap(source);
};

const normalizeSkillPath = (path) => {
  if (typeof path !== "string") return "";

  let normalized = path.trim();
  if (!normalized) return "";

  normalized = normalized.replace(/^system\.skills\./, "");
  normalized = normalized.replace(/^skills\./, "");

  if (!normalized || normalized.endsWith(".")) return "";

  const segments = normalized.split(".").map((part) => part.trim()).filter(Boolean);
  if (!segments.length) return "";

  return segments.join(".");
};

const collectGrantedSkillOwners = (items) => {
  const owners = new Map();

  for (const item of items ?? []) {
    if (!item?.id) continue;

    const effects = readSkillEffectMap(item);
    for (const [rawPath, amount] of Object.entries(effects)) {
      if (!Number.isFinite(amount) || amount === 0) continue;

      const path = normalizeSkillPath(rawPath);
      if (!path) continue;

      if (!owners.has(path)) owners.set(path, new Set());
      owners.get(path).add(item.id);
    }
  }

  return owners;
};

const walkSkills = (node, path, callback) => {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;

  if (isStatRecord(node)) {
    callback(path, node);
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    walkSkills(value, path ? `${path}.${key}` : key, callback);
  }
};

const arraysEqual = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};

const createAutoSkillRecord = (owners) => ({
  base: 0,
  mod: 0,
  temp: 0,
  max: 8,
  history: 0,
  xp: 0,
  roll: 0,
  granted: 0,
  total: 0,
  [AUTO_SKILL_FLAG]: true,
  [AUTO_SKILL_OWNERS]: owners
});

const deleteSkillPath = (skills, path) => {
  const parts = path.split(".");
  if (!parts.length) return false;

  const trail = [];
  let node = skills;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!node || typeof node !== "object" || Array.isArray(node)) return false;
    trail.push({ parent: node, key });
    node = node[key];
  }

  const leafKey = parts[parts.length - 1];
  if (!node || typeof node !== "object" || Array.isArray(node) || !(leafKey in node)) return false;

  delete node[leafKey];

  // Prune empty intermediate objects, but keep top-level skill buckets intact.
  for (let i = trail.length - 1; i >= 1; i -= 1) {
    const { parent, key } = trail[i];
    const child = parent?.[key];
    if (child && typeof child === "object" && !Array.isArray(child) && !Object.keys(child).length) {
      delete parent[key];
      continue;
    }
    break;
  }

  return true;
};

export const syncActorGrantedSkills = async (actor) => {
  if (!actor || actor.documentName !== "Actor") return;

  const sourceSkills = actor.system?.skills;
  if (!sourceSkills || typeof sourceSkills !== "object" || Array.isArray(sourceSkills)) return;

  const nextSkills = foundry.utils.deepClone(sourceSkills);
  const ownersByPath = collectGrantedSkillOwners(actor.items);

  let changed = false;

  walkSkills(nextSkills, "", (path, stat) => {
    if (!path || !stat?.[AUTO_SKILL_FLAG]) return;

    const ownerSet = ownersByPath.get(path);
    if (!ownerSet || ownerSet.size === 0) {
      changed = deleteSkillPath(nextSkills, path) || changed;
      ownersByPath.delete(path);
      return;
    }

    const ownerIds = Array.from(ownerSet).sort();
    if (!arraysEqual(stat[AUTO_SKILL_OWNERS], ownerIds)) {
      stat[AUTO_SKILL_OWNERS] = ownerIds;
      changed = true;
    }

    ownersByPath.delete(path);
  });

  for (const [path, ownerSet] of ownersByPath.entries()) {
    const existing = foundry.utils.getProperty(nextSkills, path);
    if (isStatRecord(existing)) continue;

    foundry.utils.setProperty(nextSkills, path, createAutoSkillRecord(Array.from(ownerSet).sort()));
    changed = true;
  }

  if (!changed) return;
  await actor.update({ "system.skills": nextSkills });
};
