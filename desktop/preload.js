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
  onSettingsUpdate: (callback) => {
    ipcRenderer.on("settings:update", (_event, settings) => callback(settings));
  },
  onCursorUpdate: (callback) => {
    ipcRenderer.on("cursor:update", (_event, point) => callback(point));
  },
  onOverlayInit: (callback) => {
    ipcRenderer.on("overlay:init", (_event, payload) => callback(payload));
  }
});
