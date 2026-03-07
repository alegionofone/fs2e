import { FS2EItemSheet } from "./base-item-sheet.mjs";
import { CHARACTERISTIC_DEFINITIONS } from "../../global/characteristics/definitions.mjs";
import { LEARNED_SKILLS_BANK, NATURAL_SKILLS_BANK } from "../../global/skills/definitions.mjs";

const readValue = (system, path, fallback = "") => {
	const value = foundry.utils.getProperty(system, path);
	return value === undefined || value === null ? fallback : value;
};

const normalizeSignedNumber = (value) => {
	const text = String(value ?? "").trim();
	if (!text) return "0";
	const match = text.replace(/\s+/g, "").match(/^([+-]?)(\d{1,2})$/);
	if (!match) return "0";
	const sign = match[1] === "-" ? "-" : "";
	return `${sign}${Number(match[2])}`;
};

const normalizeEffectAmount = (value) => {
	const text = String(value ?? "").trim();
	if (!text) return "";
	const match = text.replace(/\s+/g, "").match(/^([+-])(\d{1,2})$/);
	if (!match) return "";
	return `${match[1]}${Number(match[2])}`;
};

const uniqueByKey = (entries = []) => {
	const seen = new Set();
	const out = [];
	for (const entry of entries) {
		const key = String(entry?.key ?? "").trim();
		const label = String(entry?.label ?? "").trim();
		if (!key || !label || seen.has(key)) continue;
		seen.add(key);
		out.push({ key, label });
	}
	return out.sort((a, b) => a.label.localeCompare(b.label));
};

export class FS2EBeneficeAfflictionSheet extends FS2EItemSheet {
	async getData(options = {}) {
		const data = await super.getData(options);
		const system = data.system ?? {};

		data.view = data.view ?? {};

		const characteristicTargets = uniqueByKey(
			CHARACTERISTIC_DEFINITIONS
				.filter((entry) => !["vitality", "wyrd"].includes(String(entry?.key ?? "").trim().toLowerCase()))
				.map((entry) => ({ value: `characteristic:${entry.key}`, key: `characteristic:${entry.key}`, label: entry.label }))
		);
		data.view.characteristicTargets = characteristicTargets.map((entry) => ({ value: entry.key, label: entry.label }));
		data.view.otherTraitTargets = [
			{ value: "characteristic:vitality", label: "Vitality" },
			{ value: "characteristic:wyrd", label: "Wyrd" }
		];
		data.view.skillTargets = uniqueByKey([
			...NATURAL_SKILLS_BANK.map((entry) => ({ key: `skill:${entry.key}`, label: entry.label })),
			...LEARNED_SKILLS_BANK.map((entry) => ({ key: `skill:${entry.key}`, label: entry.label }))
		]).map((entry) => ({ value: entry.key, label: entry.label }));

		data.view.points = normalizeSignedNumber(readValue(system, "points", "0"));
		data.view.effectLine = {
			amount: normalizeEffectAmount(readValue(system, "effectLine.amount", "")),
			target: String(readValue(system, "effectLine.target", "")).trim(),
			note: String(readValue(system, "effectLine.note", "")).trim()
		};

		return data;
	}

	async _updateObject(event, formData) {
		formData["system.points"] = normalizeSignedNumber(formData["system.points"]);
		formData["system.effectLine.amount"] = normalizeEffectAmount(formData["system.effectLine.amount"]);
		formData["system.effectLine.target"] = String(formData["system.effectLine.target"] ?? "").trim();
		formData["system.effectLine.note"] = String(formData["system.effectLine.note"] ?? "").trim();
		return super._updateObject(event, formData);
	}
}