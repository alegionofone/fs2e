const normalizeList = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((v) => String(v ?? "").trim()).filter(Boolean) : [];
    } catch {
      return value.split(",").map((v) => v.trim()).filter(Boolean);
    }
  }
  return [];
};

const unique = (list) => [...new Set(list)];

class FS2ETagifyTagsElement extends HTMLElement {
  #ready = false;
  #active = false;
  #tags = [];
  #whitelist = [];
  #disableMenu = false;
  #singleTag = false;
  #placeholder = "Tags";
  #root = null;
  #chips = null;
  #input = null;
  #menu = null;

  connectedCallback() {
    if (this.#ready) return;
    this.#ready = true;

    this.#whitelist = unique(normalizeList(this.getAttribute("data-whitelist")));
    this.#tags = unique(normalizeList(this.getAttribute("data-tags"))).filter((t) =>
      this.#whitelist.some((w) => w.toLowerCase() === t.toLowerCase())
    );
    this.#disableMenu = String(this.getAttribute("data-no-menu") ?? "").toLowerCase() === "true";
    this.#singleTag = String(this.getAttribute("data-single-tag") ?? "").toLowerCase() === "true";
    this.#placeholder = String(this.getAttribute("data-placeholder") ?? "Tags");
    if (this.#singleTag && this.#tags.length > 1) this.#tags = [this.#tags[0]];

    this.#root = document.createElement("div");
    this.#root.className = "fs2e-tagify";

    this.#chips = document.createElement("div");
    this.#chips.className = "fs2e-tagify__chips";

    this.#input = document.createElement("input");
    this.#input.type = "text";
    this.#input.className = "fs2e-tagify__input";
    this.#input.placeholder = this.#placeholder;

    this.#menu = document.createElement("div");
    this.#menu.className = "fs2e-tagify__menu";
    this.#menu.hidden = true;

    this.#root.appendChild(this.#chips);
    this.#root.appendChild(this.#input);
    this.#root.appendChild(this.#menu);
    this.appendChild(this.#root);

    this.#input.addEventListener("input", () => this.#renderMenu());
    this.#input.addEventListener("keydown", (event) => this.#onKeydown(event));
    this.#input.addEventListener("click", () => {
      this.#active = true;
      this.#renderMenu();
    });
    this.#input.addEventListener("blur", () => {
      setTimeout(() => {
        this.#active = false;
        this.#menu.hidden = true;
      }, 120);
    });
    this.#input.addEventListener("focus", () => {
      this.#active = true;
      this.#renderMenu();
    });

    this.#render();
  }

  set whitelist(value) {
    this.#whitelist = unique(normalizeList(value))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    this.#tags = this.#tags.filter((t) => this.#whitelist.some((w) => w.toLowerCase() === t.toLowerCase()));
    if (this.#singleTag && this.#tags.length > 1) this.#tags = [this.#tags[0]];
    this.#render();
  }

  set tags(value) {
    const canonical = new Map(this.#whitelist.map((tag) => [tag.toLowerCase(), tag]));
    this.#tags = unique(normalizeList(value))
      .map((tag) => canonical.get(tag.toLowerCase()))
      .filter(Boolean);
    if (this.#singleTag && this.#tags.length > 1) this.#tags = [this.#tags[0]];
    this.#render();
  }

  get tags() {
    return [...this.#tags];
  }

  #onKeydown(event) {
    if (!["Enter", "Tab", ","].includes(event.key)) {
      if (event.key === "Backspace" && !this.#input.value.trim() && this.#tags.length) {
        this.#tags.pop();
        this.#emit();
        this.#render();
      }
      return;
    }

    event.preventDefault();
    const options = this.#filteredOptions();
    const token = this.#input.value.trim().toLowerCase();
    const exact = this.#whitelist.find((t) => t.toLowerCase() === token);
    const choice = this.#disableMenu ? exact ?? null : exact ?? options[0] ?? null;
    if (!choice) return;
    if (this.#singleTag) {
      this.#tags = [choice];
    } else if (!this.#tags.includes(choice)) {
      this.#tags.push(choice);
    }
    this.#input.value = "";
    this.#emit();
    this.#render();
  }

  #filteredOptions() {
    const token = this.#input.value.trim().toLowerCase();
    const selected = new Set(this.#tags.map((t) => t.toLowerCase()));
    return this.#whitelist.filter((tag) => !selected.has(tag.toLowerCase()) && (!token || tag.toLowerCase().includes(token)));
  }

  #removeTag(tag) {
    this.#tags = this.#tags.filter((t) => t !== tag);
    this.#emit();
    this.#render();
  }

  #renderMenu() {
    if (!this.#menu) return;
    if (this.#disableMenu) {
      this.#menu.hidden = true;
      return;
    }
    if (!this.#active) {
      this.#menu.hidden = true;
      return;
    }
    const options = this.#filteredOptions();
    this.#menu.innerHTML = "";
    if (!options.length) {
      this.#menu.hidden = true;
      return;
    }
    for (const option of options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fs2e-tagify__option";
      btn.textContent = option;
      btn.addEventListener("mousedown", (ev) => ev.preventDefault());
      btn.addEventListener("click", () => {
        if (this.#singleTag) {
          this.#tags = [option];
        } else if (!this.#tags.includes(option)) {
          this.#tags.push(option);
        }
        this.#input.value = "";
        this.#emit();
        this.#render();
        this.#input.focus();
      });
      this.#menu.appendChild(btn);
    }
    this.#menu.hidden = false;
  }

  #renderChips() {
    if (!this.#chips) return;
    this.#chips.innerHTML = "";
    for (const tag of this.#tags) {
      const chip = document.createElement("span");
      chip.className = "fs2e-tagify__chip";

      const text = document.createElement("span");
      text.textContent = tag;
      chip.appendChild(text);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "fs2e-tagify__chip-remove";
      remove.textContent = "x";
      remove.addEventListener("click", () => this.#removeTag(tag));
      chip.appendChild(remove);

      this.#chips.appendChild(chip);
    }
  }

  #render() {
    if (this.#input) {
      const hideInput = this.#singleTag && this.#tags.length > 0;
      this.#input.style.display = hideInput ? "none" : "";
      this.#input.placeholder = hideInput ? "" : this.#placeholder;
      if (hideInput) this.#input.value = "";
    }
    this.#renderChips();
    this.#renderMenu();
  }

  #emit() {
    this.dispatchEvent(
      new CustomEvent("fs2e-tags-change", {
        bubbles: true,
        detail: { tags: [...this.#tags] }
      })
    );
  }
}

if (!customElements.get("fs2e-tagify-tags")) {
  customElements.define("fs2e-tagify-tags", FS2ETagifyTagsElement);
}
