import {
  SPIRIT_LABELS,
  SPIRIT_PAIRS,
  SPIRIT_PAIR_BY_KEY,
  buildSpiritSelectionByPair,
  normalizeAlwaysPrimary
} from "../../global/spirit.mjs";

export const promptSpeciesSpiritChoice = async ({ alwaysPrimary = [] } = {}) => {
  const normalizedAlwaysPrimary = normalizeAlwaysPrimary(alwaysPrimary);
  const defaultsByPair = buildSpiritSelectionByPair(normalizedAlwaysPrimary);
  const lockedByPair = new Map();

  for (const key of normalizedAlwaysPrimary) {
    const pairKey = SPIRIT_PAIR_BY_KEY[key];
    if (!pairKey || lockedByPair.has(pairKey)) continue;
    lockedByPair.set(pairKey, key);
  }

  const rows = SPIRIT_PAIRS
    .filter((pair) => !lockedByPair.has(pair.key))
    .map((pair) => {
    const selected = defaultsByPair[pair.key] === pair.right ? pair.right : pair.left;
    return {
      key: pair.key,
      radioName: `fs2e-species-spirit-${pair.key}-${Math.random().toString(36).slice(2)}`,
      leftValue: pair.left,
      leftLabel: pair.leftLabel,
      rightValue: pair.right,
      rightLabel: pair.rightLabel,
      leftChecked: selected !== pair.right,
      rightChecked: selected === pair.right
    };
    });

  if (!rows.length) {
    return normalizedAlwaysPrimary;
  }

  const alwaysPrimaryLabels = SPIRIT_PAIRS
    .map((pair) => lockedByPair.get(pair.key))
    .filter(Boolean)
    .map((key) => SPIRIT_LABELS[key] ?? "")
    .filter(Boolean);

  const content = await renderTemplate("systems/fs2e/templates/dialogs/species-spirit-choice.hbs", {
    rows,
    alwaysPrimaryLabels
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
      title: "Spirit Assignment",
      content,
      buttons: {},
      render: (html) => {
        const root = html?.[0];
        if (!root) return;

        const readSelected = () => {
          const selected = [...normalizedAlwaysPrimary];

          for (const row of rows) {
            const raw = String(root.querySelector(`input[name="${row.radioName}"]:checked`)?.value ?? "")
              .trim()
              .toLowerCase();
            const key = raw === row.rightValue ? row.rightValue : row.leftValue;
            selected.push(key);
          }

          return normalizeAlwaysPrimary(selected);
        };

        root.querySelector('[data-action="apply"]')?.addEventListener("click", (event) => {
          event.preventDefault();
          finish(readSelected());
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
      classes: ["fs2e", "dialog", "chargen-choice"],
      width: 430,
      height: "auto",
      resizable: true
    });

    dialog.render(true);
  });
};
