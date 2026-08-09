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
    rotation: 0,
    smoothness: 0.18,
    clickEffect: false,
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
    toggleFromHero: document.getElementById("toggleFromHero"),
    rotationValue: document.getElementById("rotationValue"),
    rotationButtons: document.querySelectorAll(".rotation-btn"),
    smoothnessInput: document.getElementById("smoothnessInput"),
    smoothnessValue: document.getElementById("smoothnessValue"),
    clickEffectInput: document.getElementById("clickEffectInput")
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

  // ===== IndexedDB 图片存储 =====
  // 上传的图片以 Blob 存 IndexedDB（容量远大于 localStorage 的 ~5MB 配额），
  // settings.src 只保存 "idb:custom" 标记，localStorage 里不再有巨型 dataURL。
  const IDB_NAME = "gifMouseFollowerDB";
  const IDB_STORE = "images";
  const IDB_CUSTOM_KEY = "custom";
  const IDB_SRC_PREFIX = "idb:";
  const IDB_CUSTOM_SRC = IDB_SRC_PREFIX + IDB_CUSTOM_KEY;

  let idbObjectUrl = "";

  function isIdbSrc(src) {
    return typeof src === "string" && src.startsWith(IDB_SRC_PREFIX);
  }

  function openImageDB() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("当前浏览器不支持 IndexedDB"));
        return;
      }
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(IDB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveImageToDB(blob) {
    const db = await openImageDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(blob, IDB_CUSTOM_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadImageFromDB() {
    const db = await openImageDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(IDB_CUSTOM_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result || "")));
      reader.addEventListener("error", () => reject(reader.error || new Error("读取文件失败")));
      reader.readAsDataURL(file);
    });
  }

  // 上传统一入口：优先 IndexedDB，不可用时回退 dataURL
  async function applyUploadedFile(file, successTip) {
    try {
      await saveImageToDB(file);
      if (idbObjectUrl) URL.revokeObjectURL(idbObjectUrl);
      idbObjectUrl = URL.createObjectURL(file);
      settings.src = IDB_CUSTOM_SRC;
    } catch (error) {
      console.warn("IndexedDB 存储失败，回退到 dataURL。", error);
      settings.src = await readFileAsDataURL(file);
    }
    settings.name = file.name || "本地 GIF";
    settings.presetId = "custom";
    applySettings(true);
    dom.uploadTip.textContent = successTip;
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
    settings.rotation = clampNumber(settings.rotation, 0, 360, DEFAULT_SETTINGS.rotation);
    settings.smoothness = clampNumber(settings.smoothness, 0.05, 0.5, DEFAULT_SETTINGS.smoothness);
    settings.clickEffect = Boolean(settings.clickEffect);
    settings.darkMode = Boolean(settings.darkMode);
    settings.panelCollapsed = Boolean(settings.panelCollapsed);
    settings.src = settings.src || DEFAULT_SETTINGS.src;
    settings.name = settings.name || DEFAULT_SETTINGS.name;
    settings.presetId = settings.presetId || "";
  }

  function applySettings(shouldSave) {
    normalizeSettings();

    // idb: 标记需要换成运行时的 objectURL 才能赋给 <img>
    const displaySrc = isIdbSrc(settings.src) ? idbObjectUrl : settings.src;
    if (displaySrc && currentSrc !== displaySrc) {
      dom.follower.src = displaySrc;
      dom.preview.src = displaySrc;
      currentSrc = displaySrc;
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

    dom.smoothnessInput.value = String(settings.smoothness);
    dom.smoothnessValue.value = String(settings.smoothness);
    dom.clickEffectInput.checked = settings.clickEffect;
    dom.rotationValue.textContent = `${settings.rotation}°`;
    updateRotationButtons();

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
    const ease = settings.smoothness || 0.18;
    pointer.currentX += (pointer.targetX - pointer.currentX) * ease;
    pointer.currentY += (pointer.targetY - pointer.currentY) * ease;

    const x = pointer.currentX + settings.offsetX;
    const y = pointer.currentY + settings.offsetY;
    const flipX = settings.flipH ? -1 : 1;
    const flipY = settings.flipV ? -1 : 1;

    dom.follower.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${flipX}, ${flipY}) rotate(${settings.rotation}deg)`;

    updateParticles();
    requestAnimationFrame(animateFollower);
  }

  function updateRotationButtons() {
    dom.rotationButtons.forEach((button) => {
      const active = Number(button.dataset.rotation) === settings.rotation;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  const particles = [];
  let particleCanvas = null;
  let particleCtx = null;

  function createParticleCanvas() {
    particleCanvas = document.createElement("canvas");
    particleCanvas.id = "particleCanvas";
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
    particleCtx = particleCanvas.getContext("2d");
    document.body.appendChild(particleCanvas);

    window.addEventListener("resize", () => {
      particleCanvas.width = window.innerWidth;
      particleCanvas.height = window.innerHeight;
    });
  }

  function spawnParticles(x, y) {
    const count = 6 + Math.floor(Math.random() * 3);
    const colors = ["#ffd700", "#ff69b4", "#58a6ff", "#34c759", "#ff7e5f"];
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const speed = 2 + Math.random() * 3;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        born: now,
        life: 1,
        size: 8 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI
      });
    }
  }

  function drawStar(ctx, particle) {
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    const outer = particle.size * particle.life;
    const inner = outer * 0.4;
    for (let i = 0; i < 5; i++) {
      const outerAngle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const innerAngle = outerAngle + Math.PI / 5;
      const method = i === 0 ? "moveTo" : "lineTo";
      ctx[method](Math.cos(outerAngle) * outer, Math.sin(outerAngle) * outer);
      ctx.lineTo(Math.cos(innerAngle) * inner, Math.sin(innerAngle) * inner);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function updateParticles() {
    if (!particleCtx) {
      return;
    }
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    const now = performance.now();
    const duration = 500;
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      const elapsed = now - particle.born;
      particle.life = 1 - elapsed / duration;

      if (particle.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.12;
      particle.vx *= 0.98;
      particle.rotation += 0.12;

      drawStar(particleCtx, particle);
    }
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

    applyUploadedFile(file, "本地图片已应用。").catch((error) => {
      console.warn(error);
      dom.uploadTip.textContent = "读取文件失败，请换一个 GIF 再试。";
    });
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

    dom.rotationButtons.forEach((button) => {
      button.addEventListener("click", () => {
        settings.rotation = Number(button.dataset.rotation);
        applySettings(true);
      });
    });

    dom.smoothnessInput.addEventListener("input", () => {
      settings.smoothness = Number(dom.smoothnessInput.value);
      applySettings(true);
    });

    dom.clickEffectInput.addEventListener("change", () => {
      settings.clickEffect = dom.clickEffectInput.checked;
      applySettings(true);
    });

    document.addEventListener("click", (event) => {
      if (!settings.clickEffect) {
        return;
      }
      spawnParticles(event.clientX, event.clientY);
    });

    // 拖拽上传
    document.addEventListener("dragover", (event) => {
      event.preventDefault();
      document.body.classList.add("drag-over");
    });
    document.addEventListener("dragleave", (event) => {
      if (event.relatedTarget === null) {
        document.body.classList.remove("drag-over");
      }
    });
    document.addEventListener("drop", (event) => {
      event.preventDefault();
      document.body.classList.remove("drag-over");
      const file = event.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) {
        return;
      }
      applyUploadedFile(file, "拖拽上传成功！").catch((error) => {
        console.warn(error);
        dom.uploadTip.textContent = "读取文件失败，请换一个 GIF 再试。";
      });
    });
  }

  async function init() {
    renderPresetButtons();
    bindEvents();
    createParticleCanvas();

    // 恢复上次上传的图片：settings.src 是 idb: 标记时，从 IndexedDB 取出 Blob 生成 objectURL
    if (isIdbSrc(settings.src)) {
      try {
        const blob = await loadImageFromDB();
        if (blob) {
          idbObjectUrl = URL.createObjectURL(blob);
        } else {
          // IndexedDB 数据已被清理，回退到默认预设
          settings.src = DEFAULT_SETTINGS.src;
          settings.name = DEFAULT_SETTINGS.name;
          settings.presetId = DEFAULT_SETTINGS.presetId;
        }
      } catch (error) {
        console.warn("读取 IndexedDB 图片失败，回退到默认预设。", error);
        settings.src = DEFAULT_SETTINGS.src;
        settings.name = DEFAULT_SETTINGS.name;
        settings.presetId = DEFAULT_SETTINGS.presetId;
      }
    }

    applySettings(false);
    animateFollower();
  }

  init();
})();
