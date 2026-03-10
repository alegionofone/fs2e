const MODULE_ID = "fs2e";
const LOCK_SETTING_KEY = "sheetLockState";
const LOCK_FLAG_KEY = "sheetLocked";
const LOCK_BUTTON_CLASS = "fs2e-sheet-lock-toggle";
const FORCED_LOCK_APP_KEY = "_fs2eForceLockedFromActor";
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

export const setSheetForcedLockedFromActor = (app, locked = true) => {
  if (!app) return app;
  app[FORCED_LOCK_APP_KEY] = !!locked;
  return app;
};

export const isSheetForcedLockedFromActor = (app) => app?.[FORCED_LOCK_APP_KEY] === true;

export const getSheetLockState = (document, { app = null } = {}) => {
  const uuid = getDocumentUuid(document);
  if (!uuid) return { locked: false, supported: false, uuid: "" };
  const supported = supportsSheetLock(document);
  if (!supported) return { locked: false, supported: false, uuid };
  if (isSheetForcedLockedFromActor(app)) {
    return {
      locked: true,
      supported,
      uuid,
      forced: true
    };
  }
  const flagValue = document?.getFlag?.(MODULE_ID, LOCK_FLAG_KEY);
  if (typeof flagValue === "boolean") {
    return {
      locked: flagValue,
      supported,
      uuid,
      forced: false
    };
  }
  const map = readLockMap();
  return {
    locked: map[uuid] === true,
    supported,
    uuid,
    forced: false
  };
};

const setSheetLockState = async (document, locked) => {
  const uuid = getDocumentUuid(document);
  if (!uuid || !supportsSheetLock(document)) return;
  await document.setFlag(MODULE_ID, LOCK_FLAG_KEY, !!locked);
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

const ensureLockButton = (app, state) => {
  const appRoot = app?.element?.[0];
  if (!appRoot) return;
  const header = appRoot.querySelector(".window-header");
  if (!header) return;

  header.querySelector(`.${LOCK_BUTTON_CLASS}`)?.remove();
  if (state?.forced) return;

  const button = document.createElement("a");
  const locked = state?.locked === true;
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
  const state = getSheetLockState(document, { app });
  ensureLockButton(app, state);
  applyLockStateToSheet(app, html, state.locked);
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
