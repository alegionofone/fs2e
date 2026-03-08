export const preloadHandlebarsTemplates = async () => {
  const templatePaths = [
    "systems/fs2e/templates/actor/character.hbs",
    "systems/fs2e/templates/actor/actor-tabs/characteristics-tab.hbs",
    "systems/fs2e/templates/actor/actor-tabs/qualities-tab.hbs",
    "systems/fs2e/templates/dialogs/history-characteristic-choice.hbs",
    "systems/fs2e/templates/chat/skill-roll-card.hbs",
    "systems/fs2e/templates/chat/roll-card.hbs",
    "systems/fs2e/templates/chat/contested-card.hbs",
    "systems/fs2e/templates/items/partials/item-header.hbs",
    "systems/fs2e/templates/items/partials/item-description.hbs",
    "systems/fs2e/templates/items/action.hbs",
    "systems/fs2e/templates/items/armor.hbs",
    "systems/fs2e/templates/items/benefice-affliction.hbs",
    "systems/fs2e/templates/items/blessing-curse.hbs",
    "systems/fs2e/templates/items/equipment.hbs",
    "systems/fs2e/templates/items/faction.hbs",
    "systems/fs2e/templates/items/history.hbs",
    "systems/fs2e/templates/items/planet.hbs",
    "systems/fs2e/templates/items/species.hbs",
    "systems/fs2e/templates/items/weapon.hbs"
  ];

  return loadTemplates(templatePaths);
};