import { FS2EItemSheet } from "./base-item-sheet.mjs";
import { CHARACTERISTIC_DEFINITIONS } from "../../global/characteristics/definitions.mjs";
import { LEARNED_SKILLS_BANK, NATURAL_SKILLS_BANK } from "../../global/skills/definitions.mjs";

const readValue = (system, path, fallback = "") => {
	const directValue = foundry.utils.getProperty(system, path);
	if (directValue !== undefined && directValue !== null) return directValue;

	const legacyValue = foundry.utils.getProperty(system, `data.${path}`);
	return legacyValue === undefined || legacyValue === null ? fallback : legacyValue;
};

const normalizeSignedNumber = (value) => {
	const text = String(value ?? "").trim();
	if (!text) return "0";
	const normalizedText = text.replace(/[−–—]/g, "-").replace(/\s+/g, "");
	const match = normalizedText.match(/^([+-]?)(\d{1,2})$/);
	if (!match) return "0";
	const sign = match[1] === "-" ? "-" : match[1] === "+" ? "+" : "";
	return `${sign}${Number(match[2])}`;
};

const normalizeEffectAmount = (value) => {
	const text = String(value ?? "").trim();
	if (!text) return "";
	const normalizedText = text.replace(/[−–—]/g, "-").replace(/\s+/g, "");
	const match = normalizedText.match(/^([+-]?)(\d{1,2})$/);
	if (!match) return "";
	const sign = match[1] === "-" ? "-" : "+";
	return `${sign}${Number(match[2])}`;
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
		const system = foundry.utils.mergeObject(
			foundry.utils.deepClone(this.item?._source?.system ?? {}),
			data.system ?? {},
			{ inplace: false }
		);

		data.view = data.view ?? {};
		data.system = system;

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
		if (Object.prototype.hasOwnProperty.call(formData, "system.points")) {
			formData["system.points"] = normalizeSignedNumber(formData["system.points"]);
		}
		if (Object.prototype.hasOwnProperty.call(formData, "system.effectLine.amount")) {
			formData["system.effectLine.amount"] = normalizeEffectAmount(formData["system.effectLine.amount"]);
		}
		if (Object.prototype.hasOwnProperty.call(formData, "system.effectLine.target")) {
			formData["system.effectLine.target"] = String(formData["system.effectLine.target"] ?? "").trim();
		}
		if (Object.prototype.hasOwnProperty.call(formData, "system.effectLine.note")) {
			formData["system.effectLine.note"] = String(formData["system.effectLine.note"] ?? "").trim();
		}
		return super._updateObject(event, formData);
	}
}
