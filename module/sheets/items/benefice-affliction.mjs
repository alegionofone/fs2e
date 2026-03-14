import { FS2EItemSheet } from "./base-item-sheet.mjs";

const readValue = (system, path, fallback = "") => {
	const directValue = foundry.utils.getProperty(system, path);
	if (directValue !== undefined && directValue !== null) return directValue;

	const legacyValue = foundry.utils.getProperty(system, `data.${path}`);
	return legacyValue === undefined || legacyValue === null ? fallback : legacyValue;
};

const normalizeSignedNumber = (value) => {
	const text = String(value ?? "").trim();
	if (!text) return "0";
	const normalizedText = text.replace(/[âˆ’â€“â€”]/g, "-").replace(/\s+/g, "");
	const match = normalizedText.match(/^([+-]?)(\d{1,2})$/);
	if (!match) return "0";
	const sign = match[1] === "-" ? "-" : match[1] === "+" ? "+" : "";
	return `${sign}${Number(match[2])}`;
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
		data.view.points = normalizeSignedNumber(readValue(system, "points", "0"));
		data.view.note = String(readValue(system, "effectLine.note", "")).trim();

		return data;
	}

	async _updateObject(event, formData) {
		if (Object.prototype.hasOwnProperty.call(formData, "system.points")) {
			formData["system.points"] = normalizeSignedNumber(formData["system.points"]);
		}
		if (Object.prototype.hasOwnProperty.call(formData, "system.effectLine.note")) {
			formData["system.effectLine.note"] = String(formData["system.effectLine.note"] ?? "").trim();
		}

		return super._updateObject(event, formData);
	}
}
