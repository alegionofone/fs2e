const MODULE_ID = "fs2e";
const LOCK_SETTING_KEY = "sheetLockState";
const LOCK_BUTTON_CLASS = "fs2e-sheet-lock-toggle";
const ITEM_TAG_BLOCK_EVENTS = ["click", "mousedown", "keydown"];
const ITEM_TAG_BLOCK_SELECTOR = [
  ".fs2e-tag-chip-remove",
  ".history-chip-remove",
  ".tagify__tag__removeBtn",
  ".fs2e-tag-input",
  ".history-language-input",
  ".tagify__input",
  ".tagify"
].join(", ");
const ITEM_TAG_BLOCK_HANDLERS = new WeakMap();

const getSheetDocument = (app) => app?.actor ?? app?.item ?? app?.object ?? null;

const supportsSheetLock = (document) => {
  if (!document) return false;
  if (document.documentName === "Actor") return true;
  if (document.documentName === "Item") return true;
  return false;
};

const readLockMap = () => {
  const raw = game.settings.get(MODULE_ID, LOCK_SETTING_KEY);
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
};

const writeLockMap = async (value) => {
  const map = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  await game.settings.set(MODULE_ID, LOCK_SETTING_KEY, map);
};

const getDocumentUuid = (document) => String(document?.uuid ?? "").trim();

export const getSheetLockState = (document) => {
  const uuid = getDocumentUuid(document);
  if (!uuid) return { locked: false, supported: false, uuid: "" };
  const supported = supportsSheetLock(document);
  if (!supported) return { locked: false, supported: false, uuid };
  const map = readLockMap();
  return {
    locked: map[uuid] === true,
    supported,
    uuid
  };
};

const setSheetLockState = async (document, locked) => {
  const uuid = getDocumentUuid(document);
  if (!uuid || !supportsSheetLock(document)) return;
  const map = readLockMap();
  if (locked) map[uuid] = true;
  else delete map[uuid];
  await writeLockMap(map);
};

const applyLockStateToSheet = (app, html, locked) => {
  const root = html?.[0];
  if (!root) return;

  root.classList.toggle("fs2e-sheet-locked", !!locked);
  root.dataset.sheetLocked = locked ? "1" : "0";

  const appRoot = app?.element?.[0];
  if (!appRoot) return;
  appRoot.classList.toggle("fs2e-sheet-locked", !!locked);
  appRoot.dataset.sheetLocked = locked ? "1" : "0";
};

const setItemTagLockInterceptors = (root, locked) => {
  if (!root) return;

  const existingHandler = ITEM_TAG_BLOCK_HANDLERS.get(root);

  if (!locked) {
    if (!existingHandler) return;
    for (const eventName of ITEM_TAG_BLOCK_EVENTS) {
      root.removeEventListener(eventName, existingHandler, true);
    }
    ITEM_TAG_BLOCK_HANDLERS.delete(root);
    return;
  }

  if (existingHandler) return;

  const handler = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const blockedNode = target.closest(ITEM_TAG_BLOCK_SELECTOR);
    if (!blockedNode || !root.contains(blockedNode)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  for (const eventName of ITEM_TAG_BLOCK_EVENTS) {
    root.addEventListener(eventName, handler, true);
  }
  ITEM_TAG_BLOCK_HANDLERS.set(root, handler);
};

const applyItemTagLockState = (html, locked) => {
  const root = html?.[0];
  if (!root) return;

  setItemTagLockInterceptors(root, !!locked);

  for (const node of root.querySelectorAll(".tagify__tag__removeBtn, .fs2e-tag-chip-remove, .history-chip-remove")) {
    node.hidden = !!locked;
  }
};

const ensureLockButton = (app, locked) => {
  const appRoot = app?.element?.[0];
  if (!appRoot) return;
  const header = appRoot.querySelector(".window-header");
  if (!header) return;

  header.querySelector(`.${LOCK_BUTTON_CLASS}`)?.remove();

  const button = document.createElement("a");
  button.className = `header-control ${LOCK_BUTTON_CLASS} ${locked ? "is-locked" : "is-unlocked"}`;
  button.title = locked ? "Unlock Sheet" : "Lock Sheet";
  button.setAttribute("aria-label", button.title);
  button.dataset.locked = locked ? "1" : "0";
  button.innerHTML = `<i class="fa-solid fa-wrench"></i>`;

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const document = getSheetDocument(app);
    if (!supportsSheetLock(document)) return;
    await setSheetLockState(document, !locked);
    app.render(true);
  });

  // Keep the lock control on the far-left side of the sheet header.
  header.prepend(button);
};

const onRenderSheet = (app, html) => {
  const document = getSheetDocument(app);
  if (!supportsSheetLock(document)) return;
  const state = getSheetLockState(document);
  ensureLockButton(app, state.locked);
  applyLockStateToSheet(app, html, state.locked);
  if (document?.documentName === "Item") {
    applyItemTagLockState(html, state.locked);
  }
};

export const registerSheetLockMode = () => {
  game.settings.register(MODULE_ID, LOCK_SETTING_KEY, {
    name: "Sheet Lock State",
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });

  Hooks.on("renderActorSheet", onRenderSheet);
  Hooks.on("renderItemSheet", onRenderSheet);
};
