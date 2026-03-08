import { FS2EActionSheet } from "../sheets/items/action.mjs";
import { FS2EArmorSheet } from "../sheets/items/armor.mjs";
import { FS2ESpeciesSheet } from "../sheets/items/species.mjs";
import { FS2EHistorySheet } from "../sheets/items/history.mjs";
import { FS2EBlessingCurseSheet } from "../sheets/items/blessing-curse.mjs";
import { FS2EBeneficeAfflictionSheet } from "../sheets/items/benefice-affliction.mjs";
import { FS2EEquipmentSheet } from "../sheets/items/equipment.mjs";
import { FS2EFactionSheet } from "../sheets/items/faction.mjs";
import { FS2EPlanetSheet } from "../sheets/items/planet.mjs";
import { FS2EWeaponSheet } from "../sheets/items/weapon.mjs";

export const registerItemSheets = () => {
  Items.registerSheet("fs2e", FS2EActionSheet, {
    types: ["action"],
    makeDefault: true,
    label: "FS2E Action Sheet"
  });

  Items.registerSheet("fs2e", FS2EArmorSheet, {
    types: ["armor"],
    makeDefault: true,
    label: "FS2E Armor Sheet"
  });

  Items.registerSheet("fs2e", FS2ESpeciesSheet, {
    types: ["species"],
    makeDefault: true,
    label: "FS2E Species Sheet"
  });

  Items.registerSheet("fs2e", FS2EHistorySheet, {
    types: ["history"],
    makeDefault: true,
    label: "FS2E History Sheet"
  });

  Items.registerSheet("fs2e", FS2EBlessingCurseSheet, {
    types: ["blessingCurse"],
    makeDefault: true,
    label: "FS2E Blessing/Curse Sheet"
  });

  Items.registerSheet("fs2e", FS2EBeneficeAfflictionSheet, {
    types: ["beneficeAffliction"],
    makeDefault: true,
    label: "FS2E Benefice/Affliction Sheet"
  });

  Items.registerSheet("fs2e", FS2EEquipmentSheet, {
    types: ["equipment"],
    makeDefault: true,
    label: "FS2E Equipment Sheet"
  });

  Items.registerSheet("fs2e", FS2EFactionSheet, {
    types: ["faction"],
    makeDefault: true,
    label: "FS2E Faction Sheet"
  });

  Items.registerSheet("fs2e", FS2EPlanetSheet, {
    types: ["planet"],
    makeDefault: true,
    label: "FS2E Planet Sheet"
  });

  Items.registerSheet("fs2e", FS2EWeaponSheet, {
    types: ["weapon"],
    makeDefault: true,
    label: "FS2E Weapon Sheet"
  });
};
