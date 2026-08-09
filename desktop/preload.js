"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gifFollower", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  resetSettings: () => ipcRenderer.invoke("settings:reset"),
  getPresets: () => ipcRenderer.invoke("presets:get"),
  getLibrary: () => ipcRenderer.invoke("library:get"),
  selectLibraryGif: (id) => ipcRenderer.invoke("library:select", id),
  removeLibraryGif: (id) => ipcRenderer.invoke("library:remove", id),
  renameLibraryGif: (id, newName) => ipcRenderer.invoke("library:rename", { id, newName }),
  readImageBase64: (src) => ipcRenderer.invoke("image:readBase64", src),
  chooseGif: () => ipcRenderer.invoke("dialog:chooseGif"),
  pickColor: (color) => ipcRenderer.invoke("color:pick", color),
  showControl: () => ipcRenderer.invoke("app:showControl"),
  openExternal: (url) => ipcRenderer.invoke("app:openExternal", url),
  getAutoStart: () => ipcRenderer.invoke("autostart:get"),
  setAutoStart: (enable) => ipcRenderer.invoke("autostart:set", enable),
  exportSettings: () => ipcRenderer.invoke("settings:export"),
  importSettings: () => ipcRenderer.invoke("settings:import"),
  addFileToLibrary: (filePath) => ipcRenderer.invoke("library:addFile", filePath),
  setShortcut: (accelerator) => ipcRenderer.invoke("shortcut:set", accelerator),
  addCompanion: (src, name) => ipcRenderer.invoke("companion:add", { src, name }),
  removeCompanion: (id) => ipcRenderer.invoke("companion:remove", id),
  updateCompanion: (id, patch) => ipcRenderer.invoke("companion:update", { id, patch }),
  reportFrameInfo: (info) => ipcRenderer.send("frame:info", info),
  getFrameInfo: () => ipcRenderer.invoke("frame:getInfo"),
  onFrameInfo: (callback) => {
    ipcRenderer.on("frame:info", (_event, info) => callback(info));
  },
  onSettingsUpdate: (callback) => {
    ipcRenderer.on("settings:update", (_event, settings) => callback(settings));
  },
  onCursorUpdate: (callback) => {
    ipcRenderer.on("cursor:update", (_event, point) => callback(point));
  },
  onOverlayInit: (callback) => {
    ipcRenderer.on("overlay:init", (_event, payload) => callback(payload));
  },
  onMouseClick: (callback) => {
    ipcRenderer.on("mouse:click", (_event, point) => callback(point));
  }
});
