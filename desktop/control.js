(function () {
  "use strict";

  const dom = {
    preview: document.getElementById("previewImage"),
    currentName: document.getElementById("currentName"),
    statusText: document.getElementById("statusText"),
    enabled: document.getElementById("enabledInput"),
    modeOff: document.getElementById("modeOff"),
    modeSmart: document.getElementById("modeSmart"),
    modePreserve: document.getElementById("modePreserve"),
    modePickColor: document.getElementById("modePickColor"),
    pickColorArea: document.getElementById("pickColorArea"),
    colorPreview: document.getElementById("colorPreview"),
    pickColorTip: document.getElementById("pickColorTip"),
    tolerance: document.getElementById("toleranceInput"),
    toleranceValue: document.getElementById("toleranceValue"),
    chooseGif: document.getElementById("chooseGifButton"),
    fileTip: document.getElementById("fileTip"),
    size: document.getElementById("sizeInput"),
    sizeValue: document.getElementById("sizeValue"),
    offsetX: document.getElementById("offsetXInput"),
    offsetXValue: document.getElementById("offsetXValue"),
    offsetY: document.getElementById("offsetYInput"),
    offsetYValue: document.getElementById("offsetYValue"),
    opacity: document.getElementById("opacityInput"),
    opacityValue: document.getElementById("opacityValue"),
    presetGrid: document.getElementById("presetGrid"),
    libraryGrid: document.getElementById("libraryGrid"),
    reset: document.getElementById("resetButton")
  };

  let settings = null;
  let presets = [];
  let library = [];

  function applySettings(next) {
    settings = { ...(settings || {}), ...(next || {}) };

    dom.preview.src = settings.src;
    dom.currentName.textContent = settings.name || "当前 GIF";
    dom.statusText.textContent = settings.enabled ? "跟随已开启" : "跟随已关闭";

    dom.enabled.checked = Boolean(settings.enabled);
    const mode = settings.removeBackgroundMode || "smart";
    dom.modeOff.checked = mode === "off";
    dom.modeSmart.checked = mode === "smart";
    dom.modePreserve.checked = mode === "preserve-white";
    dom.modePickColor.checked = mode === "pick-color";
    dom.pickColorArea.style.display = mode === "pick-color" ? "block" : "none";
    if (settings.pickedColor) {
      dom.colorPreview.style.backgroundColor = `rgb(${settings.pickedColor.r},${settings.pickedColor.g},${settings.pickedColor.b})`;
      dom.colorPreview.style.display = "block";
    } else {
      dom.colorPreview.style.display = "none";
    }
    dom.size.value = settings.size;
    dom.offsetX.value = settings.offsetX;
    dom.offsetY.value = settings.offsetY;
    dom.opacity.value = settings.opacity;
    dom.tolerance.value = settings.colorTolerance || 30;

    dom.sizeValue.value = `${settings.size}px`;
    dom.offsetXValue.value = `${settings.offsetX}px`;
    dom.offsetYValue.value = `${settings.offsetY}px`;
    dom.opacityValue.value = `${settings.opacity}%`;
    dom.toleranceValue.value = settings.colorTolerance || 30;

    updatePresetButtons();
    updateLibraryButtons();
  }

  function updatePresetButtons() {
    if (!settings) return;
    dom.presetGrid.querySelectorAll(".preset-button").forEach((button) => {
      const active = button.dataset.presetId === settings.presetId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function updateLibraryButtons() {
    if (!settings) return;
    dom.libraryGrid.querySelectorAll(".library-button").forEach((button) => {
      const active = button.dataset.libraryId === settings.libraryId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderPresets() {
    dom.presetGrid.innerHTML = "";

    presets.forEach((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-button";
      button.dataset.presetId = preset.id;
      button.setAttribute("aria-label", `使用${preset.name}`);

      const image = document.createElement("img");
      image.src = preset.src;
      image.alt = "";

      const label = document.createElement("span");
      label.textContent = preset.name;

      button.append(image, label);
      button.addEventListener("click", async () => {
        applySettings(await window.gifFollower.setSettings({
          src: preset.src,
          name: preset.name,
          presetId: preset.id,
          libraryId: ""
        }));
      });

      dom.presetGrid.append(button);
    });
  }

  function renderLibrary() {
    dom.libraryGrid.innerHTML = "";

    if (!library.length) {
      const empty = document.createElement("p");
      empty.className = "tip";
      empty.textContent = "还没有上传过本地 GIF。";
      dom.libraryGrid.append(empty);
      return;
    }

    library.forEach((item) => {
      const wrap = document.createElement("div");
      wrap.className = "library-item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "library-button";
      button.dataset.libraryId = item.id;
      button.setAttribute("aria-label", `使用${item.name}`);

      const image = document.createElement("img");
      image.src = item.src;
      image.alt = "";

      const label = document.createElement("span");
      label.textContent = getShortName(item.name);
      label.dataset.originalName = item.name;
      label.dataset.itemId = item.id;

      const rename = document.createElement("button");
      rename.type = "button";
      rename.className = "library-rename";
      rename.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
      rename.setAttribute("aria-label", `重命名${item.name}`);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "library-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `删除${item.name}`);

      button.append(image, label);
      button.addEventListener("click", async () => {
        applySettings(await window.gifFollower.selectLibraryGif(item.id));
      });

      // 行内重命名：把 label 换成 input
      function startRename(event) {
        event.stopPropagation();
        if (label.tagName === "INPUT") return;
        const currentName = item.name.replace(/\.[^.]+$/, "");
        const input = document.createElement("input");
        input.type = "text";
        input.value = currentName;
        input.className = "library-rename-input";
        input.maxLength = 30;
        label.replaceWith(input);
        input.focus();
        input.select();

        async function confirmRename() {
          const trimmed = input.value.trim();
          if (!trimmed) {
            dom.fileTip.textContent = "名称不能为空。";
            cancelRename();
            return;
          }
          if (trimmed.length > 30) {
            dom.fileTip.textContent = "名称最多 30 个字符。";
            cancelRename();
            return;
          }
          library = await window.gifFollower.renameLibraryGif(item.id, trimmed);
          renderLibrary();
          if (settings && settings.libraryId === item.id) {
            applySettings(await window.gifFollower.getSettings());
          }
        }

        function cancelRename() {
          input.replaceWith(label);
        }

        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmRename();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelRename();
          }
        });
        input.addEventListener("blur", () => {
          // 延迟一点，让 click 事件先完成
          setTimeout(() => {
            if (document.contains(input)) cancelRename();
          }, 200);
        });
      }

      rename.addEventListener("click", startRename);
      label.addEventListener("dblclick", startRename);

      remove.addEventListener("click", async (event) => {
        event.stopPropagation();
        library = await window.gifFollower.removeLibraryGif(item.id);
        renderLibrary();
        applySettings(await window.gifFollower.getSettings());
      });

      wrap.append(button, rename, remove);
      dom.libraryGrid.append(wrap);
    });

    updateLibraryButtons();
  }

  function getShortName(name) {
    if (!name) return "GIF";
    const base = name.replace(/\.[^.]+$/, "");
    return base.length > 8 ? base.slice(0, 7) + "…" : base;
  }

  async function getPixelColor(src, x, y) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const cvs = document.createElement("canvas");
        cvs.width = img.naturalWidth;
        cvs.height = img.naturalHeight;
        const c = cvs.getContext("2d");
        c.drawImage(img, 0, 0);
        const px = c.getImageData(Math.max(0, Math.min(x, img.naturalWidth - 1)), Math.max(0, Math.min(y, img.naturalHeight - 1)), 1, 1).data;
        resolve({ r: px[0], g: px[1], b: px[2] });
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  async function refreshLibrary() {
    library = await window.gifFollower.getLibrary();
    renderLibrary();
  }

  function bindEvents() {
    dom.enabled.addEventListener("change", async () => {
      applySettings(await window.gifFollower.setSettings({ enabled: dom.enabled.checked }));
    });

    const modeInputs = [dom.modeOff, dom.modeSmart, dom.modePreserve, dom.modePickColor];
    modeInputs.forEach((input) => {
      input.addEventListener("change", async () => {
        if (input.checked) {
          applySettings(await window.gifFollower.setSettings({ removeBackgroundMode: input.value }));
        }
      });
    });

    // 手动取色：点击预览图
    dom.preview.addEventListener("click", async (event) => {
      if (!settings || settings.removeBackgroundMode !== "pick-color") return;
      const rect = dom.preview.getBoundingClientRect();
      const x = Math.round((event.clientX - rect.left) * (dom.preview.naturalWidth / rect.width));
      const y = Math.round((event.clientY - rect.top) * (dom.preview.naturalHeight / rect.height));
      try {
        const color = await getPixelColor(dom.preview.src, x, y);
        if (color) {
          dom.colorPreview.style.backgroundColor = `rgb(${color.r},${color.g},${color.b})`;
          dom.colorPreview.style.display = "block";
          dom.pickColorTip.textContent = `已选取颜色 rgb(${color.r}, ${color.g}, ${color.b})，正在应用...`;
          // 传相对比例（0~1），overlay 用画布尺寸换算实际坐标
          const xRatio = dom.preview.naturalWidth > 0 ? x / dom.preview.naturalWidth : 0;
          const yRatio = dom.preview.naturalHeight > 0 ? y / dom.preview.naturalHeight : 0;
          applySettings(await window.gifFollower.pickColor({ ...color, xRatio, yRatio }));
          dom.pickColorTip.textContent = `已去除连通区域，点击 GIF 其他区域可继续取色`;
        }
      } catch (err) {
        console.error(err);
        dom.pickColorTip.textContent = "取色失败，请重试";
      }
    });

    dom.chooseGif.addEventListener("click", async () => {
      try {
        dom.chooseGif.disabled = true;
        dom.chooseGif.textContent = "正在打开选择器...";
        dom.fileTip.textContent = "如果文件选择窗口没有出现在最前面，请查看 Dock 或按 Command + Tab 切换。";
        const beforeLibraryCount = library.length;
        applySettings(await window.gifFollower.chooseGif());
        await refreshLibrary();
        dom.fileTip.textContent = library.length > beforeLibraryCount
          ? "已加入本地 GIF 库，原文件删除后也能继续使用。"
          : "已取消选择，没有新增 GIF。";
      } catch (error) {
        console.error(error);
        dom.fileTip.textContent = "打开文件选择器失败，请重启程序后再试。";
      } finally {
        dom.chooseGif.disabled = false;
        dom.chooseGif.textContent = "添加 GIF 到本地库";
      }
    });

    dom.size.addEventListener("input", async () => {
      applySettings(await window.gifFollower.setSettings({ size: Number(dom.size.value) }));
    });

    dom.offsetX.addEventListener("input", async () => {
      applySettings(await window.gifFollower.setSettings({ offsetX: Number(dom.offsetX.value) }));
    });

    dom.offsetY.addEventListener("input", async () => {
      applySettings(await window.gifFollower.setSettings({ offsetY: Number(dom.offsetY.value) }));
    });

    dom.opacity.addEventListener("input", async () => {
      applySettings(await window.gifFollower.setSettings({ opacity: Number(dom.opacity.value) }));
    });

    dom.tolerance.addEventListener("input", async () => {
      applySettings(await window.gifFollower.setSettings({ colorTolerance: Number(dom.tolerance.value) }));
    });

    dom.reset.addEventListener("click", async () => {
      dom.fileTip.textContent = "已恢复默认设置。";
      applySettings(await window.gifFollower.resetSettings());
    });

    window.gifFollower.onSettingsUpdate(applySettings);
  }

  window.addEventListener("DOMContentLoaded", async () => {
    try {
      const [loadedPresets, loadedLibrary, loadedSettings] = await Promise.all([
        window.gifFollower.getPresets(),
        window.gifFollower.getLibrary(),
        window.gifFollower.getSettings()
      ]);
      presets = loadedPresets;
      library = loadedLibrary;
      renderPresets();
      applySettings(loadedSettings);
      renderLibrary();
      bindEvents();
    } catch (error) {
      console.error(error);
      dom.fileTip.textContent = "控制面板初始化失败，请重启程序。";
    }
  });
})();
