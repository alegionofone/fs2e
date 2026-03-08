import Tagify from "../../ui/tagify/index.mjs";
import { getLanguageOptions } from "../../global/languages.mjs";
import { FS2EItemSheet } from "./base-item-sheet.mjs";
import { CHARACTERISTIC_DEFINITIONS } from "../../global/characteristics/definitions.mjs";
import { LEARNED_SKILLS_BANK, NATURAL_SKILLS_BANK } from "../../global/skills/definitions.mjs";
import {
	LEARNED_GROUP_OPTION_LABELS,
	LEARNED_SKILL_GROUP_KEYS,
	formatSkillLabel,
	normalizeSkillKey
} from "../../global/skills/group-specializations.mjs";
import { SPIRIT_LABELS, SPIRIT_PRIMARY_OPTIONS, normalizeAlwaysPrimary } from "../../global/spirit.mjs";

const asArray = (value) => (Array.isArray(value) ? value : []);

const parseJsonSafe = (value, fallback = []) => {
	const text = String(value ?? "").trim();
	if (!text) return fallback;
	try {
		const parsed = JSON.parse(text);
		return Array.isArray(parsed) ? parsed : fallback;
	} catch {
		return fallback;
	}
};

const uniqueByCaseInsensitive = (list = []) => {
	const seen = new Set();
	const out = [];
	for (const entry of list) {
		const text = String(entry ?? "").trim();
		if (!text) continue;
		const token = text.toLowerCase();
		if (seen.has(token)) continue;
		seen.add(token);
		out.push(text);
	}
	return out;
};

const joinWithAnd = (entries = []) => {
	const parts = entries.map((entry) => String(entry ?? "").trim()).filter(Boolean);
	if (!parts.length) return "";
	if (parts.length === 1) return parts[0];
	if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
	return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
};

const uniqueBonusEntries = (list = []) => {
	const seen = new Set();
	const out = [];
	for (const entry of list) {
		const uuid = String(entry?.uuid ?? "").trim();
		const name = String(entry?.name ?? "").trim();
		if (!uuid || !name) continue;
		const token = uuid.toLowerCase();
		if (seen.has(token)) continue;
		seen.add(token);
		out.push({ uuid, name });
	}
	return out;
};

const uniqueCompendiumTagEntries = (list = []) => {
	const seen = new Set();
	const out = [];
	for (const entry of list) {
		const uuid = String(entry?.uuid ?? "").trim();
		const value = String(entry?.value ?? "").trim();
		if (!uuid || !value) continue;
		const token = uuid.toLowerCase();
		if (seen.has(token)) continue;
		seen.add(token);
		out.push({ uuid, value });
	}
	return out;
};

const toKeyLabelOptions = (entries = []) => {
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

const buildCompendiumOptions = async (collection) => {
	const pack = game.packs?.get(collection);
	if (!pack || pack.documentName !== "Item") return [];

	await pack.getIndex();

	return (pack.index ?? [])
		.map((entry) => {
			const id = String(entry?._id ?? entry?.id ?? "").trim();
			const name = String(entry?.name ?? "").trim();
			if (!id || !name) return null;
			return {
				uuid: `Compendium.${pack.collection}.Item.${id}`,
				name
			};
		})
		.filter(Boolean)
		.sort((a, b) => a.name.localeCompare(b.name));
};

const parseJsonArray = (value, { fieldLabel }) => {
	const text = String(value ?? "").trim();
	if (!text) return [];
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error(`${fieldLabel} must be valid JSON.`);
	}
	if (!Array.isArray(parsed)) {
		throw new Error(`${fieldLabel} must be a JSON array.`);
	}
	return parsed;
};

const CHARACTERISTIC_PATH_BY_KEY = {
	strength: "body.strength",
	dexterity: "body.dexterity",
	endurance: "body.endurance",
	wits: "mind.wits",
	perception: "mind.perception",
	tech: "mind.tech",
	extrovert: "spirit.extrovert",
	introvert: "spirit.introvert",
	passion: "spirit.passion",
	calm: "spirit.calm",
	faith: "spirit.faith",
	ego: "spirit.ego",
	psi: "occult.psi",
	theurgy: "occult.theurgy"
};

const CHARACTERISTIC_SELECT_ORDER = [
	"strength",
	"dexterity",
	"endurance",
	"wits",
	"perception",
	"tech",
	"extrovert",
	"introvert",
	"passion",
	"calm",
	"faith",
	"ego"
];

const CHARACTERISTIC_ANY_OPTIONS = [
	{ key: "any-body", label: "Any Body", keys: ["strength", "dexterity", "endurance"] },
	{ key: "any-mind", label: "Any Mind", keys: ["wits", "perception", "tech"] },
	{ key: "any-spirit", label: "Any Spirit", keys: ["extrovert", "introvert", "passion", "calm", "faith", "ego"] }
];

const SKILL_PATH_BY_KEY = Object.fromEntries(
	NATURAL_SKILLS_BANK.map((entry) => [entry.key, `natural.${entry.key}`])
);
for (const entry of LEARNED_SKILLS_BANK) {
	SKILL_PATH_BY_KEY[entry.key] = `learned.${entry.key}`;
}

const parseParentSkillPath = (path) => {
	const match = String(path ?? "").match(/^learned\.([^.]+)\.([^.]+)$/i);
	if (!match) return null;
	const groupKey = normalizeSkillKey(match[1]);
	const childKey = normalizeSkillKey(match[2]);
	if (!groupKey || !childKey) return null;
	return { groupKey, childKey };
};

