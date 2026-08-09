(function () {
  "use strict";

  const STORAGE_KEY = "gifMouseFollower.settings.v1";

  const PRESETS = [
    { id: "line-dog", name: "线条小狗", src: "./assets/line-dog.gif" },
    { id: "hello-kitty", name: "Hello Kitty", src: "./assets/hello-kitty.gif" },
    { id: "cinnamoroll", name: "玉桂狗", src: "./assets/cinnamoroll.gif" },
    { id: "melody", name: "美乐蒂", src: "./assets/melody.gif" },
    { id: "kuromi", name: "库洛米", src: "./assets/kuromi.gif" }
  ];

  const DEFAULT_SETTINGS = {
    enabled: true,
    src: PRESETS[0].src,
    name: PRESETS[0].name,
    presetId: PRESETS[0].id,
    size: 72,
    offsetX: 28,
    offsetY: 28,
    opacity: 100,
    flipH: false,
    flipV: false,
    darkMode: false,
    panelCollapsed: false
  };

  const dom = {
    follower: document.getElementById("gifFollower"),
    preview: document.getElementById("previewImage"),
    currentName: document.getElementById("currentName"),
    enabled: document.getElementById("enabledInput"),
    upload: document.getElementById("gifUpload"),
    uploadTip: document.getElementById("uploadTip"),
    size: document.getElementById("sizeInput"),
    sizeValue: document.getElementById("sizeValue"),
    offsetX: document.getElementById("offsetXInput"),
    offsetXValue: document.getElementById("offsetXValue"),
    offsetY: document.getElementById("offsetYInput"),
    offsetYValue: document.getElementById("offsetYValue"),
    opacity: document.getElementById("opacityInput"),
    opacityValue: document.getElementById("opacityValue"),
    flipH: document.getElementById("flipHInput"),
    flipV: document.getElementById("flipVInput"),
    darkMode: document.getElementById("darkModeInput"),
    presetGrid: document.getElementById("presetGrid"),
    reset: document.getElementById("resetButton"),
    panel: document.getElementById("controlPanel"),
    panelToggle: document.getElementById("panelToggle"),
    panelStatus: document.getElementById("panelStatus"),
    toggleFromHero: document.getElementById("toggleFromHero")
  };

  const pointer = {
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
    currentX: window.innerWidth / 2,
    currentY: window.innerHeight / 2,
    inside: false
  };

  let settings = loadSettings();
  let currentSrc = "";

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_SETTINGS };
      }

      return {
        ...DEFAULT_SETTINGS,
        ...JSON.parse(raw)
      };
    } catch (error) {
      console.warn("读取本地设置失败，已使用默认设置。", error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  let saveSettingsTimer = null;
  function saveSettings() {
    if (saveSettingsTimer) clearTimeout(saveSettingsTimer);
    saveSettingsTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        dom.uploadTip.textContent = "设置已自动保存到本机浏览器。";
      } catch (error) {
        console.warn("保存本地设置失败。", error);
        dom.uploadTip.textContent = "当前设置可使用，但浏览器存储空间不足，可能无法完整保存上传的图片。";
      }
    }, 200);
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, number));
  }

  function normalizeSettings() {
    settings.size = clampNumber(settings.size, 20, 200, DEFAULT_SETTINGS.size);
    settings.offsetX = clampNumber(settings.offsetX, -120, 120, DEFAULT_SETTINGS.offsetX);
    settings.offsetY = clampNumber(settings.offsetY, -120, 120, DEFAULT_SETTINGS.offsetY);
    settings.opacity = clampNumber(settings.opacity, 20, 100, DEFAULT_SETTINGS.opacity);
    settings.enabled = Boolean(settings.enabled);
    settings.flipH = Boolean(settings.flipH);
    settings.flipV = Boolean(settings.flipV);
    settings.darkMode = Boolean(settings.darkMode);
    settings.panelCollapsed = Boolean(settings.panelCollapsed);
    settings.src = settings.src || DEFAULT_SETTINGS.src;
    settings.name = settings.name || DEFAULT_SETTINGS.name;
    settings.presetId = settings.presetId || "";
  }

  function applySettings(shouldSave) {
    normalizeSettings();

    if (currentSrc !== settings.src) {
      dom.follower.src = settings.src;
      dom.preview.src = settings.src;
      currentSrc = settings.src;
    }

    dom.currentName.textContent = settings.name;

    dom.follower.style.width = `${settings.size}px`;
    dom.follower.style.height = `${settings.size}px`;

    dom.enabled.checked = settings.enabled;
    dom.size.value = String(settings.size);
    dom.offsetX.value = String(settings.offsetX);
    dom.offsetY.value = String(settings.offsetY);
    dom.opacity.value = String(settings.opacity);
    dom.flipH.checked = settings.flipH;
    dom.flipV.checked = settings.flipV;
    dom.darkMode.checked = settings.darkMode;

    document.body.setAttribute("data-theme", settings.darkMode ? "dark" : "light");

    dom.sizeValue.value = `${settings.size}px`;
    dom.offsetXValue.value = `${settings.offsetX}px`;
    dom.offsetYValue.value = `${settings.offsetY}px`;
    dom.opacityValue.value = `${settings.opacity}%`;

    dom.panel.classList.toggle("is-collapsed", settings.panelCollapsed);
    dom.panelToggle.setAttribute("aria-expanded", String(!settings.panelCollapsed));

    dom.panelStatus.textContent = settings.enabled ? "跟随已开启" : "跟随已关闭";
    dom.toggleFromHero.textContent = settings.enabled ? "关闭跟随" : "开启跟随";

    updatePresetButtons();
    updateFollowerVisibility();

    if (shouldSave) {
      saveSettings();
    }
  }

  function updateFollowerVisibility() {
    const visible = settings.enabled && pointer.inside;
    dom.follower.style.opacity = visible ? String(settings.opacity / 100) : "0";
  }

  function renderPresetButtons() {
    const fragment = document.createDocumentFragment();

    PRESETS.forEach((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-button";
      button.dataset.presetId = preset.id;
      button.setAttribute("role", "listitem");
      button.setAttribute("aria-label", `使用${preset.name}预设`);

      const image = document.createElement("img");
      image.src = preset.src;
      image.alt = "";

      const label = document.createElement("span");
      label.textContent = preset.name;

      button.append(image, label);
      button.addEventListener("click", () => {
        settings.src = preset.src;
        settings.name = preset.name;
        settings.presetId = preset.id;
        dom.upload.value = "";
        applySettings(true);
      });

      fragment.append(button);
    });

    dom.presetGrid.append(fragment);
  }

  function updatePresetButtons() {
    const buttons = dom.presetGrid.querySelectorAll(".preset-button");
    buttons.forEach((button) => {
      const active = button.dataset.presetId === settings.presetId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setPointerPosition(clientX, clientY) {
    pointer.targetX = clientX;
    pointer.targetY = clientY;
    pointer.inside = true;
    updateFollowerVisibility();
  }

  function animateFollower() {
    const ease = 0.18;
    pointer.currentX += (pointer.targetX - pointer.currentX) * ease;
    pointer.currentY += (pointer.targetY - pointer.currentY) * ease;

    const x = pointer.currentX + settings.offsetX;
    const y = pointer.currentY + settings.offsetY;
    const flipX = settings.flipH ? -1 : 1;
    const flipY = settings.flipV ? -1 : 1;

    dom.follower.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${flipX}, ${flipY})`;
    requestAnimationFrame(animateFollower);
  }

  function handleUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      dom.uploadTip.textContent = "请选择 GIF 或图片文件。";
      return;
    }

    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const result = String(reader.result || "");
      settings.src = result;
      settings.name = file.name || "本地 GIF";
      settings.presetId = "custom";
      applySettings(true);
      dom.uploadTip.textContent = "本地图片已应用。";
    });

    reader.addEventListener("error", () => {
      dom.uploadTip.textContent = "读取文件失败，请换一个 GIF 再试。";
    });

    reader.readAsDataURL(file);
  }

  function bindEvents() {
    window.addEventListener("pointermove", (event) => {
      setPointerPosition(event.clientX, event.clientY);
    }, { passive: true });

    window.addEventListener("pointerenter", (event) => {
      setPointerPosition(event.clientX, event.clientY);
    }, { passive: true });

    document.documentElement.addEventListener("pointerleave", () => {
      pointer.inside = false;
      updateFollowerVisibility();
    });

    window.addEventListener("blur", () => {
      pointer.inside = false;
      updateFollowerVisibility();
    });

    window.addEventListener("focus", () => {
      updateFollowerVisibility();
    });

    dom.enabled.addEventListener("change", () => {
      settings.enabled = dom.enabled.checked;
      applySettings(true);
    });

    dom.toggleFromHero.addEventListener("click", () => {
      settings.enabled = !settings.enabled;
      applySettings(true);
    });

    dom.upload.addEventListener("change", handleUpload);

    dom.size.addEventListener("input", () => {
      settings.size = Number(dom.size.value);
      applySettings(true);
    });

    dom.offsetX.addEventListener("input", () => {
      settings.offsetX = Number(dom.offsetX.value);
      applySettings(true);
    });

    dom.offsetY.addEventListener("input", () => {
      settings.offsetY = Number(dom.offsetY.value);
      applySettings(true);
    });

    dom.opacity.addEventListener("input", () => {
      settings.opacity = Number(dom.opacity.value);
      applySettings(true);
    });

    dom.flipH.addEventListener("change", () => {
      settings.flipH = dom.flipH.checked;
      applySettings(true);
    });

    dom.flipV.addEventListener("change", () => {
      settings.flipV = dom.flipV.checked;
      applySettings(true);
    });

    dom.darkMode.addEventListener("change", () => {
      settings.darkMode = dom.darkMode.checked;
      document.body.setAttribute("data-theme", settings.darkMode ? "dark" : "light");
      applySettings(true);
    });

    dom.panelToggle.addEventListener("click", () => {
      settings.panelCollapsed = !settings.panelCollapsed;
      applySettings(true);
    });

    dom.reset.addEventListener("click", () => {
      settings = { ...DEFAULT_SETTINGS };
      dom.upload.value = "";
      applySettings(true);
    });
  }

  function init() {
    renderPresetButtons();
    bindEvents();
    applySettings(false);
    animateFollower();
  }

  init();
})();
