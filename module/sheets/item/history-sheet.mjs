import { FS2EItemSheet } from "./item-sheet.mjs";
import { buildCharacteristicsView, bindSpiritRadios } from "./characteristics-helpers.mjs";
import { enrichProseMirrorContent } from "../../ui/prosemirror/prosemirror.mjs";

export class FS2EHistorySheet extends FS2EItemSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["fs2e", "sheet", "item", "history"],
      template: "systems/fs2e/templates/item/history-sheet.hbs",
      width: 560,
      height: 520,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  async getData() {
    const data = super.getData();
    const system = data.system ?? this.item.system ?? {};
    data.view = { characteristics: buildCharacteristicsView(system) };
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
    bindSpiritRadios(html, this.item);
  }
}