const promptParentSkillChoicesForItem = async ({ groupKey, groupLabel, options = [] }) => {
	if (!Array.isArray(options) || !options.length) return null;

	const row = {
		id: `${groupKey}-0`,
		groupKey,
		groupLabel,
		defaultKey: String(options[0]?.key ?? ""),
		options: options.map((option, idx) => ({
			key: String(option?.key ?? "").trim(),
			label: String(option?.label ?? "").trim(),
			selected: idx === 0
		}))
	};

	const content = await renderTemplate("systems/fs2e/templates/dialogs/parent-skill-choice.hbs", {
		title: `${groupLabel} Assignment`,
		rows: [row]
	});

	return new Promise((resolve) => {
		let settled = false;
		const finish = (value) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};

		let dialog = null;
		dialog = new Dialog({
			title: `${groupLabel} Assignment`,
			content,
			buttons: {},
			render: (html) => {
				const root = html?.[0];
				if (!root) return;

				const readSelection = () => {
					const custom = String(root.querySelector(`[name="custom-${row.id}"]`)?.value ?? "").trim();
					const selected = String(root.querySelector(`input[name="choice-${row.id}"]:checked`)?.value ?? "").trim();
					if (!custom && !selected) return null;

					if (custom) {
						const childKey = normalizeSkillKey(custom);
						if (!childKey) return null;
						return { childKey, display: custom };
					}

					const option = row.options.find((entry) => String(entry?.key ?? "").trim() === selected);
					if (!option) return null;
					return {
						childKey: String(option.key ?? "").trim(),
						display: String(option.label ?? "").trim()
					};
				};

				root.querySelector('[data-action="apply"]')?.addEventListener("click", (event) => {
					event.preventDefault();
					const selection = readSelection();
					if (!selection) return;
					finish(selection);
					dialog?.close();
				});

				root.querySelector('[data-action="cancel"]')?.addEventListener("click", (event) => {
					event.preventDefault();
					finish(null);
					dialog?.close();
				});
			},
			close: () => finish(null)
		}, {
			classes: ["fs2e", "dialog", "chargen-choice", "parent-skill-choice"],
			width: 440,
			height: "auto",
			resizable: true
		});

		dialog.render(true);
	});
};

const toNumberMap = (value) => {
	const out = {};
	if (!value || typeof value !== "object" || Array.isArray(value)) return out;

	for (const [key, raw] of Object.entries(value)) {
		const amount = Number(raw);
		if (!Number.isFinite(amount)) continue;
		const path = String(key ?? "").trim();
		if (!path) continue;
		out[path] = amount;
	}

	return out;
};

const labelizePathKey = (pathKey) => String(pathKey ?? "")
	.split(".")
	.pop()
	.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
	.replace(/^./, (char) => char.toUpperCase());

const characteristicPathToAdjustment = (path, amount) => {
	const token = String(path ?? "").trim();
	if (!token) return null;

	const key = token.includes(".") ? token.split(".").pop() : token;
	const label = CHARACTERISTIC_DEFINITIONS.find((entry) => entry.key === key)?.label ?? labelizePathKey(token);

	return {
		key,
		label,
		value: Number(amount) || 0
	};
};

const skillPathToAdjustment = (path, amount) => {
	const token = String(path ?? "").trim();
	if (!token) return null;
	const parentPath = parseParentSkillPath(token);
	if (parentPath) {
		const groupLabel = SKILL_DEFINITIONS_BY_KEY[parentPath.groupKey]?.label ?? formatSkillLabel(parentPath.groupKey);
		const childLabel = formatSkillLabel(parentPath.childKey);
		return {
			key: parentPath.groupKey,
			path: `learned.${parentPath.groupKey}.${parentPath.childKey}`,
			label: `${groupLabel}: ${childLabel}`,
			value: Number(amount) || 0
		};
	}

	const key = token.includes(".") ? token.split(".").pop() : token;
	const label = [...NATURAL_SKILLS_BANK, ...LEARNED_SKILLS_BANK].find((entry) => entry.key === key)?.label ?? labelizePathKey(token);

	return {
		key,
		path: token,
		label,
		value: Number(amount) || 0
	};
};

const mapCharacteristicKeyToPath = (key) => {
	const token = String(key ?? "").trim().toLowerCase();
	if (!token) return "";
	if (token.includes(".")) return token;
	return CHARACTERISTIC_PATH_BY_KEY[token] ?? "";
};

const mapSkillKeyToPath = (key) => {
	const token = String(key ?? "").trim();
	if (!token) return "";
	if (/^(natural|learned)\./i.test(token)) return token;
	if (token.includes(".")) return `learned.${token}`;
	return SKILL_PATH_BY_KEY[token] ?? `learned.${token}`;
};

const mapSkillEntryToPath = (entry = {}) => {
	const explicitPath = String(entry?.path ?? "").trim();
	if (explicitPath) return mapSkillKeyToPath(explicitPath);
	return mapSkillKeyToPath(entry?.key);
};

const mergeAmount = (map, path, amount) => {
	if (!path) return;
	const value = Number(amount);
	if (!Number.isFinite(value)) return;
	map[path] = (map[path] ?? 0) + value;
};

const adjustmentsToCharacteristicEffects = (adjustments = []) => {
	const effects = {};
	for (const entry of asArray(adjustments)) {
		const amount = Number(entry?.value ?? 0);
		const selectedKey = String(entry?.selectedKey ?? "").trim();
		if (selectedKey) {
			mergeAmount(effects, mapCharacteristicKeyToPath(selectedKey), amount || Number(entry?.selectedValue ?? amount));
			continue;
		}

		const choiceKeys = asArray(entry?.choiceKeys);
		if (choiceKeys.length >= 2) {
			// Skip unresolved legacy two-choice entries.
			continue;
		}

		const choices = asArray(entry?.choice);
		if (choices.length >= 2) {
			// Skip unresolved choice entries until resolved on actor drop.
			continue;
		}
		if (choices.length === 1) {
			const choice = choices[0];
			mergeAmount(effects, mapCharacteristicKeyToPath(choice?.key), Number(choice?.value ?? 0));
			continue;
		}

		mergeAmount(effects, mapCharacteristicKeyToPath(entry?.key), amount);
	}

	return effects;
};

const adjustmentsToSkillEffects = (adjustments = []) => {
	const effects = {};
	for (const entry of asArray(adjustments)) {
		mergeAmount(effects, mapSkillEntryToPath(entry), Number(entry?.value ?? 0));
	}
	return effects;
};

const effectsToCharacteristicAdjustments = (effects = {}) => Object.entries(toNumberMap(effects))
	.map(([path, amount]) => characteristicPathToAdjustment(path, amount))
	.filter(Boolean);

const effectsToSkillAdjustments = (effects = {}) => Object.entries(toNumberMap(effects))
	.map(([path, amount]) => skillPathToAdjustment(path, amount))
	.filter(Boolean);

