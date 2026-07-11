"use strict";

const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL, fileURLToPath } = require("url");

const PRESETS = [
  { id: "line-dog", name: "线条小狗", file: "line-dog.gif" },
  { id: "hello-kitty", name: "Hello Kitty", file: "hello-kitty.gif" },
  { id: "cinnamoroll", name: "玉桂狗", file: "cinnamoroll.gif" },
  { id: "melody", name: "美乐蒂", file: "melody.gif" },
  { id: "kuromi", name: "库洛米", file: "kuromi.gif" }
];

let controlWindow = null;
let overlayWindows = [];
let cursorTimer = null;
let settings = null;

function assetPath(file) {
  return path.join(__dirname, "..", "assets", file);
}

function assetUrl(file) {
  return pathToFileURL(assetPath(file)).href;
}

function userDataPath(file) {
  return path.join(app.getPath("userData"), file);
}

function gifLibraryDir() {
  return userDataPath("gif-library");
}

function gifLibraryFile() {
  return userDataPath("gif-library.json");
}

function sanitizeFileName(name) {
  return String(name || "gif")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function defaultSettings() {
  return {
    enabled: true,
    src: assetUrl(PRESETS[0].file),
    name: PRESETS[0].name,
    presetId: PRESETS[0].id,
    libraryId: "",
    removeBackgroundMode: "smart",
    colorTolerance: 30,
    size: 72,
    offsetX: 28,
    offsetY: 28,
    opacity: 100
  };
}

function getPresetPayload() {
  return PRESETS.map((preset) => ({
    ...preset,
    src: assetUrl(preset.file)
  }));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeSettings(input) {
  const base = defaultSettings();
  const next = { ...base, ...(input || {}) };

  next.enabled = Boolean(next.enabled);
  next.size = clampNumber(next.size, 20, 200, base.size);
  next.offsetX = clampNumber(next.offsetX, -160, 160, base.offsetX);
  next.offsetY = clampNumber(next.offsetY, -160, 160, base.offsetY);
  next.opacity = clampNumber(next.opacity, 20, 100, base.opacity);
  next.colorTolerance = clampNumber(next.colorTolerance, 0, 100, base.colorTolerance);
  next.src = typeof next.src === "string" && next.src ? next.src : base.src;
  next.name = typeof next.name === "string" && next.name ? next.name : base.name;
  next.presetId = typeof next.presetId === "string" ? next.presetId : base.presetId;
  next.libraryId = typeof next.libraryId === "string" ? next.libraryId : base.libraryId;
  const validModes = ["off", "smart", "preserve-white", "pick-color"];
  next.removeBackgroundMode = validModes.includes(next.removeBackgroundMode)
    ? next.removeBackgroundMode
    : base.removeBackgroundMode;
  next.pickedColor = next.pickedColor || null;

  return next;
}

function loadLibrary() {
  try {
    const file = gifLibraryFile();
    if (!fs.existsSync(file)) return [];
    const items = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(items)) return [];
    return items
      .filter((item) => item && item.id && item.path && fs.existsSync(item.path))
      .map((item) => ({
        id: String(item.id),
        name: item.name || path.basename(item.path),
        path: item.path,
        src: pathToFileURL(item.path).href,
        createdAt: item.createdAt || Date.now()
      }));
  } catch (error) {
    console.warn("读取本地 GIF 库失败。", error);
    return [];
  }
}

function saveLibrary(items) {
  fs.mkdirSync(path.dirname(gifLibraryFile()), { recursive: true });
  fs.writeFileSync(gifLibraryFile(), JSON.stringify(items, null, 2), "utf8");
}

function copyGifToLibrary(source) {
  fs.mkdirSync(gifLibraryDir(), { recursive: true });
  const ext = path.extname(source) || ".gif";
  const base = sanitizeFileName(path.basename(source, ext));
  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const target = path.join(gifLibraryDir(), `${id}-${base}${ext}`);
  fs.copyFileSync(source, target);
  return {
    id,
    name: path.basename(source),
    path: target,
    src: pathToFileURL(target).href,
    createdAt: Date.now()
  };
}

function readImageSourceAsBase64(src) {
  if (typeof src !== "string" || !src) {
    return "";
  }

  if (src.startsWith("data:")) {
    const commaIndex = src.indexOf(",");
    return commaIndex >= 0 ? src.slice(commaIndex + 1) : "";
  }

  const cleanSrc = src.split("?")[0];
  let filePath = cleanSrc;
  if (cleanSrc.startsWith("file://")) {
    filePath = fileURLToPath(cleanSrc);
  }

  return fs.readFileSync(filePath).toString("base64");
}

function loadSettings() {
  try {
    const file = userDataPath("settings.json");
    if (!fs.existsSync(file)) {
      return defaultSettings();
    }
    return normalizeSettings(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (error) {
    console.warn("读取设置失败，已使用默认设置。", error);
    return defaultSettings();
  }
}

function saveSettings() {
  const file = userDataPath("settings.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2), "utf8");
}

function broadcastSettings() {
  const payload = normalizeSettings(settings);
  overlayWindows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send("settings:update", payload);
    }
  });
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send("settings:update", payload);
  }
}

