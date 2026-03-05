export class FS2ECharacterSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["fs2e", "sheet", "actor", "character"],
      width: 760,
      height: 780
    });
  }

  get template() {
    return "systems/fs2e/templates/actor/character.hbs";
  }

  async getData(options = {}) {
    const data = await super.getData(options);
    data.system = this.actor.system;
    return data;
  }
}