const formatSigned = (value) => {
	const amount = Number(value ?? 0);
	return amount > 0 ? `+${amount}` : `${amount}`;
};

const formatCharacteristicAdjustmentSummary = (entry = {}, characteristicLabelByKey = {}) => {
	const selectedKey = String(entry?.selectedKey ?? "").trim();
	if (selectedKey) {
		const selectedValue = Number(entry?.selectedValue ?? entry?.value ?? 0);
		const selectedLabel = String(entry?.selectedLabel ?? characteristicLabelByKey[selectedKey] ?? selectedKey).trim();
		return `${selectedLabel} ${formatSigned(selectedValue)}`;
	}

	const choices = asArray(entry?.choice);
	if (choices.length >= 2) {
		const explicitLabel = String(entry?.label ?? "").trim();
		if (explicitLabel) return explicitLabel;
		return choices
			.map((choice) => {
				const key = String(choice?.key ?? "").trim();
				const label = String(choice?.label ?? characteristicLabelByKey[key] ?? key).trim();
				return `${label} ${formatSigned(choice?.value)}`;
			})
			.filter(Boolean)
			.join(" or ");
	}

	const amount = Number(entry?.value ?? 0);
	const choiceKeys = asArray(entry?.choiceKeys);
	if (choiceKeys.length >= 2) {
		const leftKey = String(choiceKeys[0] ?? "").trim();
		const rightKey = String(choiceKeys[1] ?? "").trim();
		const leftLabel = characteristicLabelByKey[leftKey] ?? leftKey;
		const rightLabel = characteristicLabelByKey[rightKey] ?? rightKey;
		return `${leftLabel} ${formatSigned(amount)} or ${rightLabel} ${formatSigned(amount)}`;
	}

	const label = String(entry?.label ?? characteristicLabelByKey[String(entry?.key ?? "").trim()] ?? entry?.key ?? "").trim();
	return `${label} ${formatSigned(amount)}`;
};

const formatSkillAdjustmentSummary = (entry = {}, skillLabelByKey = {}) => {
	const amount = Number(entry?.value ?? 0);
	const label = String(entry?.label ?? skillLabelByKey[String(entry?.key ?? "").trim()] ?? entry?.key ?? "").trim();
	return `${label} ${formatSigned(amount)}`;
};

const resolveLinkedItems = async (entries = []) => {
	const resolved = await Promise.all(
		asArray(entries).map(async (entry) => {
			const uuid = String(entry?.uuid ?? "").trim();
			const fallbackName = String(entry?.name ?? "").trim();
			const item = uuid ? await fromUuid(uuid).catch(() => null) : null;
			const name = String(item?.name ?? fallbackName).trim();
			if (!name) return null;
			return {
				uuid,
				name,
				hasUuid: Boolean(uuid)
			};
		})
	);
	return resolved.filter(Boolean);
};

const readCharacteristicAdjustments = (system = {}) => {
	const legacy = [
		...asArray(system.characteristicsAdjustments),
		...asArray(system.data?.characteristicsAdjustments)
	];
	if (legacy.length) return legacy;

	const fromEffects = effectsToCharacteristicAdjustments({
		...(system.effects?.characteristics ?? {}),
		...(system.data?.effects?.characteristics ?? {})
	});
	if (fromEffects.length) return fromEffects;
	return [];
};

const readSkillAdjustments = (system = {}) => {
	const legacy = [
		...asArray(system.skillsAdjustments),
		...asArray(system.data?.skillsAdjustments)
	];
	if (legacy.length) return legacy;

	const fromEffects = effectsToSkillAdjustments({
		...(system.effects?.skills ?? {}),
		...(system.data?.effects?.skills ?? {})
	});
	if (fromEffects.length) return fromEffects;
	return [];
};