function updateSettings(patch) {
  settings = normalizeSettings({ ...settings, ...(patch || {}) });
  saveSettings();
  broadcastSettings();
  return settings;
}

function createOverlayForDisplay(display) {
  const { x, y, width, height } = display.bounds;
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    enableLargerThanScreen: true,
    acceptFirstMouse: false,
    backgroundColor: "#00000000",
    type: process.platform === "darwin" ? "panel" : "toolbar",
    title: "",
    titleBarStyle: "customButtonsOnHover",
    roundedCorners: false,
    thickFrame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  win.setIgnoreMouseEvents(true, { forward: true });
  win.setAlwaysOnTop(true, "screen-saver", 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setFullScreenable(false);

  if (process.platform === "darwin") {
    try {
      win.setHiddenInMissionControl && win.setHiddenInMissionControl(true);
      win.setWindowButtonVisibility && win.setWindowButtonVisibility(false);
    } catch (_) {}
  }

  win.loadFile(path.join(__dirname, "overlay.html"));
  win.once("ready-to-show", () => {
    if (win.isDestroyed()) return;
    win.showInactive();
    win.webContents.send("overlay:init", { displayId: display.id, bounds: display.bounds });
    win.webContents.send("settings:update", settings);
  });

  return win;
}

function recreateOverlays() {
  overlayWindows.forEach((win) => {
    if (!win.isDestroyed()) win.destroy();
  });
  overlayWindows = screen.getAllDisplays().map(createOverlayForDisplay);
}

function createControlWindow() {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.show();
    controlWindow.focus();
    return;
  }

  controlWindow = new BrowserWindow({
    width: 480,
    height: 800,
    minWidth: 440,
    minHeight: 640,
    title: "GIF Mouse Follower",
    backgroundColor: "#f6f8fc",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  controlWindow.loadFile(path.join(__dirname, "control.html"));
  controlWindow.once("ready-to-show", () => controlWindow.show());
  controlWindow.on("closed", () => {
    controlWindow = null;
  });
}

function startCursorPolling() {
  if (cursorTimer) clearInterval(cursorTimer);

  cursorTimer = setInterval(() => {
    const point = screen.getCursorScreenPoint();
    overlayWindows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send("cursor:update", point);
      }
    });
  }, 16);
}

