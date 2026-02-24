export function buildCharacteristicsView(system = {}) {
  const hasAlwaysTag = (tags) =>
    (Array.isArray(tags) ? tags : []).some((tag) => String(tag ?? "").trim().toLowerCase() === "always");
  const normalizeSpiritTags = (value) => {
    const list = Array.isArray(value) ? value : [];
    const normalized = [...new Set(list
      .map((v) => String(v ?? "").trim().toLowerCase())
      .filter((v) => v === "always" || v === "choice"))];
    if (normalized.includes("always")) return ["Always"];
    if (normalized.includes("choice")) return ["Choice"];
    return [];
  };
  const labelize = (k) =>
    (k ?? "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

  const toEntries = (group, keys = undefined) => {
    if (keys) {
      return keys.map((key) => ({
        key,
        label: labelize(key),
        history: group?.[key]?.history ?? 0,
        base: group?.[key]?.base ?? 0
      }));
    }
    return Object.entries(group ?? {}).map(([key, val]) => ({
      key,
      label: labelize(key),
      history: val?.history ?? 0,
      base: val?.base ?? 0
    }));
  };

  const bodyKeys = ["strength", "dexterity", "endurance"];
  const mindKeys = ["wits", "perception", "tech"];
  const body = toEntries(system.characteristics?.body, bodyKeys);
  const mind = toEntries(system.characteristics?.mind, mindKeys);

  const spirit = system.characteristics?.spirit ?? {};
  const spiritPairs = system.characteristics?.spiritPairs ?? {};
  const speciesSpirit = system.characteristics?.speciesSpirit ?? {};
  const pairDefaults = {
    extrovertIntrovert: "extrovert",
    passionCalm: "passion",
    faithEgo: "faith"
  };
  const pairValues = {
    extrovertIntrovert: spiritPairs.extrovertIntrovert ?? pairDefaults.extrovertIntrovert,
    passionCalm: spiritPairs.passionCalm ?? pairDefaults.passionCalm,
    faithEgo: spiritPairs.faithEgo ?? pairDefaults.faithEgo
  };
  const pairMap = {
    extrovert: "extrovertIntrovert",
    introvert: "extrovertIntrovert",
    passion: "passionCalm",
    calm: "passionCalm",
    faith: "faithEgo",
    ego: "faithEgo"
  };
  const leftKeys = ["extrovert", "passion", "faith"];
  const rightKeys = ["introvert", "calm", "ego"];
  const baseMap = {
    extrovert: pairValues.extrovertIntrovert === "extrovert" ? 3 : 1,
    introvert: pairValues.extrovertIntrovert === "introvert" ? 3 : 1,
    passion: pairValues.passionCalm === "passion" ? 3 : 1,
    calm: pairValues.passionCalm === "calm" ? 3 : 1,
    faith: pairValues.faithEgo === "faith" ? 3 : 1,
    ego: pairValues.faithEgo === "ego" ? 3 : 1
  };
  const spiritLeft = leftKeys.map((key) => {
    const pair = pairMap[key];
    const spiritTags = normalizeSpiritTags(speciesSpirit?.[pair]);
    return {
      key,
      pair,
      checked: pairValues[pair] === key,
      speciesSpirit: spiritTags,
      showRadios: !hasAlwaysTag(spiritTags),
      label: labelize(key),
      base: baseMap[key] ?? 0
    };
  });
  const spiritRight = rightKeys.map((key) => {
    const pair = pairMap[key];
    return {
      key,
      pair,
      checked: pairValues[pair] === key,
      label: labelize(key),
      base: baseMap[key] ?? 0
    };
  });

  return {
    body,
    mind,
    spirit: {
      left: spiritLeft,
      right: spiritRight
    }
  };
}

export function bindSpiritRadios(html, item) {
  html.find("input.stat-radio").on("change", () => {
    const updateData = {};
    const getChecked = (pair) =>
      html.find(`input.stat-radio[name="system.characteristics.spiritPairs.${pair}"]:checked`).val();

    const extro = getChecked("extrovertIntrovert") || "extrovert";
    const passion = getChecked("passionCalm") || "passion";
    const faith = getChecked("faithEgo") || "faith";

    updateData["system.characteristics.spiritPairs.extrovertIntrovert"] = extro;
    updateData["system.characteristics.spiritPairs.passionCalm"] = passion;
    updateData["system.characteristics.spiritPairs.faithEgo"] = faith;

    const baseExtrovert = extro === "extrovert" ? 3 : 1;
    const baseIntrovert = extro === "introvert" ? 3 : 1;
    const basePassion = passion === "passion" ? 3 : 1;
    const baseCalm = passion === "calm" ? 3 : 1;
    const baseFaith = faith === "faith" ? 3 : 1;
    const baseEgo = faith === "ego" ? 3 : 1;

    updateData["system.characteristics.spirit.extrovert.base"] = baseExtrovert;
    updateData["system.characteristics.spirit.introvert.base"] = baseIntrovert;
    updateData["system.characteristics.spirit.passion.base"] = basePassion;
    updateData["system.characteristics.spirit.calm.base"] = baseCalm;
    updateData["system.characteristics.spirit.faith.base"] = baseFaith;
    updateData["system.characteristics.spirit.ego.base"] = baseEgo;

    item.update(updateData);
  });
}

const normalizeSpiritTags = (value) => {
  const list = Array.isArray(value) ? value : [];
  const normalized = [...new Set(list
    .map((v) => String(v ?? "").trim().toLowerCase())
    .filter((v) => v === "always" || v === "choice"))];
  if (normalized.includes("always")) return ["Always"];
  if (normalized.includes("choice")) return ["Choice"];
  return [];
};

const hasAlwaysTag = (tags) =>
  (Array.isArray(tags) ? tags : []).some((tag) => String(tag ?? "").trim().toLowerCase() === "always");

export function bindSpeciesSpiritTags(html, item) {
  const els = html[0]?.querySelectorAll?.("fs2e-tagify-tags.species-spirit-tagify") ?? [];
  for (const el of els) {
    const pair = String(el.getAttribute("data-pair") ?? "").trim();
    if (!pair) continue;

    const setRadiosVisible = (visible) => {
      const row = el.closest(".traits-spirit-row");
      if (!row) return;
      const radios = row.querySelector(".traits-radios");
      if (!radios) return;
      radios.classList.toggle("is-hidden", !visible);
    };

    const initial = normalizeSpiritTags(item.system?.characteristics?.speciesSpirit?.[pair]);
    el.whitelist = ["Always", "Choice"];
    el.tags = initial;
    setRadiosVisible(!hasAlwaysTag(initial));

    let saving = false;
    el.addEventListener("fs2e-tags-change", async (event) => {
      if (saving) return;
      saving = true;
      try {
        const tags = normalizeSpiritTags(event.detail?.tags);
        el.tags = tags;
        setRadiosVisible(!hasAlwaysTag(tags));
        await item.update({ [`system.characteristics.speciesSpirit.${pair}`]: tags });
      } finally {
        saving = false;
      }
    });
  }
}
