const normalizeOptions = (value) => {
  const list = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const entry of list) {
    const key = String(entry?.key ?? "").trim();
    const label = String(entry?.label ?? key).trim();
    if (!key || !label) continue;
    const token = key.toLowerCase();
    if (seen.has(token)) continue;
    seen.add(token);
    out.push({ key, label });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
};

const normalizeTags = (value, options = []) => {
  const list = Array.isArray(value) ? value : [];
  const optionByKey = new Map(options.map((o) => [o.key.toLowerCase(), o]));
  const out = [];
  const seen = new Set();
  for (const entry of list) {
    const rawKey = String(entry?.key ?? "").trim();
    if (!rawKey) continue;
    const option = optionByKey.get(rawKey.toLowerCase());
    const key = option?.key ?? rawKey;
    const label = String(entry?.label ?? option?.label ?? key).trim();
    const valueNum = Number(entry?.value ?? 0);
    const token = key.toLowerCase();
    if (seen.has(token)) continue;
    seen.add(token);
    out.push({ key, label, value: Number.isFinite(valueNum) ? valueNum : 0 });
  }
  return out;
};

class FS2EModifierTagsElement extends HTMLElement {
  #ready = false;
  #options = [];
  #tags = [];
  #root = null;
  #chips = null;
  #controls = null;
  #select = null;
  #input = null;
  #addButton = null;

  connectedCallback() {
    if (this.#ready) return;
    this.#ready = true;

    this.#root = document.createElement("div");
    this.#root.className = "fs2e-modtags";

    this.#chips = document.createElement("div");
    this.#chips.className = "fs2e-modtags__chips";

    this.#controls = document.createElement("div");
    this.#controls.className = "fs2e-modtags__controls";

    this.#select = document.createElement("select");
    this.#select.className = "fs2e-modtags__select";
    this.#controls.appendChild(this.#select);

    this.#input = document.createElement("input");
    this.#input.type = "number";
    this.#input.className = "fs2e-modtags__value";
    this.#input.value = "1";
    this.#controls.appendChild(this.#input);

    this.#addButton = document.createElement("button");
    this.#addButton.type = "button";
    this.#addButton.className = "fs2e-modtags__add";
    this.#addButton.textContent = "+";
    this.#controls.appendChild(this.#addButton);

    this.#root.appendChild(this.#chips);
    this.#root.appendChild(this.#controls);
    this.appendChild(this.#root);

    this.#addButton.addEventListener("click", () => this.#addTag());
    this.#render();
  }

  set options(value) {
    this.#options = normalizeOptions(value);
    this.#tags = normalizeTags(this.#tags, this.#options);
    this.#render();
  }

  set tags(value) {
    this.#tags = normalizeTags(value, this.#options);
    this.#render();
  }

  get tags() {
    return this.#tags.map((t) => ({ ...t }));
  }

  #addTag() {
    const key = String(this.#select?.value ?? "").trim();
    if (!key) return;
    const value = Number(this.#input?.value ?? 0);
    const option = this.#options.find((o) => o.key === key);
    if (!option) return;

    const existing = this.#tags.find((t) => t.key.toLowerCase() === key.toLowerCase());
    if (existing) {
      existing.value = Number.isFinite(value) ? value : 0;
    } else {
      this.#tags.push({
        key: option.key,
        label: option.label,
        value: Number.isFinite(value) ? value : 0
      });
    }
    if (this.#input) this.#input.value = "1";
    this.#emit();
    this.#render();
  }

  #removeTag(key) {
    this.#tags = this.#tags.filter((t) => t.key.toLowerCase() !== String(key ?? "").toLowerCase());
    this.#emit();
    this.#render();
  }

  #updateTagValue(key, value) {
    const tag = this.#tags.find((t) => t.key.toLowerCase() === String(key ?? "").toLowerCase());
    if (!tag) return;
    const num = Number(value ?? 0);
    tag.value = Number.isFinite(num) ? num : 0;
    this.#emit();
  }

  #renderSelect() {
    if (!this.#select) return;
    this.#select.innerHTML = "";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Select";
    this.#select.appendChild(blank);
    for (const option of this.#options) {
      const el = document.createElement("option");
      el.value = option.key;
      el.textContent = option.label;
      this.#select.appendChild(el);
    }
  }

  #renderChips() {
    if (!this.#chips) return;
    this.#chips.innerHTML = "";
    for (const tag of this.#tags) {
      const chip = document.createElement("span");
      chip.className = "fs2e-modtags__chip";

      const label = document.createElement("span");
      label.className = "fs2e-modtags__chip-label";
      label.textContent = tag.label;
      chip.appendChild(label);

      const valueWrap = document.createElement("span");
      valueWrap.className = "fs2e-modtags__chip-value-wrap";

      const plus = document.createElement("span");
      plus.className = "fs2e-modtags__chip-plus";
      plus.textContent = "+";
      valueWrap.appendChild(plus);

      const value = document.createElement("input");
      value.type = "number";
      value.className = "fs2e-modtags__chip-value";
      value.value = String(tag.value ?? 0);
      value.addEventListener("change", () => this.#updateTagValue(tag.key, value.value));
      valueWrap.appendChild(value);
      chip.appendChild(valueWrap);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "fs2e-modtags__chip-remove";
      remove.textContent = "x";
      remove.addEventListener("click", () => this.#removeTag(tag.key));
      chip.appendChild(remove);

      this.#chips.appendChild(chip);
    }
  }

  #render() {
    this.#renderSelect();
    this.#renderChips();
  }

  #emit() {
    this.dispatchEvent(
      new CustomEvent("fs2e-modtags-change", {
        bubbles: true,
        detail: { tags: this.tags }
      })
    );
  }
}

if (!customElements.get("fs2e-mod-tags")) {
  customElements.define("fs2e-mod-tags", FS2EModifierTagsElement);
}
