export const preloadHandlebarsTemplates = async () => {
  const templatePaths = [
    "systems/fs2e/templates/actor/character.hbs",
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