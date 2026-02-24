import "./tagify-tags-element.mjs";

const normalizeTags = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((v) => v.trim()).filter(Boolean);
  return [];
};

const normalizeAllowed = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v ?? "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
};

const enforceAllowed = (tags, allowed) => {
  const canonical = new Map(allowed.map((tag) => [tag.toLowerCase(), tag]));
  return [...new Set(tags.map((t) => canonical.get(String(t ?? "").trim().toLowerCase())).filter(Boolean))];
};

export const bindTagsInput = (html, item, { allowedTags = [] } = {}) => {
  const el = html[0]?.querySelector?.("fs2e-tagify-tags.fs2e-tags");
  if (!el) return;

  const allowed = normalizeAllowed(allowedTags);
  const initial = enforceAllowed(normalizeTags(item.getFlag("fs2e", "tags")), allowed);

  el.whitelist = allowed;
  el.tags = initial;

  let saving = false;
  el.addEventListener("fs2e-tags-change", async (event) => {
    if (saving) return;
    saving = true;
    try {
      const tags = enforceAllowed(normalizeTags(event.detail?.tags), allowed);
      await item.setFlag("fs2e", "tags", tags);
    } finally {
      saving = false;
    }
  });
};
