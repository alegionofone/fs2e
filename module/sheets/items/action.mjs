import { FS2EItemSheet } from "./base-item-sheet.mjs";
import { CHARACTERISTIC_DEFINITIONS } from "../../global/characteristics/definitions.mjs";
import { LEARNED_SKILLS_BANK, NATURAL_SKILLS_BANK } from "../../global/skills/definitions.mjs";

const readActionField = (system, key) => {
	const value = foundry.utils.getProperty(system, key);
	return value === undefined || value === null ? "" : String(value);
};

const readActionNumber = (system, key) => {
	const value = Number(readActionField(system, key));
	return Number.isFinite(value) ? value : "";
};

const toUniqueKeyedList = (entries = []) => {
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

export class FS2EActionSheet extends FS2EItemSheet {
	async getData(options = {}) {
		const data = await super.getData(options);
		const system = data.system ?? {};

		data.view = data.view ?? {};
		data.view.characteristics = toUniqueKeyedList(
			CHARACTERISTIC_DEFINITIONS
				.filter((entry) => !["vitality", "wyrd"].includes(String(entry?.key ?? "").trim().toLowerCase()))
				.map((entry) => ({ key: entry.key, label: entry.label }))
		);
		data.view.skills = toUniqueKeyedList([
			...NATURAL_SKILLS_BANK.map((entry) => ({ key: entry.key, label: entry.label })),
			...LEARNED_SKILLS_BANK.map((entry) => ({ key: entry.key, label: entry.label }))
		]);

		data.view.level = readActionNumber(system, "level");
		data.view.characteristic = readActionField(system, "characteristic");
		data.view.skill = readActionField(system, "skill");
		data.view.init = readActionNumber(system, "init");
		data.view.goal = readActionNumber(system, "goal");
		data.view.dmg = readActionNumber(system, "dmg");
		data.view.effect = readActionField(system, "effect");

		return data;
	}
}
