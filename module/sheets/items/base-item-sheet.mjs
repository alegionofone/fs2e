import Tagify from "../../ui/tagify/index.mjs";
import { getTagMenuForItemType } from "../../ui/tagify/tag-menus.mjs";
import { getSheetLockState } from "../../ui/sheet-lock-mode.mjs";

export class FS2EItemSheet extends ItemSheet {
  _headerTagify = null;
  _sheetResizeObserver = null;
  _sheetMutationObserver = null;
  _heightSyncScheduled = false;

  _prepareTagifyInput(input) {
    if (!input) return;
    input.removeAttribute("disabled");
    input.removeAttribute("readonly");
  }

  _setTagifyInteractive(tagify, interactive) {
    if (!tagify) return;

    if (typeof tagify.setReadonly === "function") tagify.setReadonly(!interactive);
    else if (typeof tagify.setDisabled === "function") tagify.setDisabled(!interactive);
    else {
      if (tagify.settings) {
        tagify.settings.readonly = !interactive;
        tagify.settings.disabled = false;
      }
      if (typeof tagify.setContentEditable === "function") tagify.setContentEditable(!!interactive);
    }
  }

  _bindTagifyDropdownInteractions(tagify) {
    if (!tagify) return;
    this._setTagifyInteractive(tagify, true);

    const showDropdown = () => {
      const currentValue = String(tagify.input?.raw?.call(tagify) ?? "").trim();
      tagify.dropdown.show(currentValue);
    };

    const deferredShow = () => window.setTimeout(showDropdown, 0);

    tagify.DOM.scope?.addEventListener("mousedown", deferredShow);
    tagify.DOM.scope?.addEventListener("click", deferredShow);
    tagify.DOM.scope?.addEventListener("focusin", deferredShow);
    tagify.DOM.input?.addEventListener("focus", deferredShow);
    tagify.DOM.input?.addEventListener("click", deferredShow);
    tagify.DOM.input?.addEventListener("input", showDropdown);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["fs2e", "sheet", "item"],
      width: 550,
      height: "auto",
      resizable: false,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "description"
        }
      ]
    });
  }

  get template() {
    const itemType = this.item.type.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    return `systems/fs2e/templates/items/${itemType}.hbs`;
  }

  _getStoredTags(systemData = this.item.system) {
    if (Array.isArray(systemData?.tags)) return systemData.tags;
    if (Array.isArray(systemData?.data?.tags)) return systemData.data.tags;
    if (typeof systemData?.faction === "string" && systemData.faction.trim()) return [systemData.faction.trim()];
    return [];
  }

  _normalizeTags(rawValues) {
    const values = typeof rawValues === "string"
      ? rawValues.split(",")
      : Array.isArray(rawValues)
        ? rawValues
        : [];

    return [...new Set(values.map((tag) => String(tag).trim()).filter(Boolean))];
  }

  async _pickHeaderImage() {
    const current = String(this.item?.img ?? "").trim();
    const fp = new FilePicker({
      type: "image",
      current,
      callback: async (path) => {
        const next = String(path ?? "").trim();
        if (!next || next === current) return;
        await this.item.update({ img: next });
      }
    });

    return fp.browse();
  }

  _measureDesiredHeight() {
    const appEl = this.element?.[0];
    if (!appEl) return null;

    const contentEl = appEl.querySelector(".window-content");
    const sheetEl = appEl.querySelector(".fs2e-item-sheet");
    if (!contentEl || !sheetEl) return null;

    const chromeHeight = Math.max(0, appEl.offsetHeight - contentEl.clientHeight);
    const activeTab = sheetEl.querySelector(".sheet-body .tab.active") ?? sheetEl.querySelector(".sheet-body .tab");
    let deepestTabContent = 0;

    if (activeTab) {
      const sheetTop = sheetEl.getBoundingClientRect().top;
      let maxBottom = activeTab.getBoundingClientRect().bottom;
      const nodes = [activeTab, ...activeTab.querySelectorAll("*")];

      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        maxBottom = Math.max(maxBottom, rect.bottom);
      }

      deepestTabContent = Math.max(0, Math.ceil(maxBottom - sheetTop));
    }

    const contentHeight = Math.max(contentEl.scrollHeight, sheetEl.scrollHeight, deepestTabContent);
    return Math.ceil(contentHeight + chromeHeight + 12);
  }

  _syncHeightNow() {
    const appEl = this.element?.[0];
    if (!appEl) return;

    const desiredHeight = this._measureDesiredHeight();
    if (!desiredHeight) return;

    const currentHeight = Math.round(appEl.getBoundingClientRect().height);
    if (Math.abs(desiredHeight - currentHeight) > 2) {
      this.setPosition({ height: desiredHeight });
    }
  }

  _scheduleHeightSync() {
    if (this._heightSyncScheduled) return;
    this._heightSyncScheduled = true;
    window.requestAnimationFrame(() => {
      this._heightSyncScheduled = false;
      this._syncHeightNow();
    });
  }

  _scheduleHeightSyncBurst() {
    this._scheduleHeightSync();
    window.setTimeout(() => this._scheduleHeightSync(), 60);
    window.setTimeout(() => this._scheduleHeightSync(), 180);
    window.setTimeout(() => this._scheduleHeightSync(), 350);
    window.setTimeout(() => this._scheduleHeightSync(), 700);
  }

  _disconnectHeightObservers() {
    this._sheetResizeObserver?.disconnect();
    this._sheetResizeObserver = null;
    this._sheetMutationObserver?.disconnect();
    this._sheetMutationObserver = null;
  }

  _setupHeightObservers(root) {
    const targets = [
      root.querySelector(".sheet-body"),
      ...root.querySelectorAll(".editor, .editor-content, .ProseMirror")
    ].filter(Boolean);

    if (targets.length && typeof ResizeObserver !== "undefined") {
      this._sheetResizeObserver = new ResizeObserver(() => this._scheduleHeightSyncBurst());
      for (const target of targets) this._sheetResizeObserver.observe(target);
    }

    if (typeof MutationObserver !== "undefined") {
      this._sheetMutationObserver = new MutationObserver(() => this._scheduleHeightSyncBurst());
      this._sheetMutationObserver.observe(root, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  }

  async getData(options = {}) {
    const data = await super.getData(options);
    data.system = foundry.utils.deepClone(this.item.system ?? {});
    if (typeof data.system.description === "string") {
      data.system.description = { value: data.system.description };
    } else if (!data.system.description || typeof data.system.description !== "object") {
      data.system.description = { value: "" };
    } else if (typeof data.system.description.value !== "string") {
      data.system.description.value = "";
    }
    data.tagMenu = getTagMenuForItemType(this.item.type);
    data.itemTagsCsv = this._normalizeTags(this._getStoredTags(data.system)).join(", ");
    data.view = data.view ?? {};
    data.view.sheetLock = getSheetLockState(this.item);
    data.view.descriptionEditable = Boolean(data.editable) && !data.view.sheetLock.locked;
    data.view.enrichedDescription = await TextEditor.enrichHTML(data.system.description.value ?? "", {
      async: true,
      secrets: this.item.isOwner,
      relativeTo: this.item
    });
    return data;
  }

  async _updateObject(event, formData) {
    const hasTags = Object.prototype.hasOwnProperty.call(formData, "system.tags");
    const tags = hasTags ? this._normalizeTags(formData["system.tags"]) : this._getStoredTags();
    if (hasTags) {
      formData["system.tags"] = tags;
    }

    // ProseMirror can occasionally submit without the description field on close;
    // avoid clobbering persisted text when that happens.
    const hasDescriptionValue = Object.prototype.hasOwnProperty.call(formData, "system.description.value");
    if (hasDescriptionValue) {
      const descriptionValue = String(formData["system.description.value"] ?? "");
      formData["system.description.value"] = descriptionValue;
    }

    if (this.item.type === "faction") {
      formData["system.faction"] = tags[0] ?? "";
    }

    return super._updateObject(event, formData);
  }

  activateListeners(html) {
    super.activateListeners(html);
    this._disconnectHeightObservers();
    this._scheduleHeightSyncBurst();
    html.on("click", ".editor-edit", () => this._scheduleHeightSyncBurst());
    html.on("click", ".sheet-tabs .item", () => this._scheduleHeightSyncBurst());
    html.on("input keyup paste", ".editor-content", () => this._scheduleHeightSyncBurst());

    if (this.isEditable && !getSheetLockState(this.item).locked) {
      html.on("click", ".profile-img[data-edit='img']", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await this._pickHeaderImage();
      });
    }

    const root = html[0];
    this._setupHeightObservers(root);

    const input = root.querySelector(".fs2e-tag-menu");
    if (input) {
      this._headerTagify?.destroy();
      const whitelist = getTagMenuForItemType(this.item.type);
      const current = this._normalizeTags(this._getStoredTags());
      const sheetLocked = getSheetLockState(this.item).locked === true;
      this._prepareTagifyInput(input);

      this._headerTagify = new Tagify(input, {
        whitelist,
        enforceWhitelist: true,
        duplicates: false,
        dropdown: {
          enabled: 0,
          closeOnSelect: false,
          maxItems: whitelist.length
        },
        originalInputValueFormat: (values) => values.map((v) => v.value).join(",")
      });

      if (current.length) this._headerTagify.addTags(current, true, true);
      if (sheetLocked) this._setTagifyInteractive(this._headerTagify, false);
      else this._bindTagifyDropdownInteractions(this._headerTagify);
      let syncingHeaderTags = false;
      const commitHeaderTags = async () => {
        this._scheduleHeightSyncBurst();
        if (syncingHeaderTags) return;
        syncingHeaderTags = true;

        try {
          const nextTags = this._normalizeTags(
            (this._headerTagify?.value ?? []).map((entry) => String(entry?.value ?? "").trim())
          );
          const renderedTags = (this._headerTagify?.value ?? [])
            .map((entry) => String(entry?.value ?? "").trim())
            .filter(Boolean);

          if (nextTags.length !== renderedTags.length
            || nextTags.some((tag, index) => tag !== renderedTags[index])) {
            this._headerTagify?.removeAllTags();
            if (nextTags.length) this._headerTagify?.addTags(nextTags, true, true);
          }

          const update = { "system.tags": nextTags };
          if (this.item.type === "faction") update["system.faction"] = nextTags[0] ?? "";
          await this.item.update(update);
        } finally {
          syncingHeaderTags = false;
        }
      };

      this._headerTagify.on("change", () => this._scheduleHeightSyncBurst());
      this._headerTagify.on("add", commitHeaderTags);
      this._headerTagify.on("remove", commitHeaderTags);
    }
  }

  async close(options = {}) {
    this._headerTagify?.destroy();
    this._headerTagify = null;
    this._disconnectHeightObservers();
    this._heightSyncScheduled = false;
    return super.close(options);
  }
}
