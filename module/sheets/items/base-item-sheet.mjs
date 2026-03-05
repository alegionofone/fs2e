export class FS2EItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["fs2e", "sheet", "item"],
      width: 640,
      height: 720,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "description"
        }
      ]
    });
  }

  get template() {
    const itemType = this.item.type.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    return `systems/fs2e/templates/items/${itemType}.hbs`;
  }

  async getData(options = {}) {
    const data = await super.getData(options);
    data.system = this.item.system;
    return data;
  }
}