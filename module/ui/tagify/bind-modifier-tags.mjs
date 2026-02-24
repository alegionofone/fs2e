import "./modifier-tags-element.mjs";

const normalizeTags = (value) => {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((entry) => ({
      key: String(entry?.key ?? "").trim(),
      label: String(entry?.label ?? "").trim(),
      value: Number(entry?.value ?? 0)
    }))
    .filter((entry) => entry.key);
};

export const bindModifierTagsInput = (html, item, { selector, options = [], path }) => {
  const el = html[0]?.querySelector?.(selector);
  if (!el || !path) return;

  el.options = options;
  el.tags = normalizeTags(foundry.utils.getProperty(item.system, path));

  let saving = false;
  el.addEventListener("fs2e-modtags-change", async (event) => {
    if (saving) return;
    saving = true;
    try {
      const tags = normalizeTags(event.detail?.tags);
      el.tags = tags;
      await item.update({ [`system.${path}`]: tags });
    } finally {
      saving = false;
    }
  });
};