export class FS2EHistorySheet extends FS2EItemSheet {
	_spiritPrimaryTagify = null;
	_languageSpeakTagify = null;
	_languageReadTagify = null;
	_bonusBlessingCurseTagify = null;

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			submitOnChange: false
		});
	}

	async getData(options = {}) {
		const data = await super.getData(options);
		const system = data.system ?? {};
		const characteristicLabelByKey = Object.fromEntries(
			CHARACTERISTIC_DEFINITIONS.map((entry) => [entry.key, entry.label])
		);

		const characteristicOptions = [
			...CHARACTERISTIC_SELECT_ORDER
				.map((key) => {
					const label = String(characteristicLabelByKey[key] ?? "").trim();
					if (!label) return null;
					return { key, label };
				})
				.filter(Boolean),
			{ key: "", label: "----------", disabled: true },
			...CHARACTERISTIC_ANY_OPTIONS.map((entry) => ({ key: entry.key, label: entry.label }))
		];
		const skillOptions = toKeyLabelOptions([
			...NATURAL_SKILLS_BANK.map((entry) => ({ key: entry.key, label: entry.label })),
			...LEARNED_SKILLS_BANK.map((entry) => ({ key: entry.key, label: entry.label }))
		]);
		const spiritPrimary = normalizeAlwaysPrimary(system.spiritAlwaysPrimary ?? system.data?.spiritAlwaysPrimary, { allowLabels: true });
		const languagesSpeak = uniqueByCaseInsensitive([
			...asArray(system.languages?.speak),
			...asArray(system.data?.languages?.speak)
		]);
		const languagesRead = uniqueByCaseInsensitive([
			...asArray(system.languages?.read),
			...asArray(system.data?.languages?.read)
		]);
		const bonusBlessingCurses = uniqueBonusEntries([
			...asArray(system.bonusBlessingCurses),
			...asArray(system.data?.bonusBlessingCurses)
		]);
		const bonusBeneficeAfflictions = uniqueBonusEntries([
			...asArray(system.bonusBeneficeAfflictions),
			...asArray(system.data?.bonusBeneficeAfflictions)
		]);
		const bonusActions = uniqueBonusEntries([
			...asArray(system.bonusActions),
			...asArray(system.data?.bonusActions)
		]);

		const bonusBlessingCurseOptions = await buildCompendiumOptions("fs2e.blessing-curses");
		const bonusBeneficeAfflictionOptions = await buildCompendiumOptions("fs2e.benefices-afflications");
		const bonusActionOptions = await buildCompendiumOptions("fs2e.actions");

		data.view = data.view ?? {};
		data.view.characteristicOptions = characteristicOptions;
		data.view.skillOptions = skillOptions;

		data.view.characteristicsAdjustments = readCharacteristicAdjustments(system);
		data.view.skillsAdjustments = readSkillAdjustments(system);
		data.view.spiritAlwaysPrimary = spiritPrimary.map((key) => ({ key, label: SPIRIT_LABELS[key] ?? key }));
		data.view.languagesSpeak = languagesSpeak;
		data.view.languagesRead = languagesRead;

		data.view.characteristicsAdjustmentsJson = JSON.stringify(data.view.characteristicsAdjustments);
		data.view.skillsAdjustmentsJson = JSON.stringify(data.view.skillsAdjustments);
		data.view.spiritAlwaysPrimaryJson = JSON.stringify(spiritPrimary);
		data.view.languagesSpeakJson = JSON.stringify(languagesSpeak);
		data.view.languagesReadJson = JSON.stringify(languagesRead);
		data.view.bonusBlessingCursesJson = JSON.stringify(bonusBlessingCurses);
		data.view.bonusBeneficeAfflictionsJson = JSON.stringify(bonusBeneficeAfflictions);
		data.view.bonusActionsJson = JSON.stringify(bonusActions);
		data.view.bonusBlessingCurseOptionsJson = JSON.stringify(bonusBlessingCurseOptions);
		data.view.bonusBeneficeAfflictionOptionsJson = JSON.stringify(bonusBeneficeAfflictionOptions);
		data.view.bonusActionOptionsJson = JSON.stringify(bonusActionOptions);

		data.view.bonusBlessingCurseOptions = bonusBlessingCurseOptions;
		data.view.bonusBeneficeAfflictionOptions = bonusBeneficeAfflictionOptions;
		data.view.bonusActionOptions = bonusActionOptions;
		data.view.lockedCharacteristicsSummary = data.view.characteristicsAdjustments
			.map((entry) => formatCharacteristicAdjustmentSummary(entry, characteristicLabelByKey))
			.filter(Boolean);
		data.view.lockedSkillsSummary = data.view.skillsAdjustments
			.map((entry) => formatSkillAdjustmentSummary(entry, Object.fromEntries(
				[...NATURAL_SKILLS_BANK, ...LEARNED_SKILLS_BANK].map((entry) => [entry.key, entry.label])
			)))
			.filter(Boolean);
		data.view.lockedSpiritPrimaryText = joinWithAnd(data.view.spiritAlwaysPrimary.map((entry) => entry.label));
		data.view.lockedLanguagesSpeak = languagesSpeak.join(", ");
		data.view.lockedLanguagesRead = languagesRead.join(", ");
		data.view.hasLockedLanguages = Boolean(data.view.lockedLanguagesSpeak || data.view.lockedLanguagesRead);
		data.view.lockedBlessingCurseItems = await resolveLinkedItems(bonusBlessingCurses);
		data.view.lockedBeneficeAfflictionItems = await resolveLinkedItems(bonusBeneficeAfflictions);
		data.view.lockedActionItems = await resolveLinkedItems(bonusActions);

		return data;
	}

	activateListeners(html) {
		super.activateListeners(html);

		const root = html[0];
		if (!root) return;

		html.on("click", ".open-history-linked-item", async (event) => {
			event.preventDefault();
			const uuid = String(event.currentTarget?.dataset?.uuid ?? "").trim();
			if (!uuid) return;
			const item = await fromUuid(uuid).catch(() => null);
			item?.sheet?.render(true);
		});

		const parseStateInput = (selector, fallback = []) => parseJsonSafe(root.querySelector(selector)?.value, fallback);
		const characteristicLabelByKey = Object.fromEntries(
			CHARACTERISTIC_DEFINITIONS.map((entry) => [entry.key, entry.label])
		);
		const anyOptionByKey = Object.fromEntries(CHARACTERISTIC_ANY_OPTIONS.map((entry) => [entry.key, entry]));
		const formatSigned = (value) => {
			const amount = Number(value ?? 0);
			return amount > 0 ? `+${amount}` : `${amount}`;
		};
		const mergeChoiceEntries = (entries = []) => {
			const merged = new Map();
			for (const entry of entries) {
				const key = String(entry?.key ?? "").trim();
				if (!key) continue;
				const value = Number(entry?.value ?? 0);
				if (!Number.isFinite(value)) continue;
				const current = merged.get(key) ?? {
					key,
					label: String(entry?.label ?? characteristicLabelByKey[key] ?? key).trim(),
					value: 0
				};
				current.value += value;
				merged.set(key, current);
			}
			return [...merged.values()];
		};
		const buildCharacteristicSelection = ({ selectSelector, amountSelector }) => {
			const select = root.querySelector(selectSelector);
			const amountInput = root.querySelector(amountSelector);
			const token = String(select?.value ?? "").trim();
			if (!token) return null;
			const amount = Number(amountInput?.value ?? 0);
			if (!Number.isFinite(amount)) return null;

			const selectedLabel = String(select?.selectedOptions?.[0]?.textContent ?? "").trim();
			const anyOption = anyOptionByKey[token];
			if (anyOption) {
				return {
					token,
					label: selectedLabel || anyOption.label,
					amount,
					choices: anyOption.keys.map((key) => ({
						key,
						label: characteristicLabelByKey[key] ?? key,
						value: amount
					}))
				};
			}

			return {
				token,
				label: selectedLabel || characteristicLabelByKey[token] || token,
				amount,
				choices: [{
					key: token,
					label: characteristicLabelByKey[token] ?? token,
					value: amount
				}]
			};
		};
		const resetCharacteristicInputs = () => {
			const selectA = root.querySelector(".history-characteristic-select-a");
			const selectB = root.querySelector(".history-characteristic-select-b");
			const amountA = root.querySelector(".history-characteristic-amount-a");
			const amountB = root.querySelector(".history-characteristic-amount-b");
			if (selectA) selectA.value = "";
			if (selectB) selectB.value = "";
			if (amountA) amountA.value = "1";
			if (amountB) amountB.value = "1";
		};
		const skillLabelByKey = Object.fromEntries(
			[...NATURAL_SKILLS_BANK, ...LEARNED_SKILLS_BANK].map((entry) => [entry.key, entry.label])
		);
		const state = {
			characteristicsAdjustments: parseStateInput(".history-characteristics-json"),
			skillsAdjustments: parseStateInput(".history-skills-json"),
			spiritAlwaysPrimary: parseStateInput(".history-spirit-json"),
			languagesSpeak: parseStateInput(".history-language-speak-json"),
			languagesRead: parseStateInput(".history-language-read-json"),
			bonusBlessingCurses: parseStateInput(".history-bonus-bc-json"),
			bonusBeneficeAfflictions: parseStateInput(".history-bonus-ba-json"),
			bonusActions: parseStateInput(".history-bonus-action-json")
		};

		const spiritInput = root.querySelector(".history-spirit-primary-menu");
		const spiritLabelByKey = new Map(SPIRIT_PRIMARY_OPTIONS.map((entry) => [entry.key, entry.label]));
		const spiritKeyByLabel = new Map(SPIRIT_PRIMARY_OPTIONS.map((entry) => [entry.label.toLowerCase(), entry.key]));
		const spiritOptionByKey = new Map(SPIRIT_PRIMARY_OPTIONS.map((entry) => [entry.key, entry]));
		const bonusBlessingCurseOptions = parseJsonSafe(root.querySelector(".history-bonus-bc-menu")?.dataset?.options, []);
		const bonusBlessingCurseOptionByUuid = new Map(
			asArray(bonusBlessingCurseOptions)
				.map((entry) => [String(entry?.uuid ?? "").trim(), { uuid: String(entry?.uuid ?? "").trim(), name: String(entry?.name ?? "").trim() }])
				.filter(([uuid, entry]) => uuid && entry.name)
		);
		const bonusBlessingCurseWhitelist = [...bonusBlessingCurseOptionByUuid.values()]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((entry) => ({ value: entry.name, uuid: entry.uuid }));
		const bonusBeneficeAfflictionOptions = parseJsonSafe(root.querySelector(".history-bonus-ba-menu")?.dataset?.options, []);
		const bonusBeneficeAfflictionOptionByUuid = new Map(
			asArray(bonusBeneficeAfflictionOptions)
				.map((entry) => [String(entry?.uuid ?? "").trim(), { uuid: String(entry?.uuid ?? "").trim(), name: String(entry?.name ?? "").trim() }])
				.filter(([uuid, entry]) => uuid && entry.name)
		);
		const bonusBeneficeAfflictionWhitelist = [...bonusBeneficeAfflictionOptionByUuid.values()]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((entry) => ({ value: entry.name, uuid: entry.uuid }));
		const bonusActionOptions = parseJsonSafe(root.querySelector(".history-bonus-action-menu")?.dataset?.options, []);
		const bonusActionOptionByUuid = new Map(
			asArray(bonusActionOptions)
				.map((entry) => [String(entry?.uuid ?? "").trim(), { uuid: String(entry?.uuid ?? "").trim(), name: String(entry?.name ?? "").trim() }])
				.filter(([uuid, entry]) => uuid && entry.name)
		);
		const bonusActionWhitelist = [...bonusActionOptionByUuid.values()]
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((entry) => ({ value: entry.name, uuid: entry.uuid }));
		const bindTextTagMenu = ({ inputSelector, stateKey, instanceKey, languageKey, updatePath }) => {
			const input = root.querySelector(inputSelector);
			if (!input) return;
			const languageWhitelist = getLanguageOptions(languageKey);

			this[instanceKey]?.destroy();
			this._prepareTagifyInput(input);
			this[instanceKey] = new Tagify(input, {
				whitelist: languageWhitelist,
				duplicates: false,
				dropdown: {
					enabled: 0,
					closeOnSelect: false,
					maxItems: languageWhitelist.length || 10
				}
			});

			const initialTags = uniqueByCaseInsensitive(asArray(state[stateKey]).map((entry) => String(entry ?? "").trim()).filter(Boolean));
			if (initialTags.length) this[instanceKey].addTags(initialTags, true, true);

			let syncing = false;
			const commit = async () => {
				if (syncing) return;
				syncing = true;
				try {
					state[stateKey] = uniqueByCaseInsensitive(
						(this[instanceKey]?.value ?? [])
							.map((entry) => String(entry?.value ?? "").trim())
							.filter(Boolean)
					);

					const normalizedTags = state[stateKey];
					const renderedTags = (this[instanceKey]?.value ?? [])
						.map((entry) => String(entry?.value ?? "").trim())
						.filter(Boolean);
					if (normalizedTags.length !== renderedTags.length
						|| normalizedTags.some((tag, index) => tag !== renderedTags[index])) {
						this[instanceKey]?.removeAllTags();
						if (normalizedTags.length) this[instanceKey]?.addTags(normalizedTags, true, true);
					}

					syncAll();
					await this.item.update({ [updatePath]: state[stateKey] });
				} finally {
					syncing = false;
				}
			};

			this[instanceKey].on("change", commit);
			this[instanceKey].on("add", commit);
			this[instanceKey].on("remove", commit);
			this._bindTagifyDropdownInteractions(this[instanceKey]);
		};
		const bindCompendiumTagMenu = ({ inputSelector, stateKey, instanceKey, whitelist, optionByUuid, updatePath }) => {
			const input = root.querySelector(inputSelector);
			if (!input) return;

			this[instanceKey]?.destroy();
			this._prepareTagifyInput(input);
			this[instanceKey] = new Tagify(input, {
				whitelist,
				enforceWhitelist: true,
				duplicates: false,
				dropdown: {
					enabled: 0,
					closeOnSelect: false,
					maxItems: whitelist.length || 10,
					searchKeys: ["value"]
				}
			});

			const initialTags = uniqueCompendiumTagEntries(asArray(state[stateKey]).map((entry) => ({
				value: String(entry?.name ?? "").trim(),
				uuid: String(entry?.uuid ?? "").trim()
			})).filter((entry) => entry.value && entry.uuid));
			if (initialTags.length) this[instanceKey].addTags(initialTags, true, true);

			let syncing = false;
			const commit = async () => {
				if (syncing) return;
				syncing = true;
				try {
					state[stateKey] = uniqueBonusEntries(
						(this[instanceKey]?.value ?? [])
							.map((entry) => {
								const uuid = String(entry?.uuid ?? "").trim();
								const value = String(entry?.value ?? "").trim();
								const mapped = optionByUuid.get(uuid);
								return {
									uuid: mapped?.uuid ?? uuid,
									name: mapped?.name ?? value
								};
							})
							.filter((entry) => entry.uuid && entry.name)
					);

					const normalizedTags = state[stateKey].map((entry) => ({ value: entry.name, uuid: entry.uuid }));
					const renderedTags = (this[instanceKey]?.value ?? [])
						.map((entry) => ({
							value: String(entry?.value ?? "").trim(),
							uuid: String(entry?.uuid ?? "").trim()
						}))
						.filter((entry) => entry.value && entry.uuid);
					if (normalizedTags.length !== renderedTags.length
						|| normalizedTags.some((entry, index) => entry.value !== renderedTags[index]?.value || entry.uuid !== renderedTags[index]?.uuid)) {
						this[instanceKey]?.removeAllTags();
						if (normalizedTags.length) this[instanceKey]?.addTags(normalizedTags, true, true);
					}

					syncAll();
					await this.item.update({ [updatePath]: state[stateKey] });
				} finally {
					syncing = false;
				}
			};

			this[instanceKey].on("change", commit);
			this[instanceKey].on("add", commit);
			this[instanceKey].on("remove", commit);
			this._bindTagifyDropdownInteractions(this[instanceKey]);
		};

		const syncSpiritWhitelistForSelection = (selectedKeys = []) => {
			if (!this._spiritPrimaryTagify) return;

			const selectedByPair = new Map();
			for (const key of selectedKeys) {
				const option = spiritOptionByKey.get(key);
				if (!option || selectedByPair.has(option.pair)) continue;
				selectedByPair.set(option.pair, option.key);
			}

			this._spiritPrimaryTagify.settings.whitelist = SPIRIT_PRIMARY_OPTIONS
				.filter((option) => {
					const chosen = selectedByPair.get(option.pair);
					return !chosen || chosen === option.key;
				})
				.map((option) => option.label);
		};

		if (spiritInput) {
			this._spiritPrimaryTagify?.destroy();
			this._prepareTagifyInput(spiritInput);
			this._spiritPrimaryTagify = new Tagify(spiritInput, {
				whitelist: SPIRIT_PRIMARY_OPTIONS.map((entry) => entry.label),
				enforceWhitelist: true,
				duplicates: false,
				dropdown: {
					enabled: 0,
					closeOnSelect: false,
					maxItems: SPIRIT_PRIMARY_OPTIONS.length
				}
			});

			const initialKeys = normalizeAlwaysPrimary(state.spiritAlwaysPrimary, { allowLabels: true });
			const initialLabels = initialKeys.map((key) => spiritLabelByKey.get(key)).filter(Boolean);
			if (initialLabels.length) this._spiritPrimaryTagify.addTags(initialLabels, true, true);
			this._bindTagifyDropdownInteractions(this._spiritPrimaryTagify);
			syncSpiritWhitelistForSelection(initialKeys);

			let savingSpirit = false;
			const commitSpiritSelection = async () => {
				if (savingSpirit) return;
				savingSpirit = true;
				try {
					const labels = (this._spiritPrimaryTagify?.value ?? []).map((entry) => String(entry?.value ?? "").trim());
					const candidateKeys = labels.map((label) => spiritKeyByLabel.get(label.toLowerCase()) ?? label);
					state.spiritAlwaysPrimary = normalizeAlwaysPrimary(candidateKeys, { allowLabels: true });

					const nextLabels = state.spiritAlwaysPrimary
						.map((key) => spiritLabelByKey.get(key))
						.filter(Boolean);
					this._spiritPrimaryTagify.removeAllTags();
					if (nextLabels.length) this._spiritPrimaryTagify.addTags(nextLabels, true, true);
					syncSpiritWhitelistForSelection(state.spiritAlwaysPrimary);
					syncAll();
					await this.item.update({ "system.spiritAlwaysPrimary": state.spiritAlwaysPrimary });
				} finally {
					savingSpirit = false;
				}
			};

			this._spiritPrimaryTagify.on("change", commitSpiritSelection);
			this._spiritPrimaryTagify.on("add", commitSpiritSelection);
			this._spiritPrimaryTagify.on("remove", commitSpiritSelection);

			spiritInput.addEventListener("focus", () => {
				syncSpiritWhitelistForSelection(state.spiritAlwaysPrimary);
			});
		}

		bindTextTagMenu({
			inputSelector: ".history-language-speak-menu",
			stateKey: "languagesSpeak",
			instanceKey: "_languageSpeakTagify",
			languageKey: "speak",
			updatePath: "system.languages.speak"
		});
		bindTextTagMenu({
			inputSelector: ".history-language-read-menu",
			stateKey: "languagesRead",
			instanceKey: "_languageReadTagify",
			languageKey: "read",
			updatePath: "system.languages.read"
		});
		bindCompendiumTagMenu({
			inputSelector: ".history-bonus-bc-menu",
			stateKey: "bonusBlessingCurses",
			instanceKey: "_bonusBlessingCurseTagify",
			whitelist: bonusBlessingCurseWhitelist,
			optionByUuid: bonusBlessingCurseOptionByUuid,
			updatePath: "system.bonusBlessingCurses"
		});
		bindCompendiumTagMenu({
			inputSelector: ".history-bonus-ba-menu",
			stateKey: "bonusBeneficeAfflictions",
			instanceKey: "_bonusBeneficeAfflictionTagify",
			whitelist: bonusBeneficeAfflictionWhitelist,
			optionByUuid: bonusBeneficeAfflictionOptionByUuid,
			updatePath: "system.bonusBeneficeAfflictions"
		});
		bindCompendiumTagMenu({
			inputSelector: ".history-bonus-action-menu",
			stateKey: "bonusActions",
			instanceKey: "_bonusActionTagify",
			whitelist: bonusActionWhitelist,
			optionByUuid: bonusActionOptionByUuid,
			updatePath: "system.bonusActions"
		});

		const setHidden = (selector, value) => {
			const el = root.querySelector(selector);
			if (!el) return;
			el.value = JSON.stringify(value);
		};

		const persistCharacteristicAdjustments = async () => this.item.update({
			"system.effects.characteristics": adjustmentsToCharacteristicEffects(state.characteristicsAdjustments),
			"system.characteristicsAdjustments": state.characteristicsAdjustments
		});

		const persistSkillAdjustments = async () => this.item.update({
			"system.effects.skills": adjustmentsToSkillEffects(state.skillsAdjustments),
			"system.skillsAdjustments": state.skillsAdjustments
		});

		const renderChipList = ({ selector, list, toLabel, removeClass }) => {
			const container = root.querySelector(selector);
			if (!container) return;
			container.innerHTML = list
				.map((entry, idx) => `<span class="history-chip fs2e-tag-chip"><span class="history-chip-label fs2e-tag-chip-label">${toLabel(entry)}</span><button type="button" class="history-chip-remove fs2e-tag-chip-remove ${removeClass}" data-index="${idx}">x</button></span>`)
				.join("");
		};

		const syncAll = () => {
			setHidden(".history-characteristics-json", state.characteristicsAdjustments);
			setHidden(".history-skills-json", state.skillsAdjustments);
			setHidden(".history-spirit-json", state.spiritAlwaysPrimary);
			setHidden(".history-language-speak-json", state.languagesSpeak);
			setHidden(".history-language-read-json", state.languagesRead);
			setHidden(".history-bonus-bc-json", state.bonusBlessingCurses);
			setHidden(".history-bonus-ba-json", state.bonusBeneficeAfflictions);
			setHidden(".history-bonus-action-json", state.bonusActions);

			renderChipList({
				selector: ".history-characteristics-list",
				list: state.characteristicsAdjustments,
				toLabel: (entry) => {
					const selectedKey = String(entry?.selectedKey ?? "").trim();
					if (selectedKey) {
						const selectedValue = Number(entry?.selectedValue ?? entry?.value ?? 0);
						const selectedLabel = String(entry?.selectedLabel ?? characteristicLabelByKey[selectedKey] ?? selectedKey).trim();
						return `${selectedLabel} ${formatSigned(selectedValue)}`;
					}

					const choices = asArray(entry?.choice);
					if (choices.length >= 2) {
						const explicitLabel = String(entry?.label ?? "").trim();
						if (explicitLabel) return explicitLabel;
						const choiceLabel = choices
							.map((choice) => {
								const key = String(choice?.key ?? "").trim();
								const label = String(choice?.label ?? characteristicLabelByKey[key] ?? key).trim();
								return `${label} ${formatSigned(choice?.value)}`;
							})
							.filter(Boolean)
							.join(" or ");
						return choiceLabel || "Characteristic choice";
					}

					const amount = Number(entry?.value ?? 0);
					const choiceKeys = asArray(entry?.choiceKeys);
					if (choiceKeys.length >= 2) {
						const leftKey = String(choiceKeys[0] ?? "").trim();
						const rightKey = String(choiceKeys[1] ?? "").trim();
						const leftLabel = characteristicLabelByKey[leftKey] ?? leftKey;
						const rightLabel = characteristicLabelByKey[rightKey] ?? rightKey;
						return `${leftLabel} ${formatSigned(amount)} or ${rightLabel} ${formatSigned(amount)}`;
					}
					const label = String(entry?.label ?? characteristicLabelByKey[String(entry?.key ?? "").trim()] ?? entry?.key ?? "").trim();
					return `${label} ${formatSigned(amount)}`;
				},
				removeClass: "remove-history-characteristic"
			});
			renderChipList({
				selector: ".history-skills-list",
				list: state.skillsAdjustments,
				toLabel: (entry) => {
					const amount = Number(entry?.value ?? 0);
					const label = String(entry?.label ?? skillLabelByKey[String(entry?.key ?? "").trim()] ?? entry?.key ?? "").trim();
					return `${label} ${amount > 0 ? `+${amount}` : amount}`;
				},
				removeClass: "remove-history-skill"
			});
		};

		syncAll();

		root.querySelector(".add-history-characteristic")?.addEventListener("click", async () => {
			const first = buildCharacteristicSelection({
				selectSelector: ".history-characteristic-select-a",
				amountSelector: ".history-characteristic-amount-a"
			});
			const second = buildCharacteristicSelection({
				selectSelector: ".history-characteristic-select-b",
				amountSelector: ".history-characteristic-amount-b"
			});

			if (!first && !second) {
				resetCharacteristicInputs();
				return;
			}

			if (first && second) {
				const mergedChoices = mergeChoiceEntries([...(first.choices ?? []), ...(second.choices ?? [])]);
				state.characteristicsAdjustments.push({
					key: "choice",
					label: `${first.label} ${formatSigned(first.amount)} or ${second.label} ${formatSigned(second.amount)}`,
					choice: mergedChoices,
					value: 0
				});
			} else {
				const selected = first ?? second;
				if (selected.choices.length === 1) {
					const concrete = selected.choices[0];
					state.characteristicsAdjustments.push({
						key: concrete.key,
						label: selected.label,
						value: Number(concrete.value ?? selected.amount)
					});
				} else {
					state.characteristicsAdjustments.push({
						key: "choice",
						label: `${selected.label} ${formatSigned(selected.amount)}`,
						choice: mergeChoiceEntries(selected.choices),
						value: 0
					});
				}
			}

			resetCharacteristicInputs();

			syncAll();
			await persistCharacteristicAdjustments();
		});

		root.querySelector(".add-history-skill")?.addEventListener("click", async () => {
		const addSkill = async ({ selectSelector, amountSelector }) => {
				const select = root.querySelector(selectSelector);
				const amountInput = root.querySelector(amountSelector);
				const key = String(select?.value ?? "").trim();
				if (!key) return false;
				const amount = Number(amountInput?.value ?? 0);
				if (!Number.isFinite(amount)) return false;
				const label = String(select?.selectedOptions?.[0]?.textContent ?? skillLabelByKey[key] ?? key).trim();

				const isParentGroup = LEARNED_SKILL_GROUP_KEYS.has(key);
				if (isParentGroup) {
					const options = [];
					const seen = new Set();
					const pushOption = ({ childKey, display }) => {
						const normalizedChild = normalizeSkillKey(childKey || display);
						const normalizedLabel = String(display ?? "").trim();
						if (!normalizedChild || !normalizedLabel) return;
						const token = normalizedChild.toLowerCase();
						if (seen.has(token)) return;
						seen.add(token);
						options.push({ key: normalizedChild, label: normalizedLabel });
					};

					for (const baseLabel of asArray(LEARNED_GROUP_OPTION_LABELS[key])) {
						pushOption({ childKey: baseLabel, display: baseLabel });
					}

					const selection = await promptParentSkillChoicesForItem({
						groupKey: key,
						groupLabel: label,
						options
					});
					if (!selection) return false;

					const childKey = normalizeSkillKey(selection.childKey);
					const display = String(selection.display ?? "").trim() || formatSkillLabel(childKey);
					if (!childKey) return false;

					state.skillsAdjustments.push({
						key,
						path: `learned.${key}.${childKey}`,
						label: `${label}: ${display}`,
						display,
						value: amount
					});
				} else {
					state.skillsAdjustments.push({
						key,
						path: mapSkillKeyToPath(key),
						label,
						value: amount
					});
				}

				if (select) select.value = "";
				if (amountInput) amountInput.value = "1";
				return true;
			};

			const firstAdded = await addSkill({ selectSelector: ".history-skill-select-a", amountSelector: ".history-skill-amount-a" });
			const secondAdded = await addSkill({ selectSelector: ".history-skill-select-b", amountSelector: ".history-skill-amount-b" });
			if (firstAdded || secondAdded) {
				syncAll();
				await persistSkillAdjustments();
			}
		});

		root.addEventListener("click", async (event) => {
			const button = event.target?.closest?.("button.history-chip-remove");
			if (!button) return;
			const index = Number(button.dataset.index ?? -1);
			if (!Number.isInteger(index) || index < 0) return;

			let persistChanges = null;
			if (button.classList.contains("remove-history-characteristic")) {
				state.characteristicsAdjustments.splice(index, 1);
				persistChanges = persistCharacteristicAdjustments;
			}
			if (button.classList.contains("remove-history-skill")) {
				state.skillsAdjustments.splice(index, 1);
				persistChanges = persistSkillAdjustments;
			}
			syncAll();
			if (persistChanges) await persistChanges();
		});
	}

	async _updateObject(event, formData) {
		try {
			if (Object.prototype.hasOwnProperty.call(formData, "system.characteristicsAdjustmentsJson")) {
				const characteristicsAdjustments = parseJsonArray(formData["system.characteristicsAdjustmentsJson"], {
					fieldLabel: "Characteristics adjustments"
				});
				formData["system.effects.characteristics"] = adjustmentsToCharacteristicEffects(characteristicsAdjustments);
				formData["system.characteristicsAdjustments"] = characteristicsAdjustments;
			}
			if (Object.prototype.hasOwnProperty.call(formData, "system.skillsAdjustmentsJson")) {
				const skillsAdjustments = parseJsonArray(formData["system.skillsAdjustmentsJson"], {
					fieldLabel: "Skills adjustments"
				});
				formData["system.effects.skills"] = adjustmentsToSkillEffects(skillsAdjustments);
				formData["system.skillsAdjustments"] = skillsAdjustments;
			}
			if (Object.prototype.hasOwnProperty.call(formData, "system.spiritAlwaysPrimaryJson")) {
				formData["system.spiritAlwaysPrimary"] = normalizeAlwaysPrimary(parseJsonArray(formData["system.spiritAlwaysPrimaryJson"], {
					fieldLabel: "Spirit Always Primary"
				}), { allowLabels: true });
			}
			if (Object.prototype.hasOwnProperty.call(formData, "system.languagesSpeakJson")) {
				formData["system.languages.speak"] = uniqueByCaseInsensitive(parseJsonArray(formData["system.languagesSpeakJson"], {
					fieldLabel: "Languages (Speak)"
				}));
			}
			if (Object.prototype.hasOwnProperty.call(formData, "system.languagesReadJson")) {
				formData["system.languages.read"] = uniqueByCaseInsensitive(parseJsonArray(formData["system.languagesReadJson"], {
					fieldLabel: "Languages (Read)"
				}));
			}
			if (Object.prototype.hasOwnProperty.call(formData, "system.bonusBlessingCursesJson")) {
				formData["system.bonusBlessingCurses"] = parseJsonArray(formData["system.bonusBlessingCursesJson"], {
					fieldLabel: "Bonus Blessings/Curses"
				});
			}
			if (Object.prototype.hasOwnProperty.call(formData, "system.bonusBeneficeAfflictionsJson")) {
				formData["system.bonusBeneficeAfflictions"] = parseJsonArray(formData["system.bonusBeneficeAfflictionsJson"], {
					fieldLabel: "Bonus Benefices/Afflictions"
				});
			}
			if (Object.prototype.hasOwnProperty.call(formData, "system.bonusActionsJson")) {
				formData["system.bonusActions"] = parseJsonArray(formData["system.bonusActionsJson"], {
					fieldLabel: "Bonus Actions"
				});
			}
		} catch (error) {
			ui.notifications?.error(String(error?.message ?? error));
			return;
		}

		delete formData["system.characteristicsAdjustmentsJson"];
		delete formData["system.skillsAdjustmentsJson"];
		delete formData["system.spiritAlwaysPrimaryJson"];
		delete formData["system.languagesSpeakJson"];
		delete formData["system.languagesReadJson"];
		delete formData["system.bonusBlessingCursesJson"];
		delete formData["system.bonusBeneficeAfflictionsJson"];
		delete formData["system.bonusActionsJson"];

		return super._updateObject(event, formData);
	}

	async close(options = {}) {
		this._spiritPrimaryTagify?.destroy();
		this._spiritPrimaryTagify = null;
		this._languageSpeakTagify?.destroy();
		this._languageSpeakTagify = null;
		this._languageReadTagify?.destroy();
		this._languageReadTagify = null;
		this._bonusBlessingCurseTagify?.destroy();
		this._bonusBlessingCurseTagify = null;
		this._bonusBeneficeAfflictionTagify?.destroy();
		this._bonusBeneficeAfflictionTagify = null;
		this._bonusActionTagify?.destroy();
		this._bonusActionTagify = null;
		return super.close(options);
	}
}
