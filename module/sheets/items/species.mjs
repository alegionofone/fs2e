import Tagify from "../../ui/tagify/index.mjs";
import { SPIRIT_PRIMARY_OPTIONS, normalizeAlwaysPrimary } from "../../global/spirit.mjs";
import {
	readSpeciesAlwaysPrimary,
	readSpeciesOccultAffinities,
	readSpeciesOccultEnabled
} from "../../global/species/data.mjs";
import { FS2EItemSheet } from "./base-item-sheet.mjs";

const CHARACTERISTICS_BANK = [
	{
		key: "body",
		label: "Body",
		stats: [
			{ key: "strength", label: "Strength" },
			{ key: "dexterity", label: "Dexterity" },
			{ key: "endurance", label: "Endurance" }
		]
	},
	{
		key: "mind",
		label: "Mind",
		stats: [
			{ key: "wits", label: "Wits" },
			{ key: "perception", label: "Perception" },
			{ key: "tech", label: "Tech" }
		]
	}
];

const OCCULT_OPTIONS = [
	{ key: "psi", label: "Psi" },
	{ key: "theurgy", label: "Theurgy" }
];

const toDisplayNumber = (value, fallback = 0) => {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
};

const readAlwaysPrimary = (system) => readSpeciesAlwaysPrimary(system, { allowLabels: true });

const readOccultAffinities = (system) => readSpeciesOccultAffinities(system, { max: 1 });

const readOccultEnabled = (system) => readSpeciesOccultEnabled(system);

export class FS2ESpeciesSheet extends FS2EItemSheet {
	_spiritPrimaryTagify = null;
	_occultTagify = null;

	async getData(options = {}) {
		const data = await super.getData(options);

		data.view = data.view ?? {};
		data.view.characteristics = CHARACTERISTICS_BANK.map((group) => ({
			key: group.key,
			label: group.label,
			stats: group.stats.map((stat) => ({
				key: stat.key,
				label: stat.label,
				base: toDisplayNumber(foundry.utils.getProperty(data.system, `characteristics.${group.key}.${stat.key}.base`), 0),
				max: toDisplayNumber(foundry.utils.getProperty(data.system, `characteristics.${group.key}.${stat.key}.max`), 0)
			}))
		}));
		data.view.spiritPrimaryLabels = SPIRIT_PRIMARY_OPTIONS.map((entry) => entry.label);
		data.view.spiritAlwaysPrimary = readAlwaysPrimary(data.system);
		data.view.occultLabels = OCCULT_OPTIONS.map((entry) => entry.label);
		data.view.occultAffinities = readOccultAffinities(data.system);
		data.view.occultEnabled = readOccultEnabled(data.system);

		return data;
	}

