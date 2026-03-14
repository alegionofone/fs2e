import { FS2EItemSheet } from "./base-item-sheet.mjs";
import { CHARACTERISTIC_DEFINITIONS } from "../../global/characteristics/definitions.mjs";
import { LEARNED_SKILLS_BANK, NATURAL_SKILLS_BANK } from "../../global/skills/definitions.mjs";

const FS2E_ACTION_HOOK_CHOICES = [
	{ key: "beforeActionRoll", label: "beforeActionRoll(actor, item, context)" },
	{ key: "afterActionRoll", label: "afterActionRoll(actor, item, result)" },
	{ key: "beforeContestedRoll", label: "beforeContestedRoll(actor, item, context)" },
	{ key: "afterContestedRoll", label: "afterContestedRoll(actor, item, result)" },
	{ key: "combatRoundStart", label: "combatRoundStart(actor, item, combat)" },
	{ key: "combatRoundEnd", label: "combatRoundEnd(actor, item, combat)" }
];

const readActionField = (system, key) => {
	const value = foundry.utils.getProperty(system, key);
	return value === undefined || value === null ? "" : String(value);
};

const readActionNumber = (system, key) => {
	const value = Number(readActionField(system, key));
	return Number.isFinite(value) ? value : "";
};

const formatSignedActionValue = (system, key) => {
	const raw = readActionField(system, key).trim();
	if (!raw) return "";
	const value = Number(raw);
	if (!Number.isFinite(value)) return raw;
	return value < 0 ? `${value}` : `+${value}`;
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

const normalizeTagToken = (value) => String(value ?? "")
	.trim()
	.toLowerCase()
	.replace(/\s+/g, "");

const normalizeActorHooks = (value = []) => {
	const entries = Array.isArray(value)
		? value
		: (value && typeof value === "object" ? Object.values(value) : []);
	const seen = new Set();
	const out = [];

	for (const entry of entries) {
		const hook = String(entry?.hook ?? "").trim();
		const fn = String(entry?.fn ?? "").trim();
		if (!hook && !fn) continue;
		if (!hook) continue;
		if (seen.has(hook)) continue;
		seen.add(hook);
		out.push({ hook, fn });
	}

	return out;
};

export class FS2EActionSheet extends FS2EItemSheet {
	async getData(options = {}) {
		const data = await super.getData(options);
		const system = data.system ?? {};
		const tagTokens = new Set(this._getStoredTags(system).map((tag) => normalizeTagToken(tag)).filter(Boolean));

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
		data.view.showCombatFields = tagTokens.has("combat") || readActionField(system, "chart").trim().toLowerCase() === "combat";
		data.view.init = formatSignedActionValue(system, "init");
		data.view.goal = formatSignedActionValue(system, "goal");
		data.view.dmg = readActionNumber(system, "dmg");
		data.view.canEditHooks = Boolean(data.editable) && !data.view.sheetLock.locked;
		data.view.actorHooks = normalizeActorHooks(system.actorHooks).map((entry, index) => ({
			index,
			hook: entry.hook,
			fn: entry.fn
		}));
		data.view.actorHookChoices = FS2E_ACTION_HOOK_CHOICES
			.filter((entry) => !data.view.actorHooks.some((hook) => hook.hook === entry.key))
			.map((entry) => ({ ...entry }));

		return data;
	}

	activateListeners(html) {
		super.activateListeners(html);

		if (!this.isEditable || this._getSheetLockState().locked) return;

		html.on("click", "[data-action='hook-add']", async (event) => {
			event.preventDefault();
			const root = event.currentTarget?.closest?.(".fs2e-hook-add-row");
			const select = root?.querySelector("select[name='addHook']");
			const hook = String(select?.value ?? "").trim();
			if (!hook) return;

			const submitData = foundry.utils.expandObject(this._getSubmitData());
			const actorHooks = normalizeActorHooks(foundry.utils.getProperty(submitData, "system.actorHooks"));
			if (actorHooks.some((entry) => entry.hook === hook)) {
				ui.notifications?.warn(`${this.item.name} already has a ${hook} hook.`);
				return;
			}

			actorHooks.push({ hook, fn: "// Hook code here" });
			await this.item.update({ "system.actorHooks": actorHooks });
			this.render(true);
		});

		html.on("click", "[data-action='hook-delete']", async (event) => {
			event.preventDefault();
			const index = Number(event.currentTarget?.dataset?.index ?? -1);
			if (!Number.isInteger(index) || index < 0) return;

			const submitData = foundry.utils.expandObject(this._getSubmitData());
			const actorHooks = normalizeActorHooks(foundry.utils.getProperty(submitData, "system.actorHooks"));
			if (index >= actorHooks.length) return;
			actorHooks.splice(index, 1);
			await this.item.update({ "system.actorHooks": actorHooks });
			this.render(true);
		});
	}

	async _updateObject(event, formData) {
		const expanded = foundry.utils.expandObject(formData);
		const actorHooks = normalizeActorHooks(foundry.utils.getProperty(expanded, "system.actorHooks"));
		for (const key of Object.keys(formData)) {
			if (key.startsWith("system.actorHooks.")) delete formData[key];
		}
		formData["system.actorHooks"] = actorHooks;

		return super._updateObject(event, formData);
	}
}
