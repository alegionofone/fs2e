import { FS2EItemSheet } from "./item-sheet.mjs";
import { enrichProseMirrorContent } from "../../ui/prosemirror/prosemirror.mjs";
import { bindTagsInput } from "../../ui/tagify/bind-tags.mjs";
import { bindModifierTagsInput } from "../../ui/tagify/bind-modifier-tags.mjs";

export class FS2EHistorySheet extends FS2EItemSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["fs2e", "sheet", "item", "history"],
      template: "systems/fs2e/templates/item/history-sheet.hbs",
      width: 560,
      height: "auto",
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  async getData() {
    const data = super.getData();
    const system = data.system ?? this.item.system ?? {};
    const labelize = (k) =>
      (k ?? "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    const mapping = CONFIG?.fs2e?.mappingData ?? {};
    const tagConfig = mapping?.tags?.item ?? {};
    const allowedTags = [...new Set([...(tagConfig.common ?? []), ...(tagConfig.history ?? [])])];
    const characteristicOptions = Object.keys(mapping?.characteristics ?? {})
      .filter((k) => !["vitality", "wyrd"].includes(k))
      .map((key) => ({ key, label: labelize(key) }));
    const LEARNED_GROUP_KEYS = ["artisan", "arts", "drive", "lore", "science", "social", "techRedemption", "warfare"];
    const groupLabel = Object.fromEntries(LEARNED_GROUP_KEYS.map((k) => [k, labelize(k)]));
    const skillOptions = [
      ...Object.keys(mapping?.natural ?? {}).map((key) => ({ key, label: labelize(key) })),
      ...Object.keys(mapping?.learned ?? {}).map((key) => ({ key, label: labelize(key) }))
    ];
    const parent = this.item.parent;
    if (parent?.type === "character") {
      const learnedLegacy = foundry.utils.getProperty(parent.system, "system.skills.learned") ?? {};
      const learnedPrimary = foundry.utils.getProperty(parent.system, "skills.learned") ?? {};
      const learned = foundry.utils.mergeObject(learnedLegacy, learnedPrimary, {
        inplace: false,
        recursive: true
      });
      for (const [groupKey, groupVal] of Object.entries(learned)) {
        if (!LEARNED_GROUP_KEYS.includes(groupKey)) continue;
        if (!groupVal || typeof groupVal !== "object" || Array.isArray(groupVal)) continue;
        for (const [entryKey, entryVal] of Object.entries(groupVal)) {
          if (entryKey.startsWith("__")) continue;
          if (!entryVal || typeof entryVal !== "object" || Array.isArray(entryVal)) continue;
          const display =
            typeof entryVal.display === "string" && entryVal.display.trim()
              ? entryVal.display.trim()
              : labelize(entryKey);
          skillOptions.push({
            key: `${groupKey}.${entryKey}`,
            label: `${groupLabel[groupKey] ?? labelize(groupKey)}: ${display}`
          });
        }
      }
    }
    const uniq = (arr) => {
      const seen = new Set();
      const out = [];
      for (const entry of arr) {
        const token = String(entry?.key ?? "").toLowerCase();
        if (!token || seen.has(token)) continue;
        seen.add(token);
        out.push(entry);
      }
      return out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    };
    data.view = {};
    data.view.allowedTags = allowedTags;
    data.view.characteristicTagOptions = uniq(characteristicOptions);
    data.view.skillTagOptions = uniq(skillOptions);
    this._allowedTags = allowedTags;
    this._characteristicTagOptions = data.view.characteristicTagOptions;
    this._skillTagOptions = data.view.skillTagOptions;
    data.enrichedContent = {
      description: await enrichProseMirrorContent(system.description?.value ?? "", {
        document: this.item,
        secrets: this.item.isOwner
      })
    };

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    bindTagsInput(html, this.item, { allowedTags: this._allowedTags ?? [] });
    bindModifierTagsInput(html, this.item, {
      selector: "fs2e-mod-tags.fs2e-history-char-mods",
      options: this._characteristicTagOptions ?? [],
      path: "characteristicsAdjustments"
    });
    bindModifierTagsInput(html, this.item, {
      selector: "fs2e-mod-tags.fs2e-history-skill-mods",
      options: this._skillTagOptions ?? [],
      path: "skillsAdjustments"
    });
  }
}
