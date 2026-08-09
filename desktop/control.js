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
    speed: document.getElementById("speedInput"),
    speedValue: document.getElementById("speedValue"),
    flipH: document.getElementById("flipHInput"),
    flipV: document.getElementById("flipVInput"),
    darkMode: document.getElementById("darkModeInput"),
    autoStart: document.getElementById("autoStartInput"),
    rotationOptions: document.getElementById("rotationOptions"),
    rotationValue: document.getElementById("rotationValue"),
    smoothness: document.getElementById("smoothnessInput"),
    smoothnessValue: document.getElementById("smoothnessValue"),
    clickEffect: document.getElementById("clickEffectInput"),
    shortcutInput: document.getElementById("shortcutInput"),
    shortcutRecordBtn: document.getElementById("shortcutRecordBtn"),
    shortcutTip: document.getElementById("shortcutTip"),
    exportBtn: document.getElementById("exportSettingsBtn"),
    importBtn: document.getElementById("importSettingsBtn"),
    companionSelect: document.getElementById("companionSelect"),
    addCompanionBtn: document.getElementById("addCompanionBtn"),
    companionList: document.getElementById("companionList"),
    companionTip: document.getElementById("companionTip"),
    frameCountValue: document.getElementById("frameCountValue"),
    frameStart: document.getElementById("frameStartInput"),
    frameStartValue: document.getElementById("frameStartValue"),
    frameEnd: document.getElementById("frameEndInput"),
    frameEndValue: document.getElementById("frameEndValue"),
    resetFrameBtn: document.getElementById("resetFrameBtn"),
    presetGrid: document.getElementById("presetGrid"),
    libraryGrid: document.getElementById("libraryGrid"),
    reset: document.getElementById("resetButton")
  };

  let settings = null;
  let presets = [];
  let library = [];

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  const debouncedSetSettings = debounce(async (patch) => {
    applySettings(await window.gifFollower.setSettings(patch));
  }, 150);

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
    dom.speed.value = settings.playbackSpeed || 1.0;
    dom.flipH.checked = Boolean(settings.flipH);
    dom.flipV.checked = Boolean(settings.flipV);
    dom.darkMode.checked = Boolean(settings.darkMode);
    dom.clickEffect.checked = Boolean(settings.clickEffect);

    dom.sizeValue.value = `${settings.size}px`;
    dom.offsetXValue.value = `${settings.offsetX}px`;
    dom.offsetYValue.value = `${settings.offsetY}px`;
    dom.opacityValue.value = `${settings.opacity}%`;
    dom.toleranceValue.value = settings.colorTolerance || 30;
    dom.speedValue.value = `${(settings.playbackSpeed || 1.0).toFixed(2)}x`;
    dom.smoothness.value = settings.smoothness || 0.18;
    dom.smoothnessValue.value = (settings.smoothness || 0.18).toFixed(2);
    dom.rotationValue.value = `${settings.rotation || 0}°`;

    // 帧截取显示
    dom.frameStart.value = settings.frameStart || 0;
    dom.frameStartValue.value = settings.frameStart || 0;
    dom.frameEnd.value = settings.frameEnd || 0;
    dom.frameEndValue.value = settings.frameEnd || 0;

    // 更新旋转按钮高亮
    dom.rotationOptions.querySelectorAll(".rotation-btn").forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.rotation) === (settings.rotation || 0));
    });

    // 更新快捷键显示
    const shortcut = settings.customShortcut || "CommandOrControl+Shift+G";
    dom.shortcutInput.value = formatShortcut(shortcut);

    // 应用深色主题
    document.body.setAttribute("data-theme", settings.darkMode ? "dark" : "light");

    updatePresetButtons();
    updateLibraryButtons();
    renderCompanionList();
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

  function populateCompanionSelect() {
    dom.companionSelect.innerHTML = '<option value="">选择 GIF…</option>';
    const group1 = document.createElement("optgroup");
    group1.label = "预设";
    presets.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.src;
      opt.textContent = p.name;
      group1.append(opt);
    });
    dom.companionSelect.append(group1);

    if (library.length) {
      const group2 = document.createElement("optgroup");
      group2.label = "本地库";
      library.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.src;
        opt.textContent = item.name;
        group2.append(opt);
      });
      dom.companionSelect.append(group2);
    }
  }

  function renderCompanionList() {
    dom.companionList.innerHTML = "";
    const companions = (settings && settings.companions) || [];
    if (!companions.length) {
      const empty = document.createElement("p");
      empty.className = "tip";
      empty.textContent = "还没有添加伴生 GIF。";
      dom.companionList.append(empty);
      return;
    }

    companions.forEach((comp) => {
      const item = document.createElement("div");
      item.className = "companion-item";

      // 头部：缩略图 + 名称 + 删除
      const header = document.createElement("div");
      header.className = "companion-header";
      const img = document.createElement("img");
      img.src = comp.src;
      img.alt = "";
      const name = document.createElement("span");
      name.textContent = comp.name || "伴生 GIF";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "companion-remove";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", `删除${comp.name}`);
      removeBtn.addEventListener("click", async () => {
        const result = await window.gifFollower.removeCompanion(comp.id);
        if (result.success) applySettings(result.settings);
      });
      header.append(img, name, removeBtn);

      // 控制区域
      const controls = document.createElement("div");
      controls.className = "companion-controls";

      // 大小
      const sizeGroup = document.createElement("div");
      sizeGroup.className = "field-group";
      sizeGroup.style.padding = "0";
      const sizeLabel = document.createElement("div");
      sizeLabel.className = "range-label";
      const sizeLbl = document.createElement("label");
      sizeLbl.textContent = "大小";
      sizeLbl.style.fontSize = "11px";
      const sizeOut = document.createElement("output");
      sizeOut.textContent = `${comp.size}px`;
      sizeLabel.append(sizeLbl, sizeOut);
      const sizeInput = document.createElement("input");
      sizeInput.type = "range";
      sizeInput.min = "20";
      sizeInput.max = "200";
      sizeInput.step = "1";
      sizeInput.value = comp.size;
      sizeInput.addEventListener("input", () => {
        sizeOut.textContent = `${sizeInput.value}px`;
      });
      sizeInput.addEventListener("change", () => {
        window.gifFollower.updateCompanion(comp.id, { size: Number(sizeInput.value) });
      });
      sizeGroup.append(sizeLabel, sizeInput);

      // 偏移 X/Y
      const offsetGrid = document.createElement("div");
      offsetGrid.className = "companion-mini-grid";

      const offXGroup = document.createElement("div");
      offXGroup.style.padding = "0";
      const offXLabel = document.createElement("div");
      offXLabel.className = "range-label";
      const offXLbl = document.createElement("label");
      offXLbl.textContent = "X 偏移";
      offXLbl.style.fontSize = "11px";
      const offXOut = document.createElement("output");
      offXOut.textContent = `${comp.offsetX}px`;
      offXLabel.append(offXLbl, offXOut);
      const offXInput = document.createElement("input");
      offXInput.type = "range";
      offXInput.min = "-200";
      offXInput.max = "200";
      offXInput.step = "1";
      offXInput.value = comp.offsetX;
      offXInput.addEventListener("input", () => {
        offXOut.textContent = `${offXInput.value}px`;
      });
      offXInput.addEventListener("change", () => {
        window.gifFollower.updateCompanion(comp.id, { offsetX: Number(offXInput.value) });
      });
      offXGroup.append(offXLabel, offXInput);

      const offYGroup = document.createElement("div");
      offYGroup.style.padding = "0";
      const offYLabel = document.createElement("div");
      offYLabel.className = "range-label";
      const offYLbl = document.createElement("label");
      offYLbl.textContent = "Y 偏移";
      offYLbl.style.fontSize = "11px";
      const offYOut = document.createElement("output");
      offYOut.textContent = `${comp.offsetY}px`;
      offYLabel.append(offYLbl, offYOut);
      const offYInput = document.createElement("input");
      offYInput.type = "range";
      offYInput.min = "-200";
      offYInput.max = "200";
      offYInput.step = "1";
      offYInput.value = comp.offsetY;
      offYInput.addEventListener("input", () => {
        offYOut.textContent = `${offYInput.value}px`;
      });
      offYInput.addEventListener("change", () => {
        window.gifFollower.updateCompanion(comp.id, { offsetY: Number(offYInput.value) });
      });
      offYGroup.append(offYLabel, offYInput);

      offsetGrid.append(offXGroup, offYGroup);

      // 旋转
      const rotRow = document.createElement("div");
      rotRow.className = "companion-rotation-row";
      [0, 90, 180, 270].forEach((deg) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "companion-rotation-btn";
        btn.textContent = `${deg}°`;
        if (comp.rotation === deg) btn.classList.add("is-active");
        btn.addEventListener("click", () => {
          rotRow.querySelectorAll(".companion-rotation-btn").forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          window.gifFollower.updateCompanion(comp.id, { rotation: deg });
        });
        rotRow.append(btn);
      });

      // 透明度
      const opGroup = document.createElement("div");
      opGroup.className = "field-group";
      opGroup.style.padding = "0";
      const opLabel = document.createElement("div");
      opLabel.className = "range-label";
      const opLbl = document.createElement("label");
      opLbl.textContent = "透明度";
      opLbl.style.fontSize = "11px";
      const opOut = document.createElement("output");
      opOut.textContent = `${comp.opacity}%`;
      opLabel.append(opLbl, opOut);
      const opInput = document.createElement("input");
      opInput.type = "range";
      opInput.min = "20";
      opInput.max = "100";
      opInput.step = "1";
      opInput.value = comp.opacity;
      opInput.addEventListener("input", () => {
        opOut.textContent = `${opInput.value}%`;
      });
      opInput.addEventListener("change", () => {
        window.gifFollower.updateCompanion(comp.id, { opacity: Number(opInput.value) });
      });
      opGroup.append(opLabel, opInput);

      controls.append(sizeGroup, offsetGrid, rotRow, opGroup);
      item.append(header, controls);
      dom.companionList.append(item);
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

  function formatShortcut(accelerator) {
    if (!accelerator) return "⌘ + Shift + G";
    return accelerator
      .replace(/CommandOrControl/gi, "⌘")
      .replace(/Command/gi, "⌘")
      .replace(/Control/gi, "Ctrl")
      .replace(/Shift/gi, "Shift")
      .replace(/Alt/gi, "⌥")
      .replace(/\+/g, " + ");
  }

  let isRecordingShortcut = false;

  // 取色用离屏 canvas 缓存：按 src 缓存解码结果，连续取色不再重复加载图片
  let pickColorCache = { src: "", canvas: null, ctx: null };

  function getPickColorCanvas(src) {
    return new Promise((resolve, reject) => {
      if (pickColorCache.src === src && pickColorCache.canvas) {
        resolve(pickColorCache);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const cvs = document.createElement("canvas");
        cvs.width = img.naturalWidth;
        cvs.height = img.naturalHeight;
        const c = cvs.getContext("2d");
        c.drawImage(img, 0, 0);
        pickColorCache = { src, canvas: cvs, ctx: c };
        resolve(pickColorCache);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  async function getPixelColor(src, x, y) {
    const { canvas: cvs, ctx: c } = await getPickColorCanvas(src);
    const px = c.getImageData(
      Math.max(0, Math.min(x, cvs.width - 1)),
      Math.max(0, Math.min(y, cvs.height - 1)),
      1, 1
    ).data;
    return { r: px[0], g: px[1], b: px[2] };
  }

  async function refreshLibrary() {
    library = await window.gifFollower.getLibrary();
    renderLibrary();
    populateCompanionSelect();
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
        console.warn("取色失败:", err);
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
        console.warn("打开文件选择器失败:", error);
        dom.fileTip.textContent = "打开文件选择器失败，请重启程序后再试。";
      } finally {
        dom.chooseGif.disabled = false;
        dom.chooseGif.textContent = "添加 GIF 到本地库";
      }
    });

    dom.size.addEventListener("input", () => {
      dom.sizeValue.value = `${dom.size.value}px`;
      debouncedSetSettings({ size: Number(dom.size.value) });
    });

    dom.offsetX.addEventListener("input", () => {
      dom.offsetXValue.value = `${dom.offsetX.value}px`;
      debouncedSetSettings({ offsetX: Number(dom.offsetX.value) });
    });

    dom.offsetY.addEventListener("input", () => {
      dom.offsetYValue.value = `${dom.offsetY.value}px`;
      debouncedSetSettings({ offsetY: Number(dom.offsetY.value) });
    });

    dom.opacity.addEventListener("input", () => {
      dom.opacityValue.value = `${dom.opacity.value}%`;
      debouncedSetSettings({ opacity: Number(dom.opacity.value) });
    });

    dom.tolerance.addEventListener("input", () => {
      dom.toleranceValue.value = dom.tolerance.value;
      debouncedSetSettings({ colorTolerance: Number(dom.tolerance.value) });
    });

    dom.speed.addEventListener("input", () => {
      const speed = Number(dom.speed.value);
      dom.speedValue.value = `${speed.toFixed(2)}x`;
      debouncedSetSettings({ playbackSpeed: speed });
    });

    dom.flipH.addEventListener("change", () => {
      debouncedSetSettings({ flipH: dom.flipH.checked });
    });

    dom.flipV.addEventListener("change", () => {
      debouncedSetSettings({ flipV: dom.flipV.checked });
    });

    dom.darkMode.addEventListener("change", () => {
      const dark = dom.darkMode.checked;
      document.body.setAttribute("data-theme", dark ? "dark" : "light");
      debouncedSetSettings({ darkMode: dark });
    });

    dom.autoStart.addEventListener("change", async () => {
      try {
        await window.gifFollower.setAutoStart(dom.autoStart.checked);
      } catch (error) {
        console.warn("设置开机自启失败:", error);
        dom.autoStart.checked = !dom.autoStart.checked;
      }
    });

    dom.reset.addEventListener("click", async () => {
      dom.fileTip.textContent = "已恢复默认设置。";
      applySettings(await window.gifFollower.resetSettings());
    });

    // 旋转角度按钮
    dom.rotationOptions.addEventListener("click", (event) => {
      const btn = event.target.closest(".rotation-btn");
      if (!btn) return;
      const rotation = Number(btn.dataset.rotation);
      debouncedSetSettings({ rotation });
    });

    // 跟随平滑度
    dom.smoothness.addEventListener("input", () => {
      const value = Number(dom.smoothness.value);
      dom.smoothnessValue.value = value.toFixed(2);
      debouncedSetSettings({ smoothness: value });
    });

    // 点击粒子特效开关
    dom.clickEffect.addEventListener("change", () => {
      debouncedSetSettings({ clickEffect: dom.clickEffect.checked });
    });

    // 导出设置
    dom.exportBtn.addEventListener("click", async () => {
      try {
        const result = await window.gifFollower.exportSettings();
        if (result.success) {
          dom.fileTip.textContent = `设置已导出到 ${result.path}`;
        } else if (!result.canceled) {
          dom.fileTip.textContent = "导出失败，请重试";
        }
      } catch (error) {
        console.warn("导出设置失败:", error);
        dom.fileTip.textContent = "导出失败，请重试";
      }
    });

    // 导入设置
    dom.importBtn.addEventListener("click", async () => {
      try {
        const result = await window.gifFollower.importSettings();
        if (result.success) {
          applySettings(result.settings);
          dom.fileTip.textContent = "设置导入成功，已应用新配置";
        } else if (!result.canceled) {
          dom.fileTip.textContent = "导入失败，请检查文件格式";
        }
      } catch (error) {
        console.warn("导入设置失败:", error);
        dom.fileTip.textContent = "导入失败，请检查文件格式";
      }
    });

    // 快捷键录制
    dom.shortcutRecordBtn.addEventListener("click", async () => {
      if (isRecordingShortcut) return;
      isRecordingShortcut = true;
      dom.shortcutRecordBtn.textContent = "录制中...";
      dom.shortcutTip.textContent = "请按下新的快捷键组合（按 Esc 取消）";

      const accelerator = await new Promise((resolve) => {
        function handleKey(e) {
          if (e.key === "Escape") {
            window.removeEventListener("keydown", handleKey);
            resolve(null);
            return;
          }
          // 忽略单独按修饰键
          if (!e.key || e.key === "Meta" || e.key === "Shift" || e.key === "Alt" || e.key === "Control") return;

          const mods = [];
          if (e.metaKey) mods.push("CommandOrControl");
          if (e.shiftKey) mods.push("Shift");
          if (e.altKey) mods.push("Alt");
          if (e.ctrlKey && !e.metaKey) mods.push("Control");
          if (!mods.length) return;

          // 规范化按键名
          let key = e.key;
          if (key.length === 1) key = key.toUpperCase();
          else if (key === " ") key = "Space";
          else key = key.charAt(0).toUpperCase() + key.slice(1);

          const combo = [...mods, key].join("+");
          window.removeEventListener("keydown", handleKey);
          resolve(combo);
        }
        window.addEventListener("keydown", handleKey);
      });

      isRecordingShortcut = false;
      dom.shortcutRecordBtn.textContent = "重新录制";

      if (accelerator) {
        try {
          const result = await window.gifFollower.setShortcut(accelerator);
          if (result.success) {
            dom.shortcutInput.value = formatShortcut(accelerator);
            dom.shortcutTip.textContent = "快捷键已更新，立即生效";
          } else {
            dom.shortcutTip.textContent = "快捷键设置失败，可能被其他应用占用";
          }
        } catch (error) {
          console.warn("快捷键设置失败:", error);
          dom.shortcutTip.textContent = "快捷键设置失败，请选择其他组合";
        }
      } else {
        dom.shortcutTip.textContent = "已取消录制";
      }
    });

    // 伴生 GIF 添加
    dom.addCompanionBtn.addEventListener("click", async () => {
      const src = dom.companionSelect.value;
      if (!src) {
        dom.companionTip.textContent = "请先选择一个 GIF";
        return;
      }
      const selectedOpt = dom.companionSelect.selectedOptions[0];
      const name = selectedOpt ? selectedOpt.textContent : "伴生 GIF";
      try {
        const result = await window.gifFollower.addCompanion(src, name);
        if (result.success) {
          applySettings(result.settings);
          dom.companionTip.textContent = `已添加伴生 GIF：${name}`;
          dom.companionSelect.value = "";
        } else {
          dom.companionTip.textContent = result.error || "添加失败";
        }
      } catch (error) {
        console.warn("添加伴生 GIF 失败:", error);
        dom.companionTip.textContent = "添加失败，请重试";
      }
    });

    // 帧截取
    dom.frameStart.addEventListener("input", () => {
      const val = Number(dom.frameStart.value);
      dom.frameStartValue.value = val;
      // 确保起始帧不超过结束帧
      const endVal = Number(dom.frameEnd.value);
      if (val > endVal && endVal > 0) {
        dom.frameEnd.value = val;
        dom.frameEndValue.value = val;
      }
    });
    dom.frameStart.addEventListener("change", () => {
      debouncedSetSettings({
        frameStart: Number(dom.frameStart.value),
        frameEnd: Number(dom.frameEnd.value)
      });
    });

    dom.frameEnd.addEventListener("input", () => {
      const val = Number(dom.frameEnd.value);
      dom.frameEndValue.value = val;
      // 确保结束帧不小于起始帧
      const startVal = Number(dom.frameStart.value);
      if (val < startVal && val > 0) {
        dom.frameStart.value = val;
        dom.frameStartValue.value = val;
      }
    });
    dom.frameEnd.addEventListener("change", () => {
      debouncedSetSettings({
        frameStart: Number(dom.frameStart.value),
        frameEnd: Number(dom.frameEnd.value)
      });
    });

    dom.resetFrameBtn.addEventListener("click", () => {
      dom.frameStart.value = 0;
      dom.frameStartValue.value = 0;
      dom.frameEnd.value = 0;
      dom.frameEndValue.value = 0;
      debouncedSetSettings({ frameStart: 0, frameEnd: 0 });
    });

    // 帧信息更新
    window.gifFollower.onFrameInfo((info) => {
      const count = (info && info.count) || 0;
      const maxIdx = count > 0 ? count - 1 : 0;
      dom.frameCountValue.textContent = count > 0 ? `共 ${count} 帧` : "无法获取帧数";
      dom.frameStart.max = maxIdx;
      dom.frameEnd.max = maxIdx;
    });

    window.gifFollower.onSettingsUpdate(applySettings);
  }

  window.addEventListener("DOMContentLoaded", async () => {
    try {
      const [loadedPresets, loadedLibrary, loadedSettings, autoStart] = await Promise.all([
        window.gifFollower.getPresets(),
        window.gifFollower.getLibrary(),
        window.gifFollower.getSettings(),
        window.gifFollower.getAutoStart()
      ]);
      presets = loadedPresets;
      library = loadedLibrary;
      renderPresets();
      applySettings(loadedSettings);
      dom.autoStart.checked = autoStart;
      renderLibrary();
      populateCompanionSelect();
      bindEvents();
      // 获取初始帧信息（overlay 可能已经解码完成）
      try {
        const info = await window.gifFollower.getFrameInfo();
        if (info && info.count > 0) {
          const maxIdx = info.count - 1;
          dom.frameCountValue.textContent = `共 ${info.count} 帧`;
          dom.frameStart.max = maxIdx;
          dom.frameEnd.max = maxIdx;
        }
      } catch (_) {
        // 帧信息尚未就绪，等待 overlay 报告
      }
    } catch (error) {
      console.warn("控制面板初始化失败:", error);
      dom.fileTip.textContent = "控制面板初始化失败，请重启程序。";
    }
  });
})();
