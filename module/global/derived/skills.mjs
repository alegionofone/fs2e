import { collectItemEffectTotals } from "./effects.mjs";
import { applyDerivedFields, filterActiveHistoryItems, isStatRecord } from "./shared.mjs";
import { LEARNED_SKILLS_BANK, NATURAL_SKILLS_BANK } from "../skills/definitions.mjs";

const SKILL_PATH_BY_KEY = Object.fromEntries(
  NATURAL_SKILLS_BANK.map((entry) => [entry.key, `natural.${entry.key}`])
);
for (const entry of LEARNED_SKILLS_BANK) {
  SKILL_PATH_BY_KEY[entry.key] = `learned.${entry.key}`;
}

const normalizePath = (value) => {
  const token = String(value ?? "").trim();
  if (!token) return "";
  if (token.includes(".")) return token;
  return SKILL_PATH_BY_KEY[token] ?? `learned.${token}`;
};

const addTotal = (totals, path, amount) => {
  const key = normalizePath(path);
  const value = Number(amount);
  if (!key || !Number.isFinite(value)) return;
  totals[key] = (totals[key] ?? 0) + value;
};

const collectSkillEffectEntries = (node, prefix = "", out = []) => {
  if (node == null) return out;

  const scalar = Number(node);
  if (Number.isFinite(scalar)) {
    if (prefix) out.push([prefix, scalar]);
    return out;
  }

  if (typeof node !== "object" || Array.isArray(node)) return out;

  for (const [key, value] of Object.entries(node)) {
    const token = String(key ?? "").trim();
    if (!token) continue;
    const nextPrefix = prefix ? `${prefix}.${token}` : token;
    collectSkillEffectEntries(value, nextPrefix, out);
  }

  return out;
};

const normalizeGrantedLearnedSkills = (value) => {
  const out = [];
  const seen = new Set();
  for (const entry of Array.isArray(value) ? value : []) {
    const groupKey = String(entry?.groupKey ?? "").trim();
    const childKey = String(entry?.childKey ?? "").trim();
    const amount = Number(entry?.amount ?? 0);
    if (!groupKey || !childKey || !Number.isFinite(amount)) continue;
    const token = `${groupKey.toLowerCase()}.${childKey.toLowerCase()}`;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push({ groupKey, childKey, amount });
  }
  return out;
};

const collectHistorySkillTotals = (items) => {
  const totals = {};

  for (const item of items ?? []) {
    if (item?.type !== "history") continue;

    const schemaMap = item?.system?.effects?.skills ?? item?.system?.data?.effects?.skills;
    let usedSchema = false;
    if (schemaMap && typeof schemaMap === "object" && !Array.isArray(schemaMap)) {
      for (const [path, amount] of collectSkillEffectEntries(schemaMap)) {
        const key = normalizePath(path);
        const value = Number(amount);
        if (!key || !Number.isFinite(value)) continue;
        totals[key] = (totals[key] ?? 0) + value;
        usedSchema = true;
      }
    }

    const flaggedGrantedSkills = normalizeGrantedLearnedSkills(item.getFlag?.("fs2e", "grantedLearnedSkills"));
    if (!usedSchema && flaggedGrantedSkills.length) {
      for (const entry of flaggedGrantedSkills) {
        addTotal(totals, `learned.${entry.groupKey}.${entry.childKey}`, entry.amount);
      }
      usedSchema = true;
    }

    if (usedSchema) continue;

    const adjustments = Array.isArray(item?.system?.skillsAdjustments)
      ? item.system.skillsAdjustments
      : [];

    for (const entry of adjustments) {
      const key = String(entry?.key ?? "").trim();
      if (!key || key === "__anySkill__" || key.startsWith("choice:")) continue;
      addTotal(totals, key, entry?.value);
    }
  }

  return totals;
};

const walkSkillTree = (node, path, grantedTotals, historyTotals) => {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;

  if (isStatRecord(node)) {
    const granted = grantedTotals[path] ?? 0;
    node.history = Number.isFinite(Number(historyTotals[path])) ? Number(historyTotals[path]) : 0;
    applyDerivedFields(node, granted);
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    walkSkillTree(value, path ? `${path}.${key}` : key, grantedTotals, historyTotals);
  }
};

export const aggregateActorSkillEffects = (actor) => {
  const skills = actor?.system?.skills;
  if (!skills || typeof skills !== "object") return;
  const filteredItems = filterActiveHistoryItems(actor);

  const grantedTotals = collectItemEffectTotals(filteredItems, "skills", {
    filter: (item) => item?.type !== "history"
  });
  const historyTotals = collectHistorySkillTotals(filteredItems);
  walkSkillTree(skills, "", grantedTotals, historyTotals);
};