	activateListeners(html) {
		super.activateListeners(html);

		const root = html[0];
		if (!root) return;

		const input = root.querySelector(".species-spirit-primary-menu");

		const labelByKey = new Map(SPIRIT_PRIMARY_OPTIONS.map((entry) => [entry.key, entry.label]));
		const keyByLabel = new Map(SPIRIT_PRIMARY_OPTIONS.map((entry) => [entry.label.toLowerCase(), entry.key]));
		const optionByKey = new Map(SPIRIT_PRIMARY_OPTIONS.map((entry) => [entry.key, entry]));

		const syncWhitelistForSelection = (selectedKeys = []) => {
			const selectedByPair = new Map();

			for (const key of selectedKeys) {
				const option = optionByKey.get(key);
				if (!option || selectedByPair.has(option.pair)) continue;
				selectedByPair.set(option.pair, option.key);
			}

			const nextWhitelist = SPIRIT_PRIMARY_OPTIONS
				.filter((option) => {
					const chosen = selectedByPair.get(option.pair);
					return !chosen || chosen === option.key;
				})
				.map((option) => option.label);

			this._spiritPrimaryTagify.settings.whitelist = nextWhitelist;
		};

		const whitelist = SPIRIT_PRIMARY_OPTIONS.map((entry) => entry.label);
		const initialKeys = readAlwaysPrimary(this.item.system);
		const initialLabels = initialKeys.map((key) => labelByKey.get(key)).filter(Boolean);

		if (input) {
			this._spiritPrimaryTagify?.destroy();
			this._spiritPrimaryTagify = new Tagify(input, {
				whitelist,
				enforceWhitelist: true,
				duplicates: false,
				dropdown: {
					enabled: 0,
					closeOnSelect: false,
					maxItems: whitelist.length
				}
			});

			if (initialLabels.length) this._spiritPrimaryTagify.addTags(initialLabels, true, true);
			syncWhitelistForSelection(initialKeys);

			let saving = false;
			this._spiritPrimaryTagify.on("change", async () => {
				if (saving) return;
				saving = true;

				try {
					const labels = (this._spiritPrimaryTagify?.value ?? []).map((entry) => String(entry?.value ?? "").trim());
					const candidateKeys = labels.map((label) => keyByLabel.get(label.toLowerCase()) ?? label);
					const nextKeys = normalizeAlwaysPrimary(candidateKeys);
					const nextLabels = nextKeys.map((key) => labelByKey.get(key)).filter(Boolean);

					this._spiritPrimaryTagify.removeAllTags();
					if (nextLabels.length) this._spiritPrimaryTagify.addTags(nextLabels, true, true);
					syncWhitelistForSelection(nextKeys);

					await this.item.update({ "system.spiritAlwaysPrimary": nextKeys });
				} finally {
					saving = false;
				}
			});
		}

		const occultInput = root.querySelector(".species-occult-menu");
		const occultToggle = root.querySelector(".species-occult-toggle");
		const occultRow = root.querySelector(".species-occult-row");
		const setOccultRowState = (enabled) => {
			if (!occultRow) return;
			occultRow.classList.toggle("is-hidden", !enabled);
		};

		const initializeOccultTagify = () => {
			if (!occultInput) return;
			this._occultTagify?.destroy();
			this._occultTagify = null;

			const occultLabelByKey = new Map(OCCULT_OPTIONS.map((entry) => [entry.key, entry.label]));
			const occultKeyByLabel = new Map(OCCULT_OPTIONS.map((entry) => [entry.label.toLowerCase(), entry.key]));
			const occultWhitelist = OCCULT_OPTIONS.map((entry) => entry.label);
			const initialOccultKeys = readOccultAffinities(this.item.system);
			const initialOccultLabels = initialOccultKeys.map((key) => occultLabelByKey.get(key)).filter(Boolean);

			this._occultTagify = new Tagify(occultInput, {
				whitelist: occultWhitelist,
				enforceWhitelist: true,
				duplicates: false,
				maxTags: 1,
				dropdown: {
					enabled: 0,
					closeOnSelect: true,
					maxItems: occultWhitelist.length
				}
			});

			if (initialOccultLabels.length) this._occultTagify.addTags(initialOccultLabels, true, true);

			let savingOccult = false;
			this._occultTagify.on("change", async () => {
				if (savingOccult) return;
				savingOccult = true;

				try {
					const labels = (this._occultTagify?.value ?? []).map((entry) => String(entry?.value ?? "").trim());
					const candidateKeys = labels.map((label) => occultKeyByLabel.get(label.toLowerCase()) ?? "");
					const nextKeys = Array.from(new Set(candidateKeys.filter(Boolean))).slice(0, 1);
					const nextLabels = nextKeys.map((key) => occultLabelByKey.get(key)).filter(Boolean);

					this._occultTagify.removeAllTags();
					if (nextLabels.length) this._occultTagify.addTags(nextLabels, true, true);
					if (occultToggle) occultToggle.checked = nextKeys.length > 0;

					await this.item.update({
						"system.occultEnabled": nextKeys.length > 0,
						"system.occultAffinities": nextKeys
					});
				} finally {
					savingOccult = false;
				}
			});
		};

		if (occultInput) {
			const occultEnabled = readOccultEnabled(this.item.system);
			setOccultRowState(occultEnabled);
			if (occultToggle) occultToggle.checked = occultEnabled;
			initializeOccultTagify();

			occultToggle?.addEventListener("change", async () => {
				const enabled = Boolean(occultToggle.checked);
				setOccultRowState(enabled);

				if (enabled) {
					await this.item.update({ "system.occultEnabled": true });
					return;
				}

				this._occultTagify?.removeAllTags();
				await this.item.update({
					"system.occultEnabled": false,
					"system.occultAffinities": []
				});
			});
		}
	}

	async close(options = {}) {
		this._spiritPrimaryTagify?.destroy();
		this._spiritPrimaryTagify = null;
		this._occultTagify?.destroy();
		this._occultTagify = null;
		return super.close(options);
	}
}