function registerIpc() {
  ipcMain.handle("settings:get", () => settings);
  ipcMain.handle("settings:set", (_event, patch) => updateSettings(patch));
  ipcMain.handle("settings:reset", () => {
    settings = defaultSettings();
    saveSettings();
    broadcastSettings();
    return settings;
  });

  ipcMain.handle("presets:get", () => getPresetPayload());
  ipcMain.handle("library:get", () => loadLibrary());
  ipcMain.handle("image:readBase64", (_event, src) => readImageSourceAsBase64(src));

  ipcMain.handle("dialog:chooseGif", async () => {
    const visibleOverlays = overlayWindows.filter((win) => !win.isDestroyed() && win.isVisible());
    try {
      visibleOverlays.forEach((win) => win.hide());
      if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.show();
        controlWindow.focus();
      }

      const result = await dialog.showOpenDialog({
        title: "选择一个 GIF",
        properties: ["openFile"],
        filters: [
          { name: "GIF 图片", extensions: ["gif"] },
          { name: "图片", extensions: ["gif", "png", "jpg", "jpeg", "webp"] }
        ]
      });

      if (result.canceled || !result.filePaths[0]) {
        return settings;
      }

      const source = result.filePaths[0];
      const item = copyGifToLibrary(source);
      const library = loadLibrary();
      library.unshift(item);
      saveLibrary(library);

      return updateSettings({
        src: item.src,
        name: item.name,
        presetId: "library",
        libraryId: item.id
      });
    } finally {
      visibleOverlays.forEach((win) => {
        if (!win.isDestroyed()) {
          win.showInactive();
          win.setAlwaysOnTop(true, "screen-saver", 1);
          win.setIgnoreMouseEvents(true, { forward: true });
        }
      });
    }
  });

  ipcMain.handle("library:select", (_event, id) => {
    const item = loadLibrary().find((entry) => entry.id === id);
    if (!item) return settings;
    return updateSettings({
      src: item.src,
      name: item.name,
      presetId: "library",
      libraryId: item.id
    });
  });

  ipcMain.handle("library:remove", (_event, id) => {
    const library = loadLibrary();
    const item = library.find((entry) => entry.id === id);
    const nextLibrary = library.filter((entry) => entry.id !== id);
    if (item && fs.existsSync(item.path)) {
      try {
        fs.unlinkSync(item.path);
      } catch (error) {
        console.warn("删除本地 GIF 失败。", error);
      }
    }
    saveLibrary(nextLibrary);
    if (settings.libraryId === id) {
      updateSettings(defaultSettings());
    }
    return nextLibrary;
  });

  ipcMain.handle("library:rename", (_event, { id, newName }) => {
    const library = loadLibrary();
    const item = library.find((entry) => entry.id === id);
    if (!item) return library;

    const trimmed = String(newName || "").trim();
    if (!trimmed || trimmed.length > 30) return library;

    item.name = trimmed;
    saveLibrary(library);

    // 如果当前正在使用的就是这张 GIF，同步更新全局设置里的 name
    if (settings.libraryId === id) {
      updateSettings({ name: trimmed });
    }

    return library;
  });

  ipcMain.handle("app:showControl", () => {
    createControlWindow();
    return true;
  });

  ipcMain.handle("app:openExternal", (_event, url) => {
    if (typeof url === "string" && /^https?:\/\//.test(url)) {
      shell.openExternal(url);
    }
    return true;
  });

  ipcMain.handle("color:pick", (_event, color) => {
    if (!color || typeof color !== "object") return settings;
    return updateSettings({
      removeBackgroundMode: "pick-color",
      pickedColor: {
        r: color.r,
        g: color.g,
        b: color.b,
        xRatio: typeof color.xRatio === "number" ? color.xRatio : 0,
        yRatio: typeof color.yRatio === "number" ? color.yRatio : 0
      }
    });
  });
}

app.whenReady().then(() => {
  if (process.platform === "darwin" && app.dock) {
    app.dock.show();
  }

  settings = loadSettings();
  registerIpc();
  recreateOverlays();
  createControlWindow();
  startCursorPolling();

  screen.on("display-added", recreateOverlays);
  screen.on("display-removed", recreateOverlays);
  screen.on("display-metrics-changed", recreateOverlays);

  app.on("activate", createControlWindow);
});

app.on("before-quit", () => {
  if (cursorTimer) clearInterval(cursorTimer);
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
