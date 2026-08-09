(function () {
  "use strict";

  const placeholder = document.getElementById("gifFollower");
  const canvas = document.createElement("canvas");
  canvas.id = "gifCanvas";
  canvas.style.position = "fixed";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.willChange = "transform, opacity";
  canvas.style.opacity = "0";
  canvas.style.zIndex = "2147483647";
  placeholder.parentNode.replaceChild(canvas, placeholder);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const frameCanvas = document.createElement("canvas");
  const frameCtx = frameCanvas.getContext("2d", { willReadFrequently: true });

  // 粒子特效层：独立 canvas，覆盖整个 overlay 窗口，不影响 GIF 渲染
  const particleCanvas = document.createElement("canvas");
  particleCanvas.id = "particleCanvas";
  particleCanvas.style.position = "fixed";
  particleCanvas.style.left = "0";
  particleCanvas.style.top = "0";
  particleCanvas.style.pointerEvents = "none";
  particleCanvas.style.zIndex = "2147483647";
  document.body.appendChild(particleCanvas);
  const particleCtx = particleCanvas.getContext("2d");

  const particles = [];
  const PARTICLE_LIFETIME = 500; // 粒子生命周期（毫秒）
  let lastParticleTime = 0;

  function resizeParticleCanvas() {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
  }
  resizeParticleCanvas();
  window.addEventListener("resize", resizeParticleCanvas);

  let bounds = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  let settings = {
    enabled: true,
    src: "",
    size: 72,
    offsetX: 28,
    offsetY: 28,
    opacity: 100,
    removeBackgroundMode: "smart",
    flipH: false,
    flipV: false,
    playbackSpeed: 1.0,
    rotation: 0,
    smoothness: 0.18,
    clickEffect: false,
    frameStart: 0,
    frameEnd: 0
  };

  const pointer = {
    globalX: -9999,
    globalY: -9999,
    currentX: -9999,
    currentY: -9999,
    inside: false
  };

  let decoded = { width: 1, height: 1, frames: [] };
  let currentFrameIndex = 0;
  let lastFrameTime = 0;
  let decodeToken = 0;

  // 背景移除缓存：避免每帧重复计算 flood fill。
  // 限制容量，防止长 GIF + 大尺寸时缓存无限增长（Map 按插入顺序淘汰最旧条目）
  const BG_CACHE_MAX_ENTRIES = 60;
  let bgRemovalCache = new Map();
  let bgCacheKey = "";

  function cacheBgFrame(frameIndex, imageData) {
    if (bgRemovalCache.size >= BG_CACHE_MAX_ENTRIES) {
      const oldestKey = bgRemovalCache.keys().next().value;
      bgRemovalCache.delete(oldestKey);
    }
    bgRemovalCache.set(frameIndex, imageData);
  }

  function computeBgCacheKey() {
    const mode = settings.removeBackgroundMode || "smart";
    const tol = settings.colorTolerance || 30;
    const picked = settings.pickedColor
      ? `${settings.pickedColor.r},${settings.pickedColor.g},${settings.pickedColor.b},${settings.pickedColor.xRatio},${settings.pickedColor.yRatio}`
      : "none";
    return `${mode}:${tol}:${picked}:${canvas.width}x${canvas.height}`;
  }

  function base64ToUint8(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function byteStream(bytes) {
    let pos = 0;
    return {
      readByte: () => bytes[pos++],
      readUnsigned: () => bytes[pos++] | (bytes[pos++] << 8),
      readString: (length) => {
        let out = "";
        for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[pos++]);
        return out;
      },
      readBytes: (length) => bytes.slice(pos, pos += length),
      readSubBlocks: () => {
        const chunks = [];
        let total = 0;
        for (;;) {
          const size = bytes[pos++];
          if (!size) break;
          chunks.push(bytes.slice(pos, pos + size));
          pos += size;
          total += size;
        }
        const out = new Uint8Array(total);
        let offset = 0;
        chunks.forEach((chunk) => {
          out.set(chunk, offset);
          offset += chunk.length;
        });
        return out;
      },
      skipSubBlocks: () => {
        for (;;) {
          const size = bytes[pos++];
          if (!size) break;
          pos += size;
        }
      }
    };
  }

  function readColorTable(stream, size) {
    const table = [];
    for (let i = 0; i < size; i += 1) {
      table.push([stream.readByte(), stream.readByte(), stream.readByte()]);
    }
    return table;
  }

  function readCode(data, state) {
    let code = 0;
    for (let i = 0; i < state.size; i += 1) {
      const byte = data[state.bit >> 3] || 0;
      const bit = (byte >> (state.bit & 7)) & 1;
      code |= bit << i;
      state.bit += 1;
    }
    return code;
  }

  function lzwDecode(minCodeSize, data) {
    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let dict = [];
    const output = [];
    const state = { bit: 0, size: codeSize };
    let prev = null;

    function reset() {
      dict = [];
      for (let i = 0; i < clearCode; i += 1) dict[i] = [i];
      dict[clearCode] = [];
      dict[endCode] = null;
      codeSize = minCodeSize + 1;
      state.size = codeSize;
      prev = null;
    }

    reset();
    while (state.bit < data.length * 8) {
      let code = readCode(data, state);
      if (code === clearCode) {
        reset();
        continue;
      }
      if (code === endCode) break;

      let entry;
      if (dict[code]) {
        entry = dict[code].slice();
      } else if (code === dict.length && prev) {
        entry = prev.concat(prev[0]);
      } else {
        break;
      }

      output.push(...entry);
      if (prev) {
        dict.push(prev.concat(entry[0]));
        if (dict.length === (1 << codeSize) && codeSize < 12) {
          codeSize += 1;
          state.size = codeSize;
        }
      }
      prev = entry;
    }
    return output;
  }

  function deinterlace(pixels, width) {
    const rows = Math.ceil(pixels.length / width);
    const out = new Array(pixels.length);
    const passes = [
      [0, 8],
      [4, 8],
      [2, 4],
      [1, 2]
    ];
    let fromRow = 0;
    passes.forEach(([start, step]) => {
      for (let row = start; row < rows; row += step) {
        const from = fromRow * width;
        const to = row * width;
        for (let x = 0; x < width; x += 1) out[to + x] = pixels[from + x];
        fromRow += 1;
      }
    });
    return out;
  }

  function decodeGif(bytes) {
    const stream = byteStream(bytes);
    const header = stream.readString(6);
    if (!header.startsWith("GIF")) throw new Error("不是 GIF 文件");

    const width = stream.readUnsigned();
    const height = stream.readUnsigned();
    const packed = stream.readByte();
    const hasGct = (packed & 0x80) !== 0;
    const gctSize = 1 << ((packed & 0x07) + 1);
    stream.readByte();
    stream.readByte();
    const gct = hasGct ? readColorTable(stream, gctSize) : [];

    const canvasData = new Uint8ClampedArray(width * height * 4);
    const frames = [];
    let gce = { disposal: 0, delay: 80, transparentIndex: null };

    // 解码内存上限：每帧按全画布 ImageData 存储（宽×高×4 字节），
    // 超长 GIF 无上限会撑爆内存，超过阈值即截断并保留已解码部分
    const MAX_DECODE_BYTES = 200 * 1024 * 1024; // 200MB
    const bytesPerFrame = width * height * 4;
    const maxFrames = Math.max(1, Math.floor(MAX_DECODE_BYTES / bytesPerFrame));

    for (;;) {
      const sentinel = stream.readByte();
      if (sentinel === 0x3b || sentinel === undefined) break;

      if (sentinel === 0x21) {
        const label = stream.readByte();
        if (label === 0xf9) {
          stream.readByte();
          const p = stream.readByte();
          const delay = stream.readUnsigned();
          const transparentIndex = stream.readByte();
          stream.readByte();
          gce = {
            disposal: (p >> 2) & 0x07,
            delay: Math.max(20, (delay || 8) * 10),
            transparentIndex: (p & 1) ? transparentIndex : null
          };
        } else {
          stream.skipSubBlocks();
        }
        continue;
      }

      if (sentinel !== 0x2c) break;

      const left = stream.readUnsigned();
      const top = stream.readUnsigned();
      const frameWidth = stream.readUnsigned();
      const frameHeight = stream.readUnsigned();
      const ip = stream.readByte();
      const hasLct = (ip & 0x80) !== 0;
      const interlaced = (ip & 0x40) !== 0;
      const lctSize = 1 << ((ip & 0x07) + 1);
      const colorTable = hasLct ? readColorTable(stream, lctSize) : gct;
      const minCodeSize = stream.readByte();
      const imageData = stream.readSubBlocks();
      let pixels = lzwDecode(minCodeSize, imageData).slice(0, frameWidth * frameHeight);
      if (interlaced) pixels = deinterlace(pixels, frameWidth);

      const before = gce.disposal === 3 ? canvasData.slice() : null;
      for (let y = 0; y < frameHeight; y += 1) {
        for (let x = 0; x < frameWidth; x += 1) {
          const index = pixels[y * frameWidth + x];
          if (index === gce.transparentIndex) continue;
          const color = colorTable[index];
          if (!color) continue;
          const destX = left + x;
          const destY = top + y;
          if (destX < 0 || destY < 0 || destX >= width || destY >= height) continue;
          const offset = (destY * width + destX) * 4;
          canvasData[offset] = color[0];
          canvasData[offset + 1] = color[1];
          canvasData[offset + 2] = color[2];
          canvasData[offset + 3] = 255;
        }
      }

      frames.push({
        delay: gce.delay,
        imageData: new ImageData(new Uint8ClampedArray(canvasData), width, height)
      });

      if (frames.length >= maxFrames) {
        console.warn(`GIF 帧数过多，已按内存上限截断为前 ${maxFrames} 帧`);
        break;
      }

      if (gce.disposal === 2) {
        for (let y = 0; y < frameHeight; y += 1) {
          for (let x = 0; x < frameWidth; x += 1) {
            const destX = left + x;
            const destY = top + y;
            if (destX < 0 || destY < 0 || destX >= width || destY >= height) continue;
            canvasData.fill(0, (destY * width + destX) * 4, (destY * width + destX) * 4 + 4);
          }
        }
      } else if (gce.disposal === 3 && before) {
        canvasData.set(before);
      }
      gce = { disposal: 0, delay: 80, transparentIndex: null };
    }

    return { width, height, frames: frames.length ? frames : [{ delay: 100, imageData: new ImageData(canvasData, width, height) }] };
  }

  /**
   * 白底透明化：根据 removeBackgroundMode 执行不同策略
   * - "off"：不做任何透明化
   * - "smart"：智能抠背景（仅从边缘向内泛洪，墙壁阻挡保护主体）
   * - "preserve-white"：保留所有白色，不做透明化
   * - "pick-color"：手动取色，仅对与点击点连通的同色区域透明化
   */
  function removeWhiteBackground() {
    const mode = settings.removeBackgroundMode || "smart";
    if (mode === "off" || mode === "preserve-white") return;

    if (mode === "pick-color") {
      removePickedColor();
      return;
    }

    let frame;
    try {
      frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (_) {
      return;
    }

    const w = canvas.width;
    const h = canvas.height;
    const data = frame.data;
    const totalPixels = w * h;

    // 第一步：标记"接近白色"的候选像素 + 标记"深色轮廓墙壁"
    const whiteMask = new Uint8Array(totalPixels);
    const wallMask = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i += 1) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      if (r >= 240 && g >= 240 && b >= 240) {
        whiteMask[i] = 1;
      } else if (r < 200 || g < 200 || b < 200) {
        // 任一通道 < 200 视为"墙壁"（轮廓线、深色线条等），flood fill 不能穿过
        wallMask[i] = 1;
      }
    }

    // 第二步：仅从图片四周边缘向内做 flood fill
    // 只以四条边上的白色像素为起点，被墙壁挡住的区域不会被泛洪到
    const visited = new Uint8Array(totalPixels);
    const edgeQueue = [];

    // 收集四条边上的白色像素作为起点
    for (let x = 0; x < w; x += 1) {
      // 上边缘
      const topIdx = x;
      if (whiteMask[topIdx] && !wallMask[topIdx]) edgeQueue.push(topIdx);
      // 下边缘
      const bottomIdx = (h - 1) * w + x;
      if (whiteMask[bottomIdx] && !wallMask[bottomIdx]) edgeQueue.push(bottomIdx);
    }
    for (let y = 1; y < h - 1; y += 1) {
      // 左边缘
      const leftIdx = y * w;
      if (whiteMask[leftIdx] && !wallMask[leftIdx]) edgeQueue.push(leftIdx);
      // 右边缘
      const rightIdx = y * w + (w - 1);
      if (whiteMask[rightIdx] && !wallMask[rightIdx]) edgeQueue.push(rightIdx);
    }

    // 去重
    const uniqueQueue = [];
    const edgeSeen = new Uint8Array(totalPixels);
    for (let i = 0; i < edgeQueue.length; i += 1) {
      const idx = edgeQueue[i];
      if (!edgeSeen[idx]) {
        edgeSeen[idx] = 1;
        uniqueQueue.push(idx);
      }
    }

    // 从边缘起点向内泛洪（不能穿过墙壁）
    const backgroundPixels = [];
    for (let i = 0; i < uniqueQueue.length; i += 1) {
      const start = uniqueQueue[i];
      if (visited[start]) continue;

      const stack = [start];
      visited[start] = 1;
      backgroundPixels.push(start);

      while (stack.length) {
        const cur = stack.pop();
        const cx = cur % w;
        const cy = Math.floor(cur / w);

        const neighbors = [];
        if (cy > 0) neighbors.push(cur - w);
        if (cy < h - 1) neighbors.push(cur + w);
        if (cx > 0) neighbors.push(cur - 1);
        if (cx < w - 1) neighbors.push(cur + 1);

        for (let n = 0; n < neighbors.length; n += 1) {
          const ni = neighbors[n];
          // 必须是白色候选，且不能是墙壁，且未访问过
          if (whiteMask[ni] && !wallMask[ni] && !visited[ni]) {
            visited[ni] = 1;
            backgroundPixels.push(ni);
            stack.push(ni);
          }
        }
      }
    }

    // 第三步：面积 ≥ 5% 才判定为背景进行透明化
    const BACKGROUND_THRESHOLD = totalPixels * 0.05;
    if (backgroundPixels.length < BACKGROUND_THRESHOLD) {
      ctx.putImageData(frame, 0, 0);
      return;
    }

    for (let i = 0; i < backgroundPixels.length; i += 1) {
      const idx = backgroundPixels[i];
      const rVal = data[idx * 4];
      const gVal = data[idx * 4 + 1];
      const bVal = data[idx * 4 + 2];
      const minC = Math.min(rVal, gVal, bVal);

      if (minC >= 245) {
        data[idx * 4 + 3] = 0;
      } else {
        // 保留边缘轻微半透明过渡，避免生硬锯齿
        const t = Math.min(1, (245 - minC) / 5);
        data[idx * 4 + 3] = Math.round(data[idx * 4 + 3] * t);
      }
    }

    ctx.putImageData(frame, 0, 0);
  }

  /**
   * 手动取色透明化：仅对与点击点连通、且在容差范围内的像素做透明化
   * 连通判定不能穿过与取色差异超出容差的像素（被轮廓线挡住就停止泛洪）
   */
  function removePickedColor() {
    const picked = settings.pickedColor;
    if (!picked) return;

    let frame;
    try {
      frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (_) {
      return;
    }

    const w = canvas.width;
    const h = canvas.height;
    const data = frame.data;
    const totalPixels = w * h;
    const threshold = settings.colorTolerance || 30; // 颜色容差（0-100）

    // 第一步：标记所有在容差范围内的像素（候选连通区域）
    const candidateMask = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i += 1) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const dr = r - picked.r;
      const dg = g - picked.g;
      const db = b - picked.b;
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);
      if (distance <= threshold) {
        candidateMask[i] = 1;
      }
    }

    // 第二步：用比例换算画布坐标，从点击点坐标开始 flood fill，只泛洪候选像素
    // 主体内部的同色区域只要和点击点不连通，就不会被误伤
    const xRatio = typeof picked.xRatio === "number" ? picked.xRatio : 0;
    const yRatio = typeof picked.yRatio === "number" ? picked.yRatio : 0;
    const clickX = Math.max(0, Math.min(Math.round(xRatio * w), w - 1));
    const clickY = Math.max(0, Math.min(Math.round(yRatio * h), h - 1));
    const startIdx = clickY * w + clickX;

    if (!candidateMask[startIdx]) {
      ctx.putImageData(frame, 0, 0);
      return;
    }

    const visited = new Uint8Array(totalPixels);
    const matchedPixels = [];
    const stack = [startIdx];
    visited[startIdx] = 1;
    matchedPixels.push(startIdx);

    while (stack.length) {
      const cur = stack.pop();
      const cx = cur % w;
      const cy = Math.floor(cur / w);

      const neighbors = [];
      if (cy > 0) neighbors.push(cur - w);
      if (cy < h - 1) neighbors.push(cur + w);
      if (cx > 0) neighbors.push(cur - 1);
      if (cx < w - 1) neighbors.push(cur + 1);

      for (let n = 0; n < neighbors.length; n += 1) {
        const ni = neighbors[n];
        if (candidateMask[ni] && !visited[ni]) {
          visited[ni] = 1;
          matchedPixels.push(ni);
          stack.push(ni);
        }
      }
    }

    // 第三步：对连通区域内的像素做透明化
    for (let i = 0; i < matchedPixels.length; i += 1) {
      const idx = matchedPixels[i];
      const r = data[idx * 4];
      const g = data[idx * 4 + 1];
      const b = data[idx * 4 + 2];
      const dr = r - picked.r;
      const dg = g - picked.g;
      const db = b - picked.b;
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);

      // 容差为 0 时只去除完全匹配的颜色
      if (threshold === 0) {
        if (distance === 0) {
          data[idx * 4 + 3] = 0;
        }
      } else {
        // 距离越近越透明，保留轻微过渡
        const t = Math.min(1, distance / threshold);
        data[idx * 4 + 3] = Math.round(data[idx * 4 + 3] * t);
      }
    }

    ctx.putImageData(frame, 0, 0);
  }

  function drawCurrentFrame() {
    if (!decoded.frames.length) return;
    const frame = decoded.frames[currentFrameIndex];
    frameCanvas.width = decoded.width;
    frameCanvas.height = decoded.height;
    frameCtx.putImageData(frame.imageData, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(frameCanvas, 0, 0, canvas.width, canvas.height);

    const mode = settings.removeBackgroundMode || "smart";
    if (mode === "off" || mode === "preserve-white") return;

    // 检查缓存键是否变化（设置变更时自动失效）
    const newKey = computeBgCacheKey();
    if (newKey !== bgCacheKey) {
      bgRemovalCache.clear();
      bgCacheKey = newKey;
    }

    // 命中缓存：直接写入已处理的 ImageData，跳过 flood fill
    const cached = bgRemovalCache.get(currentFrameIndex);
    if (cached) {
      ctx.putImageData(cached, 0, 0);
    } else {
      removeWhiteBackground();
      try {
        cacheBgFrame(currentFrameIndex, ctx.getImageData(0, 0, canvas.width, canvas.height));
      } catch (_) {
        // getImageData 在某些跨域场景下可能失败，跳过缓存即可
      }
    }
  }

  async function decodeStaticImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const cvs = document.createElement("canvas");
        cvs.width = img.naturalWidth || 1;
        cvs.height = img.naturalHeight || 1;
        const c = cvs.getContext("2d");
        c.drawImage(img, 0, 0);
        const imageData = c.getImageData(0, 0, cvs.width, cvs.height);
        resolve({
          width: cvs.width,
          height: cvs.height,
          frames: [{ delay: 999999, imageData }]
        });
      };
      img.onerror = () => reject(new Error("无法加载图片"));
      img.src = src;
    });
  }

  async function loadSource(src) {
    const token = ++decodeToken;
    bgRemovalCache.clear();
    try {
      const base64 = await window.gifFollower.readImageBase64(src);
      if (token !== decodeToken) return;
      const bytes = base64ToUint8(base64);
      const isGif = bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
      if (isGif) {
        decoded = decodeGif(bytes);
      } else {
        decoded = await decodeStaticImage(src);
      }
      currentFrameIndex = settings.frameStart > 0
        ? Math.min(settings.frameStart, decoded.frames.length - 1)
        : 0;
      lastFrameTime = performance.now();
      drawCurrentFrame();
      // 报告帧信息给主进程
      if (typeof window.gifFollower.reportFrameInfo === "function") {
        window.gifFollower.reportFrameInfo({ count: decoded.frames.length });
      }
    } catch (error) {
      console.warn("图片解码失败：", error);
      decoded = { width: 1, height: 1, frames: [] };
    }
  }

  function isInside(point) {
    return point.x >= bounds.x && point.y >= bounds.y && point.x <= bounds.x + bounds.width && point.y <= bounds.y + bounds.height;
  }

  function applySize() {
    const s = settings.size;
    canvas.width = Math.max(1, Math.round(s));
    canvas.height = Math.max(1, Math.round(s));
    canvas.style.width = `${s}px`;
    canvas.style.height = `${s}px`;
    drawCurrentFrame();
  }

  function applySettings(next) {
    const prev = settings;
    settings = { ...settings, ...(next || {}) };
    // 背景处理设置变化时清除缓存
    if (prev.removeBackgroundMode !== settings.removeBackgroundMode ||
        prev.colorTolerance !== settings.colorTolerance ||
        JSON.stringify(prev.pickedColor) !== JSON.stringify(settings.pickedColor)) {
      bgRemovalCache.clear();
    }
    applySize();
    if (settings.src && settings.src !== prev.src) loadSource(settings.src);
    if (Array.isArray(settings.companions)) syncCompanions(settings.companions);
    // 帧范围变化时重置到起始帧
    if (prev.frameStart !== settings.frameStart || prev.frameEnd !== settings.frameEnd) {
      const startIdx = settings.frameStart > 0 ? Math.min(settings.frameStart, decoded.frames.length - 1) : 0;
      currentFrameIndex = startIdx;
      lastFrameTime = performance.now();
      drawCurrentFrame();
    }
  }

  // ===== 伴生 GIF 渲染器 =====
  const companionRenderers = [];

  async function loadCompanionSource(renderer) {
    const token = ++renderer.decodeToken;
    try {
      const base64 = await window.gifFollower.readImageBase64(renderer.config.src);
      if (token !== renderer.decodeToken) return;
      const bytes = base64ToUint8(base64);
      const isGif = bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
      if (isGif) {
        renderer.decoded = decodeGif(bytes);
      } else {
        renderer.decoded = await decodeStaticImage(renderer.config.src);
      }
      renderer.currentFrameIndex = 0;
      renderer.lastFrameTime = performance.now();
      drawCompanionFrame(renderer);
    } catch (error) {
      console.warn("伴生 GIF 解码失败：", error);
      renderer.decoded = { width: 1, height: 1, frames: [] };
    }
  }

  function drawCompanionFrame(renderer) {
    if (!renderer.decoded.frames.length) return;
    const frame = renderer.decoded.frames[renderer.currentFrameIndex];
    renderer.frameCanvas.width = renderer.decoded.width;
    renderer.frameCanvas.height = renderer.decoded.height;
    renderer.frameCtx.putImageData(frame.imageData, 0, 0);
    renderer.ctx.clearRect(0, 0, renderer.canvas.width, renderer.canvas.height);
    renderer.ctx.drawImage(renderer.frameCanvas, 0, 0, renderer.canvas.width, renderer.canvas.height);
  }

  function applyCompanionSize(renderer) {
    const s = renderer.config.size;
    renderer.canvas.width = Math.max(1, Math.round(s));
    renderer.canvas.height = Math.max(1, Math.round(s));
    renderer.canvas.style.width = `${s}px`;
    renderer.canvas.style.height = `${s}px`;
    drawCompanionFrame(renderer);
  }

  function createCompanionRenderer(config) {
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.willChange = "transform, opacity";
    canvas.style.opacity = "0";
    canvas.style.zIndex = "2147483646";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const frameCanvas = document.createElement("canvas");
    const frameCtx = frameCanvas.getContext("2d", { willReadFrequently: true });

    const renderer = {
      id: config.id,
      canvas,
      ctx,
      frameCanvas,
      frameCtx,
      decoded: { width: 1, height: 1, frames: [] },
      currentFrameIndex: 0,
      lastFrameTime: 0,
      decodeToken: 0,
      config: { ...config }
    };
    applyCompanionSize(renderer);
    loadCompanionSource(renderer);
    return renderer;
  }

  function destroyCompanionRenderer(renderer) {
    if (renderer.canvas && renderer.canvas.parentNode) {
      renderer.canvas.parentNode.removeChild(renderer.canvas);
    }
  }

  function syncCompanions(companions) {
    const newIds = companions.map((c) => c.id);

    // 移除不再存在的伴生
    for (let i = companionRenderers.length - 1; i >= 0; i--) {
      if (!newIds.includes(companionRenderers[i].id)) {
        destroyCompanionRenderer(companionRenderers[i]);
        companionRenderers.splice(i, 1);
      }
    }

    // 添加新的伴生 / 更新现有伴生配置
    companions.forEach((config) => {
      const existing = companionRenderers.find((r) => r.id === config.id);
      if (existing) {
        const srcChanged = existing.config.src !== config.src;
        existing.config = { ...config };
        if (existing.config.size !== existing.canvas.width) {
          applyCompanionSize(existing);
        }
        if (srcChanged) {
          loadCompanionSource(existing);
        }
      } else {
        companionRenderers.push(createCompanionRenderer(config));
      }
    });
  }

  function updateCompanions(now) {
    const localX = pointer.currentX - bounds.x;
    const localY = pointer.currentY - bounds.y;
    const visible = settings.enabled && pointer.inside;

    companionRenderers.forEach((renderer) => {
      const cfg = renderer.config;
      const frame = renderer.decoded.frames[renderer.currentFrameIndex];
      // 不可见时同样跳过伴生 GIF 的帧推进与绘制
      if (visible && frame && now - renderer.lastFrameTime >= frame.delay) {
        renderer.currentFrameIndex = (renderer.currentFrameIndex + 1) % renderer.decoded.frames.length;
        renderer.lastFrameTime = now;
        drawCompanionFrame(renderer);
      }

      const cx = localX + cfg.offsetX;
      const cy = localY + cfg.offsetY;
      const flipX = cfg.flipH ? -1 : 1;
      const flipY = cfg.flipV ? -1 : 1;
      renderer.canvas.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${flipX}, ${flipY}) rotate(${cfg.rotation || 0}deg)`;
      renderer.canvas.style.opacity = visible ? String(cfg.opacity / 100) : "0";
    });
  }

  /**
   * 绘制五角星粒子
   */
  function drawStar(context, x, y, spikes, outerRadius, innerRadius, rotation, alpha) {
    context.save();
    context.globalAlpha = Math.max(0, alpha);
    context.translate(x, y);
    context.rotate(rotation);
    context.beginPath();
    for (let i = 0; i < spikes * 2; i += 1) {
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI * i) / spikes - Math.PI / 2;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fillStyle = "#ffd54a";
    context.shadowColor = "rgba(255, 213, 74, 0.9)";
    context.shadowBlur = 8;
    context.fill();
    context.restore();
  }

  /**
   * 在指定位置（overlay 本地坐标）生成 6-8 个星星粒子，向外扩散
   */
  function spawnParticles(x, y) {
    const count = 6 + Math.floor(Math.random() * 3); // 6-8 个
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const speed = 1.5 + Math.random() * 2.5;
      const baseSize = 4 + Math.random() * 4;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        baseSize: baseSize,
        size: baseSize,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        life: PARTICLE_LIFETIME,
        maxLife: PARTICLE_LIFETIME
      });
    }
  }

  /**
   * 更新所有粒子的位置、透明度、大小并绘制；生命结束时移除
   */
  function updateParticles(dt) {
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    if (!particles.length) return;
    const step = dt / 16; // 以 16ms 为标准帧步长归一化
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * step;
      p.y += p.vy * step;
      // 阻尼，让粒子逐渐减速
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.rotation += p.rotationSpeed * step;
      const t = p.life / p.maxLife; // 1 -> 0
      p.size = p.baseSize * t;
      drawStar(particleCtx, p.x, p.y, 5, p.size, p.size * 0.5, p.rotation, t);
    }
  }

  function animate(now) {
    const ease = settings.smoothness || 0.18;
    pointer.currentX += (pointer.globalX - pointer.currentX) * ease;
    pointer.currentY += (pointer.globalY - pointer.currentY) * ease;

    const frame = decoded.frames[currentFrameIndex];
    // 解码完成前（或解码失败）frames 为空：跳过本帧绘制但必须继续调度，
    // 否则异常/提前 return 会导致 rAF 循环永久终止
    if (!frame) {
      canvas.style.opacity = "0";
      updateCompanions(now);
      requestAnimationFrame(animate);
      return;
    }
    const speed = settings.playbackSpeed || 1.0;
    const effectiveDelay = frame.delay / speed;
    // 帧范围截取
    const startIdx = settings.frameStart > 0 ? Math.min(settings.frameStart, decoded.frames.length - 1) : 0;
    const endIdx = settings.frameEnd > 0 ? Math.min(settings.frameEnd, decoded.frames.length - 1) : decoded.frames.length - 1;
    const range = Math.max(1, endIdx - startIdx + 1);
    const followerVisible = settings.enabled && pointer.inside;
    // 不可见时跳过帧推进与绘制，降低后台开销
    if (followerVisible && now - lastFrameTime >= effectiveDelay) {
      const offset = ((currentFrameIndex - startIdx + 1) % range + range) % range;
      currentFrameIndex = startIdx + offset;
      lastFrameTime = now;
      drawCurrentFrame();
    }

    const localX = pointer.currentX - bounds.x + settings.offsetX;
    const localY = pointer.currentY - bounds.y + settings.offsetY;
    const flipX = settings.flipH ? -1 : 1;
    const flipY = settings.flipV ? -1 : 1;
    const rotation = settings.rotation || 0;
    canvas.style.transform = `translate3d(${localX}px, ${localY}px, 0) translate(-50%, -50%) scale(${flipX}, ${flipY}) rotate(${rotation}deg)`;
    canvas.style.opacity = followerVisible ? String(settings.opacity / 100) : "0";

    // 粒子特效更新（clickEffect 关闭且无残留粒子时跳过，避免无谓绘制）
    const particleDt = lastParticleTime ? Math.min(64, now - lastParticleTime) : 16;
    lastParticleTime = now;
    if (settings.clickEffect || particles.length) {
      updateParticles(particleDt);
    }

    // 更新伴生 GIF
    updateCompanions(now);

    requestAnimationFrame(animate);
  }

  window.gifFollower.onOverlayInit((payload) => {
    bounds = payload.bounds || bounds;
    resizeParticleCanvas();
  });

  window.gifFollower.onSettingsUpdate(applySettings);

  window.gifFollower.onCursorUpdate((point) => {
    pointer.globalX = point.x;
    pointer.globalY = point.y;
    pointer.inside = isInside(point);
  });

  // 鼠标点击粒子特效：主进程检测到鼠标按键状态变化后发送 mouse:click 事件。
  // preload 暂未暴露 onMouseClick 时不做任何处理，避免阻塞其它逻辑。
  if (typeof window.gifFollower.onMouseClick === "function") {
    window.gifFollower.onMouseClick((point) => {
      if (!settings.clickEffect) return;
      const gx = point && typeof point.x === "number" ? point.x : pointer.globalX;
      const gy = point && typeof point.y === "number" ? point.y : pointer.globalY;
      spawnParticles(gx - bounds.x, gy - bounds.y);
    });
  }

  window.addEventListener("DOMContentLoaded", async () => {
    applySettings(await window.gifFollower.getSettings());
    requestAnimationFrame(animate);
  });
})();
