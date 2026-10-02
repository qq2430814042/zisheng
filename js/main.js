// main.js — 叙事控制、构字互动与数据动画
import { ParticleStage, makeClusterCloud, makeDiskCloud } from "./particles.js";
import { CHARS, LIB, RECOG, STAGES, STAGE_NAMES, drawGlyph, ETY, STROKE_COUNT } from "./glyphs.js";
import { RECOG_STROKES } from "./stroke-counts.js";
import { AmbientAudio, NOTES } from "./audio.js";

const STAGE_NOTE = {
  oracle: NOTES.gong,
  bronze: NOTES.shang,
  seal: NOTES.jue,
  clerical: NOTES.zhi,
  regular: NOTES.yu,
  timeline: NOTES.jue,
  combine: NOTES.gongHigh,
  write: NOTES.yu,
  quiz: NOTES.shang,
  finale: NOTES.gongHigh,
  data: NOTES.zhi,
};

const FONT_STACK = '"ZiShengKai","KaiTi","STKaiti","楷体","Microsoft YaHei",serif';

// 内嵌楷体就绪后再构建粒子（避免用回退字体采样字形）；最多等待 3 秒
await Promise.race([
  document.fonts.load('64px "ZiShengKai"').catch(() => {}),
  new Promise((r) => setTimeout(r, 3000)),
]);

const canvas = document.getElementById("scene");
const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700 || /Mobi/i.test(navigator.userAgent);
const COUNT = isSmall ? 9000 : 20000;

const stage = new ParticleStage(canvas, COUNT);

// ---------- 布局与世界坐标 ----------
const L = (() => {
  const portrait = window.innerHeight > window.innerWidth * 1.05;
  return portrait ? { W: 900, H: 1400, portrait: true } : { W: 1600, H: 900, portrait: false };
})();
const worldH = 10;
const worldW = (worldH * L.W) / L.H;
stage.setWorld(worldW, worldH);

// 桌面端采用"左文右效"布局：粒子效果集中在右半区，左侧留给文字面板
const SIDE = !L.portrait;
const REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
function shiftCloud(pos, dx, dy, s) {
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = pos[i] * s + dx;
    pos[i + 1] = pos[i + 1] * s + dy;
  }
  return pos;
}

// ---------- 点云构建 ----------
function actCells() {
  if (!L.portrait) {
    const size = 210;
    return CHARS.map((ch, i) => ({ ch, cx: L.W / 2 + (i - 2) * 262, cy: L.H * 0.4, size }));
  }
  const size = 276;
  const colX = [L.W / 2 - 175, L.W / 2 + 175];
  const rowY = [L.H * 0.28, L.H * 0.44, L.H * 0.6];
  const spots = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]];
  return CHARS.map((ch, i) => {
    const [c, r] = spots[i];
    return { ch, cx: colX[c], cy: rowY[r], size };
  });
}

function buildActCloud(stageName) {
  const cells = actCells();
  const clusters = cells.map((c) => ({
    x: c.cx - c.size / 2 - 22,
    y: c.cy - c.size / 2 - 22,
    w: c.size + 44,
    h: c.size + 44,
  }));
  const drawAll = (ctx) => {
    cells.forEach((c) => drawGlyph(ctx, c.ch, stageName, c.cx, c.cy, c.size));
  };
  const pos = makeClusterCloud(L.W, L.H, clusters, COUNT, drawAll, worldW, worldH);
  if (SIDE) shiftCloud(pos, 3.0, 0, 0.8);
  return pos;
}
function buildTextCloud(text, size, yRatio = 0.5) {
  const n = text.length;
  const gap = size * 1.22;
  const total = n * gap;
  const xR = SIDE ? 0.72 : 0.5;
  const y = L.H * (SIDE ? 0.5 : yRatio);
  const centers = [];
  for (let i = 0; i < n; i++) centers.push(L.W * xR - total / 2 + gap * (i + 0.5));
  const clusters = centers.map((cx) => ({
    x: cx - size / 2 - 18,
    y: y - size / 2 - 18,
    w: size + 36,
    h: size + 36,
  }));
  const drawAll = (ctx) => {
    ctx.font = `${size}px ${FONT_STACK}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) ctx.fillText(text[i], centers[i], y + size * 0.02);
  };
  return makeClusterCloud(L.W, L.H, clusters, COUNT, drawAll, worldW, worldH);
}

// 预构建基础点云
stage.addCloud("idle", makeDiskCloud(COUNT, 3.4));
stage.addCloud("idle2", makeDiskCloud(COUNT, 4.2));
for (const s of STAGES) stage.addCloud(s, buildActCloud(s));
stage.addCloud("finale", buildFinaleCloud());

// 单字点云（一字千年章节 / 认字章节用，按需构建）
function buildSingleCloud(ch, stageName, yRatio = 0.3) {
  const size = L.portrait ? 280 : 360;
  const cx = L.W * (SIDE ? 0.71 : 0.5);
  const cy = L.H * (SIDE ? 0.5 : yRatio);
  const clusters = [{ x: cx - size / 2 - 20, y: cy - size / 2 - 20, w: size + 40, h: size + 40 }];
  const drawAll = (ctx) => drawGlyph(ctx, ch, stageName, cx, cy, size);
  return makeClusterCloud(L.W, L.H, clusters, COUNT, drawAll, worldW, worldH);
}

// 双字形对（认字·辨体）：同一字的两个阶段左右并排
function buildPairCloud(ch, stageA, stageB) {
  const size = L.portrait ? 190 : 230;
  const cy = L.H * (SIDE ? 0.5 : 0.3);
  const cx = L.W * (SIDE ? 0.72 : 0.5);
  const dx = size * 1.25;
  const clusters = [
    { x: cx - dx - size / 2 - 16, y: cy - size / 2 - 16, w: size + 32, h: size + 32 },
    { x: cx + dx - size / 2 - 16, y: cy - size / 2 - 16, w: size + 32, h: size + 32 },
  ];
  const drawAll = (ctx) => {
    drawGlyph(ctx, ch, stageA, cx - dx, cy, size);
    drawGlyph(ctx, ch, stageB, cx + dx, cy, size);
  };
  return makeClusterCloud(L.W, L.H, clusters, COUNT, drawAll, worldW, worldH);
}

// 尾声：30 字字墙（10×3 或 6×5 网格）
function buildFinaleCloud() {
  const cols = L.portrait ? 6 : 10;
  const rows = L.portrait ? 5 : 3;
  const cellW = L.W / cols;
  const cellH = (L.H * 0.6) / rows;
  const size = Math.min(cellW, cellH) * 0.62;
  const y0 = L.H * 0.12 + cellH / 2;
  const cells = [];
  LIB.forEach((ch, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    cells.push({ ch, cx: cellW * (c + 0.5), cy: y0 + r * cellH });
  });
  const clusters = cells.map((c) => ({
    x: c.cx - size / 2 - 12,
    y: c.cy - size / 2 - 12,
    w: size + 24,
    h: size + 24,
  }));
  const drawAll = (ctx) => {
    cells.forEach((c) => drawGlyph(ctx, c.ch, "regular", c.cx, c.cy, size));
  };
  return makeClusterCloud(L.W, L.H, clusters, COUNT, drawAll, worldW, worldH);
}

// ---------- 章节状态 ----------
const sections = [
  { id: "hero", label: "开篇", cloud: "idle", color: "#cfd8ff", bg: "#0b0b0f", era: "汉字五体演变", opacity: 0.85 },
  { id: "act-oracle", label: "甲骨文", cloud: "oracle", color: "#e8dcc8", bg: "#0d0c0f", era: "甲骨文 · 约公元前1300年", opacity: 1 },
  { id: "act-bronze", label: "金文", cloud: "bronze", color: "#e0a75e", bg: "#100e0a", era: "金文 · 商周", opacity: 1 },
  { id: "act-seal", label: "小篆", cloud: "seal", color: "#a8e0bd", bg: "#0a0f0d", era: "小篆 · 秦", opacity: 1 },
  { id: "act-clerical", label: "隶书", cloud: "clerical", color: "#d8dde8", bg: "#0b0b0e", era: "隶书 · 汉", opacity: 1 },
  { id: "act-regular", label: "楷书", cloud: "regular", color: "#f2f2f5", bg: "#090a10", era: "楷书 · 至今", opacity: 1 },
  { id: "timeline", label: "一字千年", cloud: null, color: "#e8d8b0", bg: "#0c0b0a", era: "一字千年", opacity: 1 },
  { id: "combine", label: "构字", cloud: null, color: "#ffd9a0", bg: "#0c0b0a", era: "构字", opacity: 1 },
  { id: "write", label: "写字", cloud: null, color: "#bfe3ff", bg: "#0a0b0e", era: "写字", opacity: 1 },
  { id: "quiz", label: "认字", cloud: null, color: "#ffd9a0", bg: "#0c0b0a", era: "认字", opacity: 1 },
  { id: "data", label: "字量", cloud: "idle2", color: "#9ab8d8", bg: "#0a0b0f", era: "字量", opacity: 0.3 },
  { id: "finale", label: "尾声", cloud: "finale", color: "#e8d8b0", bg: "#0c0b0a", era: "尾声", opacity: 1 },
  { id: "about", label: "关于", cloud: "idle2", color: "#9ab8d8", bg: "#0a0b0f", era: "关于", opacity: 0.22 },
];

const eraName = document.getElementById("era-name");
const mainEl = document.querySelector("main");
const navEl = document.getElementById("nav");
const tocItems = [];
const drawerItems = [];

// 桌面目录：ul/li/真实锚点，五体主线与互动/说明分两组
const navUl = document.createElement("ul");
navEl.appendChild(navUl);
const drawerListEl = document.getElementById("toc-list-mobile");

sections.forEach((s, i) => {
  if (i === 6) {
    const sep = document.createElement("li");
    sep.className = "toc-sep";
    sep.setAttribute("aria-hidden", "true");
    navUl.appendChild(sep);
  }
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.className = "toc-item";
  a.href = "#" + s.id;
  a.dataset.tier = i <= 5 ? "1" : "2";
  a.title = s.label;
  a.innerHTML = '<span class="toc-label">' + s.label + '</span><i class="toc-tick" aria-hidden="true"></i>';
  a.addEventListener("click", (e) => {
    e.preventDefault();
    goTo(i);
  });
  li.appendChild(a);
  navUl.appendChild(li);
  tocItems.push(a);

  const dli = document.createElement("li");
  const da = document.createElement("a");
  da.href = "#" + s.id;
  da.innerHTML = "<span>" + s.label + '</span><i class="num">' + String(i + 1).padStart(2, "0") + "</i>";
  da.addEventListener("click", (e) => {
    e.preventDefault();
    goTo(i);
    closeDrawer();
  });
  dli.appendChild(da);
  drawerListEl.appendChild(dli);
  drawerItems.push(da);
});

const tocPosEl = document.createElement("div");
tocPosEl.className = "toc-pos";
navEl.appendChild(tocPosEl);

// 尾声字墙热区：点任意字 → 看它三千年
const finaleHotspots = document.getElementById("finale-hotspots");
LIB.forEach((ch) => {
  const b = document.createElement("button");
  b.className = "finale-spot";
  b.setAttribute("aria-label", "看「" + ch + "」的三千年");
  b.addEventListener("click", () => showEvolution(ch));
  finaleHotspots.appendChild(b);
});

// 一字千年：一键看选中字的全过程
document.getElementById("btn-timeline-evolve").addEventListener("click", () => showEvolution(libChar));

// 移动端目录抽屉
const tocBtn = document.getElementById("toc-btn");
const tocDrawer = document.getElementById("toc-drawer");
const tocBackdrop = document.getElementById("toc-backdrop");
const tocClose = document.getElementById("toc-close");

function openDrawer() {
  tocDrawer.classList.add("open");
  tocBackdrop.classList.add("show");
  tocBtn.setAttribute("aria-expanded", "true");
  tocDrawer.setAttribute("aria-hidden", "false");
}
function closeDrawer() {
  tocDrawer.classList.remove("open");
  tocBackdrop.classList.remove("show");
  tocBtn.setAttribute("aria-expanded", "false");
  tocDrawer.setAttribute("aria-hidden", "true");
}
tocBtn.addEventListener("click", openDrawer);
tocClose.addEventListener("click", closeDrawer);
tocBackdrop.addEventListener("click", closeDrawer);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

// 声音
const audio = new AmbientAudio();
const soundBtn = document.getElementById("sound-toggle");
soundBtn.addEventListener("click", async () => {
  if (audio.enabled) {
    audio.disable();
    soundBtn.textContent = "声音：关";
  } else {
    const ok = await audio.enable();
    if (ok) {
      soundBtn.textContent = "声音：开";
      audio.pluck(NOTES.gong);
    }
  }
});

// 按笔画数分配音高（2 画最低，7 画以上最高）
const PITCHES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
function pluckForChar(ch) {
  const n = STROKE_COUNT[ch] || 4;
  audio.pluck(PITCHES[Math.max(0, Math.min(PITCHES.length - 1, n - 2))]);
}

let activeId = null;
function applySection(sec) {
  if (activeId === sec.id) return;
  activeId = sec.id;
  stage.setColor(sec.color);
  stage.setBackground(sec.bg);
  stage.setOpacity(sec.opacity);
  if (sec.id === "combine") {
    applyCombineCloud();
  } else if (sec.id === "timeline") {
    showTimeline(true);
  } else if (sec.id === "write") {
    applyWriteCloud();
  } else if (sec.id === "quiz") {
    applyQuiz(true);
  } else {
    stage.setCloud(sec.cloud);
  }
  eraName.textContent = sec.era;
  const syncCurrent = (el, i) => {
    const on = sections[i].id === sec.id;
    el.classList.toggle("active", on);
    if (on) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  };
  tocItems.forEach(syncCurrent);
  drawerItems.forEach(syncCurrent);
  const noteKey = sec.id.startsWith("act-") ? sec.id.slice(4) : sec.id;
  if (STAGE_NOTE[noteKey]) audio.pluck(STAGE_NOTE[noteKey]);
}

// ---------- 横向章节导航 ----------
let currentIndex = 0;
function goTo(i, force = false) {
  i = Math.max(0, Math.min(sections.length - 1, i));
  if (i === currentIndex && !force && activeId !== null) return;
  currentIndex = i;
  mainEl.style.transform = "translateX(" + -i * 100 + "vw)";
  applySection(sections[i]);
  tocPosEl.textContent = String(i + 1).padStart(2, "0") + " / " + String(sections.length).padStart(2, "0");
  const hash = "#" + sections[i].id;
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

window.addEventListener("hashchange", () => {
  const idx = sections.findIndex((s) => s.id === location.hash.slice(1));
  if (idx >= 0 && idx !== currentIndex) goTo(idx, true);
});

let wheelAcc = 0;
let wheelLockUntil = 0;
window.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now < wheelLockUntil) return;
    wheelAcc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(wheelAcc) < 36) return;
    const dir = wheelAcc > 0 ? 1 : -1;
    wheelAcc = 0;
    wheelLockUntil = now + 950;
    goTo(currentIndex + dir);
  },
  { passive: false }
);

window.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  if ((e.ctrlKey || e.metaKey) && activeId === "write") {
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      inkUndo();
      return;
    }
    if (k === "y" || (k === "z" && e.shiftKey)) {
      e.preventDefault();
      inkRedoFn();
      return;
    }
  }
  if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") {
    e.preventDefault();
    goTo(currentIndex + 1);
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
    e.preventDefault();
    goTo(currentIndex - 1);
  } else if (e.key === "Home") {
    e.preventDefault();
    goTo(0);
  } else if (e.key === "End") {
    e.preventDefault();
    goTo(sections.length - 1);
  }
});

let touchX = null;
let touchIgnore = false;
window.addEventListener(
  "touchstart",
  (e) => {
    touchIgnore = !!(e.target.closest && e.target.closest("#ink-canvas, input, button, a"));
    touchX = touchIgnore ? null : e.touches[0].clientX;
  },
  { passive: true }
);
window.addEventListener(
  "touchend",
  (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) goTo(currentIndex + (dx < 0 ? 1 : -1));
  },
  { passive: true }
);

document.getElementById("prev-btn").addEventListener("click", () => goTo(currentIndex - 1));
document.getElementById("next-btn").addEventListener("click", () => goTo(currentIndex + 1));

// ---------- 一字千年：时间轴 ----------
let libChar = "日";
let libProgress = 0;
const libChipsEl = document.getElementById("lib-chips");
const rangeEl = document.getElementById("time-range");
const timeLabelsEl = document.getElementById("time-labels");

LIB.forEach((ch) => {
  const b = document.createElement("button");
  b.className = "lib-chip";
  b.dataset.ch = ch;
  b.textContent = ch;
  b.addEventListener("click", () => {
    libChar = ch;
    syncLibChips();
    if (activeId === "timeline") showTimeline(true);
  });
  libChipsEl.appendChild(b);
});

function syncLibChips() {
  libChipsEl.querySelectorAll(".lib-chip").forEach((el) => {
    el.classList.toggle("active", el.dataset.ch === libChar);
  });
}

function timelineCloudKey(ch, stageName) {
  return ensureCloud("s:" + ch + ":" + stageName, () => buildSingleCloud(ch, stageName));
}

function showTimeline(animate) {
  const i = Math.min(STAGES.length - 2, Math.floor(libProgress));
  const t = Math.min(1, libProgress - i);
  const keyA = timelineCloudKey(libChar, STAGES[i]);
  const keyB = timelineCloudKey(libChar, STAGES[i + 1]);
  stage.setBlend(keyA, keyB, t, animate);
  const idx = Math.round(libProgress);
  [...timeLabelsEl.children].forEach((el, k) => el.classList.toggle("on", k === idx));
}

rangeEl.addEventListener("input", () => {
  libProgress = Number(rangeEl.value) / 100;
  if (activeId === "timeline") showTimeline(false);
});
syncLibChips();

// ---------- 写字：手写粒子化（笔锋 / 撤销 / 重做） ----------
const inkCanvas = document.getElementById("ink-canvas");
const inkCtx = inkCanvas.getContext("2d");
const writeHint = document.getElementById("write-hint");
const writeFlash = document.getElementById("write-flash");
let inkStrokes = [];
let inkRedo = [];
let inkCurrent = null;
let inkLastT = 0;
let inkHasContent = false;

const INK_MIN_W = 2.6;
const INK_MAX_W = 8.5;
const INK_INK = "rgba(233,230,223,.88)";

function inkWidthFor(speed) {
  return Math.max(INK_MIN_W, Math.min(INK_MAX_W, INK_MAX_W - speed * 1.8));
}

function inkSegment(ctx, p1, p2) {
  ctx.strokeStyle = INK_INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = (p1.w + p2.w) / 2;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

function drawInkGrid() {
  const W = inkCanvas.width;
  const H = inkCanvas.height;
  inkCtx.save();
  inkCtx.strokeStyle = "rgba(233,230,223,.08)";
  inkCtx.lineWidth = 1;
  inkCtx.setLineDash([7, 9]);
  inkCtx.beginPath();
  inkCtx.moveTo(W / 2, 12);
  inkCtx.lineTo(W / 2, H - 12);
  inkCtx.moveTo(12, H / 2);
  inkCtx.lineTo(W - 12, H / 2);
  inkCtx.stroke();
  inkCtx.restore();
}

function inkRedraw() {
  inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
  drawInkGrid();
  if (writeMode === "guide" && guideTarget) {
    inkCtx.save();
    inkCtx.globalAlpha = 0.13;
    inkCtx.fillStyle = "#e9e6df";
    inkCtx.font = "160px " + FONT_STACK;
    inkCtx.textAlign = "center";
    inkCtx.textBaseline = "middle";
    inkCtx.fillText(guideTarget, inkCanvas.width / 2, inkCanvas.height / 2 + 4);
    inkCtx.restore();
  }
  for (const st of inkStrokes) {
    if (st.length === 1) {
      const p = st[0];
      inkCtx.beginPath();
      inkCtx.arc(p.x, p.y, Math.max(1.4, p.w / 2), 0, Math.PI * 2);
      inkCtx.fillStyle = INK_INK;
      inkCtx.fill();
    } else {
      for (let i = 1; i < st.length; i++) inkSegment(inkCtx, st[i - 1], st[i]);
    }
  }
}

function inkClear() {
  inkStrokes = [];
  inkRedo = [];
  inkCurrent = null;
  inkHasContent = false;
  inkCanvas.classList.remove("dimmed");
  writeHint.textContent = "提示：鼠标或手指按住书写（Ctrl+Z 撤销）";
  inkRedraw();
}

function inkBBox() {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const st of inkStrokes) {
    for (const p of st) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return { minX, minY, bw: Math.max(1, maxX - minX), bh: Math.max(1, maxY - minY) };
}

// 多字检测：笔迹整体过于扁平，多半写了不止一个字
function looksMultiChar() {
  if (!inkHasContent) return false;
  const { bw, bh } = inkBBox();
  return bw / bh > 1.6 && bw > inkCanvas.width * 0.5;
}

function inkUndo() {
  if (!inkStrokes.length) return;
  inkRedo.push(inkStrokes.pop());
  inkRedraw();
  inkHasContent = inkStrokes.length > 0;
}

function inkRedoFn() {
  if (!inkRedo.length) return;
  inkStrokes.push(inkRedo.pop());
  inkRedraw();
  inkHasContent = true;
}

function inkPos(e) {
  const r = inkCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (inkCanvas.width / r.width),
    y: (e.clientY - r.top) * (inkCanvas.height / r.height),
  };
}

inkCanvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  inkCanvas.setPointerCapture(e.pointerId);
  inkCanvas.classList.remove("dimmed");
  const p = inkPos(e);
  p.w = INK_MAX_W * 0.8;
  inkCurrent = [p];
  inkStrokes.push(inkCurrent);
  inkRedo = [];
  inkHasContent = true;
  inkLastT = e.timeStamp;
});

inkCanvas.addEventListener("pointermove", (e) => {
  if (!inkCurrent) return;
  e.preventDefault();
  const p = inkPos(e);
  const last = inkCurrent[inkCurrent.length - 1];
  const dist = Math.hypot(p.x - last.x, p.y - last.y);
  if (dist < 1.5) return;
  const dt = Math.max(1, e.timeStamp - inkLastT);
  inkLastT = e.timeStamp;
  p.w = inkWidthFor(dist / dt);
  inkCurrent.push(p);
  inkSegment(inkCtx, last, p);
});

function inkEnd() {
  if (!inkCurrent) return;
  const st = inkCurrent;
  if (st.length === 1) {
    const p = st[0];
    p.w = Math.max(2.2, p.w * 0.55);
    inkCtx.beginPath();
    inkCtx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2);
    inkCtx.fillStyle = INK_INK;
    inkCtx.fill();
  } else {
    // 收笔：末端两笔收细
    const n = st.length;
    st[n - 1].w = Math.max(1.6, st[n - 1].w * 0.55);
    if (n > 2) st[n - 2].w = Math.max(1.8, st[n - 2].w * 0.75);
    inkRedraw();
  }
  inkCurrent = null;
}
inkCanvas.addEventListener("pointerup", inkEnd);
inkCanvas.addEventListener("pointercancel", inkEnd);

function buildInkCloud() {
  const { minX, minY, bw, bh } = inkBBox();
  const maxW = L.W * (SIDE ? 0.3 : 0.42);
  const maxH = L.H * (SIDE ? 0.62 : 0.4);
  const s = Math.min(maxW / bw, maxH / bh, SIDE ? 5 : 4);
  const cx = L.W * (SIDE ? 0.72 : 0.5);
  const cy = L.H * (SIDE ? 0.5 : 0.3);
  const drawAll = (ctx) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-(minX + bw / 2), -(minY + bh / 2));
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const st of inkStrokes) {
      if (st.length === 1) {
        ctx.beginPath();
        ctx.arc(st[0].x, st[0].y, Math.max(1.4, st[0].w / 2), 0, Math.PI * 2);
        ctx.fill();
      } else {
        for (let i = 1; i < st.length; i++) {
          ctx.lineWidth = (st[i - 1].w + st[i].w) / 2;
          ctx.beginPath();
          ctx.moveTo(st[i - 1].x, st[i - 1].y);
          ctx.lineTo(st[i].x, st[i].y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  };
  const cluster = [{ x: 0, y: 0, w: L.W, h: L.H }];
  return makeClusterCloud(L.W, L.H, cluster, COUNT, drawAll, worldW, worldH);
}

function applyWriteCloud() {
  if (activeId !== "write") return;
  // 懒加载增强识别引擎（12,000+ 常用字，本地模型）
  if (!hsEngine && !hsLoading) {
    loadHanScribe().then((ok) => {
      if (ok && activeId === "write") {
        writeHint.textContent = "增强识别引擎已就绪——写下任意一个常用字试试";
      }
    });
  }
  if (writeMode === "name") {
    stage.setCloud(ensureCloud("name:prompt", () => buildTextCloud("名字", L.portrait ? 220 : 250, 0.28)));
    return;
  }
  if (!inkHasContent) {
    stage.setCloud(ensureCloud("write:prompt", () => buildTextCloud("写", L.portrait ? 240 : 280, 0.28)));
  }
}

document.getElementById("btn-particle").addEventListener("click", () => {
  if (!inkHasContent) {
    writeHint.textContent = "先写点什么，再让粒子接住它";
    return;
  }
  stage.addCloud("write:user", buildInkCloud());
  stage.setCloud("write:user", 1.4);
  stage.setColor("#d9ecff");
  inkCanvas.classList.add("dimmed");
  writeFlash.classList.remove("on");
  void writeFlash.offsetWidth;
  writeFlash.classList.add("on");
  audio.pluck(NOTES.jue);
  if (writeMode === "free") {
    if (looksMultiChar()) {
      recogCard.hidden = false;
      recogCard.innerHTML =
        "<div>看起来写了不止一个字——一次写一个字，我才能认出它。</div>" +
        '<div class="recog-actions"><button data-again>再写一次</button></div>';
      bindRecog();
      writeHint.textContent = "一次写一个字，识别会准很多";
    } else {
      const hs = hsRecognize();
      if (hs) {
        renderRecogCardHS(hs);
      } else {
        renderRecogCard(recognizeInk());
        writeHint.textContent = "增强识别引擎还在加载，先用快速识别——稍后可重新粒子化";
      }
    }
  } else {
    writeHint.textContent = "粒子接住了。点“评分”对照描红看看像不像。";
  }
});
document.getElementById("btn-undo").addEventListener("click", inkUndo);
document.getElementById("btn-redo").addEventListener("click", inkRedoFn);
document.getElementById("btn-join").addEventListener("click", () => {
  stage.setCloud("idle2", 1.6);
  stage.setColor("#9ab8d8");
  writeHint.textContent = "它融入星河了——再写一个吧";
  audio.pluck(NOTES.yu);
});
document.getElementById("btn-clear").addEventListener("click", () => {
  inkClear();
  if (activeId === "write") applyWriteCloud();
});

// ---------- 写字：模式 / 识别 / 考据联动 ----------
let writeMode = "free";
let guideTarget = "牛";
let evolveTimer = null;
const modeFreeBtn = document.getElementById("mode-free");
const modeGuideBtn = document.getElementById("mode-guide");
const modeNameBtn = document.getElementById("mode-name");
const guideBar = document.getElementById("guide-bar");
const guideCharSel = document.getElementById("guide-char");
const guideRandomBtn = document.getElementById("guide-random");
const guideInfo = document.getElementById("guide-info");
const btnGrade = document.getElementById("btn-grade");
const recogCard = document.getElementById("recog-card");
const etyCard = document.getElementById("ety-card");
const nameBar = document.getElementById("name-bar");
const nameInput = document.getElementById("name-input");
const nameGenerateBtn = document.getElementById("name-generate");
const nameSaveBtn = document.getElementById("name-save");
const nameEvolve = document.getElementById("name-evolve");
const writeWrap = document.querySelector(".write-wrap");

LIB.forEach((ch) => {
  const o = document.createElement("option");
  o.value = ch;
  o.textContent = ch + "　" + STROKE_COUNT[ch] + "画";
  guideCharSel.appendChild(o);
});
guideCharSel.value = guideTarget;

function updateGuideInfo() {
  guideTarget = guideCharSel.value;
  guideInfo.textContent = STROKE_COUNT[guideTarget] + " 画 · 先横后竖，先撇后捺";
  if (writeMode === "guide") inkRedraw();
}

function setWriteMode(m) {
  writeMode = m;
  modeFreeBtn.classList.toggle("on", m === "free");
  modeGuideBtn.classList.toggle("on", m === "guide");
  modeNameBtn.classList.toggle("on", m === "name");
  guideBar.hidden = m !== "guide";
  btnGrade.hidden = m !== "guide";
  nameBar.hidden = m !== "name";
  writeWrap.hidden = m === "name";
  recogCard.hidden = true;
  recogCard.innerHTML = "";
  nameEvolve.hidden = true;
  nameEvolve.innerHTML = "";
  const leads = {
    free: "写下任意一笔一字，让粒子接住它。",
    guide: "照着浅色描红写一遍，看看像不像。",
    name: "输入你的名字，生成一张属于你的粒子星图。",
  };
  document.getElementById("write-lead").textContent = leads[m] || leads.free;
  inkClear();
  updateGuideInfo();
  if (activeId === "write") applyWriteCloud();
}
modeFreeBtn.addEventListener("click", () => setWriteMode("free"));
modeGuideBtn.addEventListener("click", () => setWriteMode("guide"));
modeNameBtn.addEventListener("click", () => setWriteMode("name"));
guideCharSel.addEventListener("change", updateGuideInfo);
guideRandomBtn.addEventListener("click", () => {
  const pool = LIB.filter((c) => c !== guideTarget);
  guideCharSel.value = pool[Math.floor(Math.random() * pool.length)];
  updateGuideInfo();
});

// ---- 名字图：生成与保存 ----
nameGenerateBtn.addEventListener("click", () => {
  const name = nameInput.value.trim().replace(/\s+/g, "").slice(0, 4);
  if (!name) {
    writeHint.textContent = "先输入名字（2–4 字）";
    return;
  }
  const size = name.length >= 4 ? 200 : name.length === 3 ? 240 : 280;
  stage.addCloud("name:user", buildTextCloud(name, size, 0.5));
  stage.setCloud("name:user", 1.5);
  stage.setColor("#ffd9a0");
  nameSaveBtn.disabled = false;
  writeHint.textContent = "生成好了——可以点“保存图片”带走它";
  audio.pluck(NOTES.gongHigh);
  const uniq = [...new Set(name.split(""))].filter((c) => LIB.includes(c));
  nameEvolve.innerHTML = "";
  uniq.forEach((c) => {
    const b = document.createElement("button");
    b.textContent = "看「" + c + "」的三千年";
    b.addEventListener("click", () => showEvolution(c, "name:user"));
    nameEvolve.appendChild(b);
  });
  if (uniq.length < name.length) {
    const note = document.createElement("span");
    note.className = "name-note";
    note.textContent = "有些字的三千年我们还没画到——但它们已经在这张星图里了。";
    nameEvolve.appendChild(note);
  }
  nameEvolve.hidden = false;
});

function saveNameImage() {
  stage.render();
  const src = stage.renderer.domElement;
  const out = document.createElement("canvas");
  out.width = 1920;
  out.height = 1080;
  const c = out.getContext("2d");
  const grad = c.createLinearGradient(0, 0, 1920, 1080);
  grad.addColorStop(0, "#0b0b0f");
  grad.addColorStop(1, "#14100a");
  c.fillStyle = grad;
  c.fillRect(0, 0, 1920, 1080);
  const scale = Math.max(1920 / src.width, 1080 / src.height);
  const dw = src.width * scale;
  const dh = src.height * scale;
  c.drawImage(src, (1920 - dw) / 2, (1080 - dh) / 2, dw, dh);
  c.fillStyle = "rgba(233,230,223,.88)";
  c.font = '46px "ZiShengKai","KaiTi","STKaiti","楷体",serif';
  c.textAlign = "left";
  c.fillText("名字 · 星图", 84, 138);
  c.fillStyle = "rgba(233,230,223,.5)";
  c.font = '24px "Microsoft YaHei",sans-serif';
  c.fillText("《字·生》——汉字五体演变的粒子交互体验", 86, 184);
  c.textAlign = "right";
  c.fillText(new Date().toLocaleDateString("zh-CN"), 1836, 138);
  const a = document.createElement("a");
  a.download = "字生-名字星图.png";
  a.href = out.toDataURL("image/png");
  a.click();
  writeHint.textContent = "已保存图片";
  audio.pluck(NOTES.gongHigh);
}
nameSaveBtn.addEventListener("click", saveNameImage);

// ---- 识别引擎：覆盖网格 + 笔画方向直方图 双特征，余弦相似度 ----
const FEAT_N = 14;
function computeFeatures(drawFn, W, H) {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  drawFn(ctx, W, H);
  const img = ctx.getImageData(0, 0, W, H).data;
  const mask = new Uint8Array(W * H);
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (img[(y * W + x) * 4 + 3] > 80) {
        mask[y * W + x] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cov = new Float32Array(FEAT_N * FEAT_N);
  const grad = new Float32Array(FEAT_N * FEAT_N * 8);
  if (maxX >= 0) {
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const side = Math.max(bw, bh);
    const ox = minX - (side - bw) / 2;
    const oy = minY - (side - bh) / 2;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (!mask[y * W + x]) continue;
        const gx = mask[y * W + x + 1] - mask[y * W + x - 1];
        const gy = mask[(y + 1) * W + x] - mask[(y - 1) * W + x];
        const mag = Math.hypot(gx, gy);
        const cx = Math.min(FEAT_N - 1, Math.max(0, Math.floor(((x - ox) / side) * FEAT_N)));
        const cy = Math.min(FEAT_N - 1, Math.max(0, Math.floor(((y - oy) / side) * FEAT_N)));
        cov[cy * FEAT_N + cx] += 1;
        if (mag > 0.01) {
          let ang = Math.atan2(gy, gx);
          if (ang < 0) ang += Math.PI;
          const bin = Math.min(7, Math.floor(ang / (Math.PI / 8)));
          grad[(cy * FEAT_N + cx) * 8 + bin] += mag;
        }
      }
    }
  }
  let n = 0;
  for (let i = 0; i < cov.length; i++) n += cov[i] * cov[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < cov.length; i++) cov[i] /= n;
  n = 0;
  for (let i = 0; i < grad.length; i++) n += grad[i] * grad[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < grad.length; i++) grad[i] /= n;
  return { cov, grad };
}

// 模板：识别面 RECOG，每字 5 个角度增强（±8°/±4°/0°），提升容错
const TEMPLATE_ANGLES = [-8, -4, 0, 4, 8];
const TEMPLATES = {};
RECOG.forEach((ch) => {
  TEMPLATES[ch] = TEMPLATE_ANGLES.map((deg) =>
    computeFeatures((ctx, W, H) => {
      ctx.font = Math.round(H * 0.82) + "px " + FONT_STACK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(W / 2, H / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.fillText(ch, 0, H * 0.01);
    }, 72, 72)
  );
});

function inkFeatures() {
  return computeFeatures((ctx, W, H) => {
    const pad = 10;
    const s = (W - pad * 2) / inkCanvas.width;
    ctx.save();
    ctx.translate(pad, pad);
    ctx.scale(s, s);
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const st of inkStrokes) {
      if (st.length === 1) {
        ctx.beginPath();
        ctx.arc(st[0].x, st[0].y, Math.max(3, st[0].w / 2), 0, Math.PI * 2);
        ctx.fill();
      } else {
        for (let i = 1; i < st.length; i++) {
          ctx.lineWidth = Math.max(4, (st[i - 1].w + st[i].w) / 2);
          ctx.beginPath();
          ctx.moveTo(st[i - 1].x, st[i - 1].y);
          ctx.lineTo(st[i].x, st[i].y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }, 120, 120);
}

function similarity(f, t) {
  let c = 0;
  let g = 0;
  for (let i = 0; i < f.cov.length; i++) c += f.cov[i] * t.cov[i];
  for (let i = 0; i < f.grad.length; i++) g += f.grad[i] * t.grad[i];
  return 0.55 * c + 0.45 * g;
}

function recognizeInk() {
  const f = inkFeatures();
  const mine = inkStrokes.length;
  const ranked = RECOG.map((ch) => {
    let best = 0;
    for (const t of TEMPLATES[ch]) {
      const s = similarity(f, t);
      if (s > best) best = s;
    }
    // 笔画数门控：与用户实际笔画数差异越大，得分折损越多（软门控）
    const exp = RECOG_STROKES[ch] || STROKE_COUNT[ch];
    let score = best;
    if (exp && mine) score *= 1 - Math.min(0.5, 0.12 * Math.abs(mine - exp));
    return { ch, score };
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

// ---------- HanScribe 增强识别引擎（懒加载；单文件内嵌 / 源码版读 vendor） ----------
let hsLib = null;
let hsEngine = null;
let hsVocab = null;
let hsLoading = null;

function b64ToU8(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function getHsLib() {
  if (window.HanScribeLib) return window.HanScribeLib;
  return await import("../vendor/hanscribe.js");
}

function loadHanScribe() {
  if (hsLoading) return hsLoading;
  hsLoading = (async () => {
    const mod = await getHsLib();
    let wasmBytes;
    let modelBuf;
    if (window.__HS_WASM_B64 && window.__HS_MODEL_B64) {
      wasmBytes = b64ToU8(window.__HS_WASM_B64).buffer;
      modelBuf = b64ToU8(window.__HS_MODEL_B64).buffer;
    } else {
      const [w, m] = await Promise.all([
        fetch("vendor/hanscribe-inference.wasm").then((r) => r.arrayBuffer()),
        fetch("vendor/hanscribe.hzmodel").then((r) => r.arrayBuffer()),
      ]);
      wasmBytes = w;
      modelBuf = m;
    }
    const model = mod.parseHzModel(modelBuf);
    hsEngine = await mod.createWasmEngine(wasmBytes, model.header, model.weights);
    hsVocab = model.vocab;
    hsLib = mod;
    window.__hsReady = true;
    return true;
  })().catch(() => false);
  return hsLoading;
}

// 用增强引擎识别墨迹；未就绪返回 null（调用方回退旧引擎）
function hsRecognize() {
  if (!hsEngine || !hsLib) return null;
  const strokes = inkStrokes
    .map((st) => {
      let t = 0;
      return st.map((p, i) => {
        if (i > 0) t += Math.hypot(p.x - st[i - 1].x, p.y - st[i - 1].y) * 12;
        return [p.x, p.y, t];
      });
    })
    .filter((st) => st.length >= 2);
  if (!strokes.length) return null;
  const { data, numSegments } = hsLib.preprocessStrokes(strokes);
  const res = hsEngine.runInference(data, numSegments, 5);
  return res.indices.map((idx, k) => ({ ch: hsVocab[idx], score: res.scores[k] }));
}

// 增强引擎结果卡：高置信直接确认，否则 Top-3 点选
function renderRecogCardHS(results) {
  const top = results[0];
  const second = results[1] || { ch: "", score: 0 };
  recogCard.hidden = false;
  const pct = (s) => Math.min(99, Math.round(s * 100));
  if (top.score >= 0.85 && top.score - second.score >= 0.25) {
    if (LIB.includes(top.ch)) {
      recogCard.innerHTML =
        "<div>粒子接住了你的字，它很像 <b>" +
        top.ch +
        "</b>（" +
        pct(top.score) +
        "%）</div>" +
        '<div class="recog-actions"><button data-evolve="' +
        top.ch +
        '">看它三千年</button><button data-again>再写一次</button></div>';
      writeHint.textContent = "认出来了——看看它的三千年吧";
      pluckForChar(top.ch);
    } else {
      recogCard.innerHTML =
        "<div>认出来了：<b>" +
        top.ch +
        "</b>（" +
        pct(top.score) +
        "%）。它的三千年还没画进我们的库——目前收录 30 个字。</div>" +
        '<div class="recog-actions"><button data-again>再写一次</button></div>';
      writeHint.textContent = "认出来了——这个字的三千年还没画到";
      pluckForChar(top.ch);
    }
  } else {
    const cands = results.slice(0, 3);
    recogCard.innerHTML =
      "<div>点一下你写的是哪一个：</div>" +
      '<div class="recog-actions">' +
      cands
        .map((c) => '<button data-pick="' + c.ch + '">' + c.ch + "（" + pct(c.score) + "%）</button>")
        .join("") +
      "<button data-again>都不是</button></div>";
    writeHint.textContent = "点选确认，或者切到「跟着写」慢慢来";
    audio.pluck(NOTES.yu);
  }
  bindRecog();
}

// ---- 识别结果卡 ----
function bindRecog() {
  recogCard.querySelectorAll("[data-pick]").forEach((b) =>
    b.addEventListener("click", () => confirmRecog(b.dataset.pick))
  );
  const evolveBtn = recogCard.querySelector("[data-evolve]");
  const againBtn = recogCard.querySelector("[data-again]");
  if (evolveBtn)
    evolveBtn.addEventListener("click", () =>
      showEvolution(evolveBtn.dataset.evolve, writeMode === "name" ? "name:user" : "write:user")
    );
  if (againBtn)
    againBtn.addEventListener("click", () => {
      inkClear();
      recogCard.hidden = true;
      if (activeId === "write") applyWriteCloud();
    });
}

// 用户从 Top-3 中点选确认
function confirmRecog(ch) {
  recogCard.hidden = false;
  if (LIB.includes(ch)) {
    recogCard.innerHTML =
      "<div>好，是 <b>" +
      ch +
      "</b>——看它的三千年吧。</div>" +
      '<div class="recog-actions"><button data-evolve="' +
      ch +
      '">看它三千年</button><button data-again>再写一次</button></div>';
    writeHint.textContent = "认出来了——看看它的三千年吧";
  } else {
    recogCard.innerHTML =
      "<div>好，是 <b>" +
      ch +
      "</b>。它的三千年还没画进我们的库——目前收录 30 个字（日 月 山 水 人 木 火 雨 目 口 田 大 牛 羊 女 子 刀 弓 门 舟 云 天 心 手 耳 鸟 土 石 竹 犬）。</div>" +
      '<div class="recog-actions"><button data-again>再写一次</button></div>';
    writeHint.textContent = "认出来了——这个字的三千年还没画到";
  }
  pluckForChar(ch);
  bindRecog();
}

function renderRecogCard(ranked) {
  const top = ranked[0];
  const second = ranked[1];
  const margin = top.score - second.score;
  recogCard.hidden = false;
  const pct = (s) => Math.min(95, Math.round(s * 100));
  if (top.score >= 0.65 && margin >= 0.05) {
    if (LIB.includes(top.ch)) {
      recogCard.innerHTML =
        "<div>粒子接住了你的字，它很像 <b>" +
        top.ch +
        "</b>（" +
        pct(top.score) +
        "%）</div>" +
        '<div class="recog-actions"><button data-evolve="' +
        top.ch +
        '">看它三千年</button><button data-again>再写一次</button></div>';
      writeHint.textContent = "认出来了——看看它的三千年吧";
      pluckForChar(top.ch);
    } else {
      recogCard.innerHTML =
        "<div>认出来了：<b>" +
        top.ch +
        "</b>（" +
        pct(top.score) +
        "%）。它的三千年还没画进我们的库——目前收录 30 个字。</div>" +
        '<div class="recog-actions"><button data-again>再写一次</button></div>';
      writeHint.textContent = "认出来了——这个字的三千年还没画到";
      pluckForChar(top.ch);
    }
  } else {
    const cands = ranked.slice(0, 3);
    recogCard.innerHTML =
      "<div>不太确定——点一下你写的是哪一个（Top-3）：</div>" +
      '<div class="recog-actions">' +
      cands
        .map((c) => '<button data-pick="' + c.ch + '">' + c.ch + "（" + pct(c.score) + "%）</button>")
        .join("") +
      "<button data-again>都不是</button></div>";
    writeHint.textContent = "点选确认，或者切到「跟着写」慢慢来";
    audio.pluck(NOTES.yu);
  }
  bindRecog();
}

// ---- 跟着写：评分 ----
btnGrade.addEventListener("click", () => {
  if (!inkHasContent) {
    writeHint.textContent = "先在描红底上写一遍";
    return;
  }
  if (looksMultiChar()) {
    writeHint.textContent = "看起来写了不止一个字——一次写一个字再评分吧";
    return;
  }
  stage.addCloud("write:user", buildInkCloud());
  stage.setCloud("write:user", 1.2);
  stage.setColor("#d9ecff");
  inkCanvas.classList.add("dimmed");
  writeFlash.classList.remove("on");
  void writeFlash.offsetWidth;
  writeFlash.classList.add("on");
  const f = inkFeatures();
  const sim = Math.min(95, Math.round(similarity(f, TEMPLATES[guideTarget]) * 100));
  const sc = STROKE_COUNT[guideTarget];
  const mine = inkStrokes.length;
  const scText =
    mine === sc
      ? "笔画数 " + mine + "/" + sc + " ✓"
      : "笔画数 " + mine + "/" + sc + (mine > sc ? "（多了 " + (mine - sc) + " 笔）" : "（还差 " + (sc - mine) + " 笔）");
  const comment = sim >= 70 ? "很像了！" : sim >= 45 ? "有点感觉了，再写一遍会更像。" : "还不太像，对照描红慢慢来。";
  recogCard.hidden = false;
  recogCard.innerHTML =
    "<div>与「" +
    guideTarget +
    "」的相似度 <b>" +
    sim +
    "%</b>　" +
    scText +
    "</div><div>对照笔画数与字形（不校验笔顺）。" +
    comment +
    "</div>" +
    '<div class="recog-actions"><button data-evolve="' +
    guideTarget +
    '">看它三千年</button><button data-again>再写一次</button></div>';
  bindRecog();
  if (sim >= 70) pluckForChar(guideTarget);
  else audio.pluck(NOTES.yu);
});

// ---- 联动：跳一字千年并自动推演 + 考据卡 ----
// fromKey 可选："write:user"（手写笔迹）或 "name:user"（名字图）——先原地长成甲骨文，再走完五体
function showEvolution(ch, fromKey) {
  libChar = ch;
  syncLibChips();
  libProgress = 0;
  rangeEl.value = 0;
  const idx = sections.findIndex((s) => s.id === "timeline");
  if (idx >= 0) goTo(idx);
  clearInterval(evolveTimer);
  const oracleKey = timelineCloudKey(ch, STAGES[0]);
  const startPlay = () => {
    let v = 0;
    evolveTimer = setInterval(() => {
      v += 4;
      if (v >= 400) {
        v = 400;
        clearInterval(evolveTimer);
      }
      rangeEl.value = v;
      libProgress = v / 100;
      showTimeline(false);
      if (v >= 400) setTimeout(() => showEtyCard(ch), 700);
    }, 55);
  };
  if (fromKey && stage.clouds[fromKey]) {
    stage.setBlend(fromKey, fromKey, 0, false);
    stage.setBlend(fromKey, oracleKey, 1, true);
    setTimeout(startPlay, 1550);
  } else {
    showTimeline(true);
    startPlay();
  }
  pluckForChar(ch);
}

function showEtyCard(ch) {
  const e = ETY[ch] || { method: "象形", meaning: ch, note: "" };
  document.getElementById("ety-char").textContent = ch;
  document.getElementById("ety-method").textContent = e.method;
  document.getElementById("ety-meaning").textContent = "本义：" + e.meaning;
  document.getElementById("ety-note").textContent = e.note;
  etyCard.classList.add("show");
  etyCard.setAttribute("aria-hidden", "false");
}
function closeEtyCard() {
  etyCard.classList.remove("show");
  etyCard.setAttribute("aria-hidden", "true");
}
document.getElementById("ety-close").addEventListener("click", closeEtyCard);
etyCard.addEventListener("click", (e) => {
  if (e.target === etyCard) closeEtyCard();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeEtyCard();
});
setWriteMode("free");

// ---------- 认字：三关制（认形 / 知义 / 辨体） ----------
const QUIZ_STAGES = [
  { key: "shape", name: "认形", count: 10, lead: "热身关：看字形猜今字——这个甲骨文是今天的哪个字？" },
  { key: "meaning", name: "知义", count: 6, lead: "理解关：它的本义是什么？" },
  { key: "order", name: "辨体", count: 4, lead: "时间关：左右两个字形，哪一个更早？" },
];
const quizOptsEl = document.getElementById("quiz-options");
const quizFeedbackEl = document.getElementById("quiz-feedback");
const quizProgressEl = document.getElementById("quiz-progress");
const quizLeadEl = document.getElementById("quiz-lead");
let qs = 0;
let qi = 0;
let quizScore = 0;
let quizWrong = false;
let quizRound = [];
let quizTimer = null;

function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function templateSim(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d;
}

function makeShapeQuestion(ch) {
  const ranked = LIB.filter((c) => c !== ch)
    .map((c) => ({ c, s: templateSim(TEMPLATES[ch][1], TEMPLATES[c][1]) }))
    .sort((x, y) => y.s - x.s);
  return { ch, opts: shuffleArr([ch, ...ranked.slice(0, 3).map((o) => o.c)]) };
}

function makeMeaningQuestion(ch) {
  const others = shuffleArr(LIB.filter((c) => c !== ch && ETY[c])).slice(0, 3);
  return { ch, opts: shuffleArr([ch, ...others]) };
}

function makeOrderQuestion(ch) {
  const pairs = [
    [0, 2],
    [0, 4],
    [1, 3],
    [1, 4],
    [2, 4],
  ];
  const p = pairs[Math.floor(Math.random() * pairs.length)];
  const leftFirst = Math.random() < 0.5;
  return {
    ch,
    left: leftFirst ? p[0] : p[1],
    right: leftFirst ? p[1] : p[0],
    earlier: leftFirst ? "left" : "right",
  };
}

function startQuizRound() {
  const lv = QUIZ_STAGES[qs];
  const chars = shuffleArr([...LIB]).slice(0, lv.count);
  quizRound = chars.map((ch) =>
    lv.key === "shape" ? makeShapeQuestion(ch) : lv.key === "meaning" ? makeMeaningQuestion(ch) : makeOrderQuestion(ch)
  );
  qi = 0;
  renderQuestion(true);
}

function quizGlyphCloud(q) {
  const lv = QUIZ_STAGES[qs];
  if (lv.key === "order") {
    const key = "quiz:pair:" + q.ch + ":" + q.left + ":" + q.right;
    return ensureCloud(key, () => buildPairCloud(q.ch, STAGES[q.left], STAGES[q.right]));
  }
  const key = "quiz:" + q.ch + ":oracle";
  return ensureCloud(key, () => buildSingleCloud(q.ch, "oracle", 0.3));
}

function renderQuestion(animate) {
  const lv = QUIZ_STAGES[qs];
  const q = quizRound[qi];
  if (!q) return;
  quizWrong = false;
  clearTimeout(quizTimer);
  quizLeadEl.textContent = lv.lead;
  stage.setCloud(quizGlyphCloud(q), animate ? 1.1 : false);
  stage.setColor("#ffd9a0");
  quizOptsEl.innerHTML = "";
  const mkBtn = (label, val) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.dataset.val = val;
    b.addEventListener("click", () => answerQuiz(b));
    quizOptsEl.appendChild(b);
  };
  if (lv.key === "shape") q.opts.forEach((c) => mkBtn(c, c));
  else if (lv.key === "meaning") q.opts.forEach((c) => mkBtn(ETY[c].meaning, c));
  else {
    mkBtn("左边更早", "left");
    mkBtn("右边更早", "right");
  }
  quizFeedbackEl.textContent = "";
  quizProgressEl.textContent = lv.name + " " + (qi + 1) + "/" + lv.count + " · 总分 " + quizScore;
}

function answerQuiz(btn) {
  const lv = QUIZ_STAGES[qs];
  const q = quizRound[qi];
  const val = btn.dataset.val;
  const correct = lv.key === "order" ? val === q.earlier : val === q.ch;
  if (correct) {
    btn.classList.add("right");
    quizOptsEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
    if (!quizWrong) quizScore++;
    pluckForChar(q.ch);
    stage.setCloud(ensureCloud("quiz:" + q.ch + ":regular", () => buildSingleCloud(q.ch, "regular", 0.3)), 1.0);
    if (lv.key === "shape") {
      quizFeedbackEl.textContent = "对！" + (ETY[q.ch] ? ETY[q.ch].note : "");
      quizTimer = setTimeout(quizAdvance, 1700);
    } else if (lv.key === "meaning") {
      quizFeedbackEl.textContent = "对！『" + q.ch + "』的造字法是" + (ETY[q.ch] ? ETY[q.ch].method : "") + "。";
      showEtyCard(q.ch);
      quizTimer = setTimeout(() => {
        closeEtyCard();
        quizAdvance();
      }, 3000);
    } else {
      const early = STAGE_NAMES[STAGES[Math.min(q.left, q.right)]];
      quizFeedbackEl.textContent = "对！" + early + "更早。";
      quizTimer = setTimeout(quizAdvance, 1800);
    }
  } else {
    if (!quizWrong) quizWrong = true;
    btn.classList.add("wrong");
    btn.disabled = true;
    quizFeedbackEl.textContent = "再想想……";
    audio.pluck(NOTES.yu);
  }
}

function quizAdvance() {
  qi++;
  if (qi >= quizRound.length) {
    qs++;
    if (qs >= QUIZ_STAGES.length) {
      showQuizEnd();
      return;
    }
    startQuizRound();
  } else {
    renderQuestion(true);
  }
}

function showQuizEnd() {
  quizOptsEl.innerHTML = "";
  quizFeedbackEl.textContent = "";
  quizProgressEl.textContent = "";
  const total = QUIZ_STAGES.reduce((s, x) => s + x.count, 0);
  quizLeadEl.textContent = "三关都走完了——你读懂了 " + quizScore + " / " + total + " 个字。";
  const again = document.createElement("button");
  again.textContent = "再来一轮";
  again.style.marginTop = "12px";
  again.addEventListener("click", () => {
    qs = 0;
    qi = 0;
    quizScore = 0;
    quizRound = [];
    startQuizRound();
  });
  quizOptsEl.appendChild(again);
  stage.setCloud(ensureCloud("quiz:done", () => buildTextCloud("字", L.portrait ? 260 : 300, 0.28)), 1.2);
}

function applyQuiz(animate) {
  if (activeId !== "quiz") return;
  if (qs >= QUIZ_STAGES.length) {
    showQuizEnd();
    return;
  }
  if (!quizRound.length) {
    startQuizRound();
  } else {
    renderQuestion(animate);
  }
}

// 供 dev 测试钩子：当前题的正确答案文案
function devQuizCorrectText() {
  const lv = QUIZ_STAGES[qs];
  const q = quizRound[qi];
  if (!q) return null;
  if (lv.key === "shape") return q.ch;
  if (lv.key === "meaning") return ETY[q.ch].meaning;
  return q.earlier === "left" ? "左边更早" : "右边更早";
}

// ---------- 构字互动 ----------
const CHIPS = ["日", "月", "木", "人", "女", "子"];
const COMBO = {
  日月: ["明", "日月为明——日是太阳，月是月亮，天下最亮的两样合在一起，就是“明”。"],
  木木: ["林", "双木成林——两棵树并立，便是一片树林。"],
  人木: ["休", "人倚木为休——一个人靠在树旁，就是休息。"],
  女子: ["好", "女子为好——有孩子、有依靠，便是美好。"],
  日日: ["昌", "双日为昌——两个太阳，寓意光明与昌盛。"],
  木子: ["李", "木子为李——《说文》说“从木，子声”；本义是李子，后来成了姓氏。"],
  月月: ["朋", "双月为朋——两月相随，像并肩同行的朋友。"],
  人人: ["从", "二人为从——一个跟着一个，就是跟从。"],
  人子: ["仔", "人旁有子——“仔”指幼小的孩子。"],
};

let selection = [];
const chipsEl = document.getElementById("chips");
const btnCombine = document.getElementById("btn-combine");
const btnReset = document.getElementById("btn-reset");
const resultEl = document.getElementById("combine-result");

CHIPS.forEach((ch) => {
  const b = document.createElement("button");
  b.className = "chip";
  b.dataset.ch = ch;
  b.textContent = ch;
  b.addEventListener("click", () => {
    if (selection.length === 0) {
      selection.push(ch);
    } else if (selection.length === 1) {
      selection.push(ch);
    } else {
      const i = selection.indexOf(ch);
      if (i >= 0) selection.splice(i, 1);
      else {
        selection.shift();
        selection.push(ch);
      }
    }
    syncChips();
    applyCombineCloud();
  });
  chipsEl.appendChild(b);
});

function syncChips() {
  chipsEl.querySelectorAll(".chip").forEach((el) => {
    el.classList.toggle("selected", selection.includes(el.dataset.ch));
  });
  btnCombine.disabled = selection.length !== 2;
}

function ensureCloud(key, builder) {
  if (!stage.hasCloud(key)) stage.addCloud(key, builder());
  return key;
}

function applyCombineCloud() {
  if (activeId !== "combine") return;
  const yR = 0.22;
  if (selection.length === 0) {
    resultEl.textContent = "选择一个部件…";
    stage.setCloud(ensureCloud("sel:prompt", () => buildTextCloud("日月", L.portrait ? 220 : 250, yR)));
  } else if (selection.length === 1) {
    resultEl.textContent = "再选一个部件……";
    stage.setCloud(ensureCloud("sel:" + selection[0], L.portrait ? 260 : 300, yR));
  } else {
    resultEl.textContent = "点“合成”看看会得到什么";
    const key = "sel:" + selection.join("");
    stage.setCloud(ensureCloud(key, () => buildTextCloud(selection.join(""), L.portrait ? 200 : 230, yR)));
  }
}

btnCombine.addEventListener("click", () => {
  if (selection.length !== 2) return;
  const a = selection[0];
  const b = selection[1];
  const hit = COMBO[a + b] || COMBO[b + a];
  if (hit) {
    const [ch, desc] = hit;
    resultEl.textContent = desc;
    stage.setCloud(ensureCloud("res:" + ch, () => buildTextCloud(ch, L.portrait ? 280 : 300, 0.2)), 1.5);
    stage.setColor("#ffd9a0");
    audio.pluck(NOTES.gongHigh);
  } else {
    resultEl.textContent = "这两个部件暂时没有对应的常用合体字，换一组试试。";
    audio.pluck(NOTES.yu);
  }
});

btnReset.addEventListener("click", () => {
  selection = [];
  syncChips();
  resultEl.textContent = "";
  applyCombineCloud();
});

// ---------- 数据小节动画 ----------
const dataEl = document.getElementById("data");
const barsIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    dataEl.querySelectorAll(".bar-row").forEach((row, i) => {
      const v = Number(row.dataset.value);
      const fill = row.querySelector(".bar-fill");
      setTimeout(() => {
        fill.style.width = ((v / 47035) * 100).toFixed(1) + "%";
      }, 120 * i);
    });
    barsIO.disconnect();
  });
}, { threshold: 0.3 });
barsIO.observe(dataEl);

// ---------- 启动 ----------
stage.setInitialCloud("idle");
stage.setColor(sections[0].color, 0.01);
stage.setBackground(sections[0].bg);
stage.setOpacity(sections[0].opacity);
eraName.textContent = sections[0].era;

// 深链接：刷新/分享可直达某一章（#act-seal 等）；延迟到模块初始化完成后执行，避免 TDZ
let startIdx = sections.findIndex((s) => s.id === location.hash.slice(1));
if (startIdx < 0) startIdx = 0;
setTimeout(() => {
  // 深链接会触发浏览器原生锚点滚动（叠加在 transform 上导致串屏），先复位
  window.scrollTo(0, 0);
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  if (startIdx > 0) {
    mainEl.style.transition = "none";
    goTo(startIdx, true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mainEl.style.transition = "";
      });
    });
  } else {
    goTo(0, true);
  }
  // 首帧就绪后淡出加载开场
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById("loader");
      if (el) {
        el.classList.add("done");
        setTimeout(() => el.remove(), 800);
      }
    });
  });
}, 0);
window.addEventListener("load", () => window.scrollTo(0, 0));

// 首访微引导：目录逐项点亮一次（减少动态偏好下不播）
try {
  if (!REDUCED && !sessionStorage.getItem("zs_nudge") && startIdx === 0) {
    sessionStorage.setItem("zs_nudge", "1");
    tocItems.forEach((el, i) => {
      setTimeout(() => {
        el.classList.add("lit");
        setTimeout(() => el.classList.remove("lit"), 460);
      }, 900 + i * 80);
    });
  }
} catch (e) {
  /* ignore */
}

window.addEventListener("resize", () => stage.resize());

// DEV 测试钩子（交付前移除）：?dev=solo:timeline:木:250 / solo:write:go / solo:quiz:go / solo:combine:日月:go
// 也支持 ?dev=go:5 直接跳章节、?dev=timeline:木:250 等
const devRaw = new URLSearchParams(location.search).get("dev") ||
  (location.hash.startsWith("#dev=") ? decodeURIComponent(location.hash.slice(5)) : "");
if (devRaw) {
  setTimeout(() => {
    const parts = devRaw.split(":");
    const solo = parts[0] === "solo";
    const target = solo ? parts[1] : parts[0];
    const args = solo ? parts.slice(2) : parts.slice(1);
    if (solo) {
      const origBlend = stage.setBlend.bind(stage);
      stage.setBlend = (a, b, t) => {
        window.__lastKey = a + "|" + b + "@" + t.toFixed(2);
        return origBlend(a, b, t, false);
      };
      stage.setCloud = (k) => {
        window.__lastKey = k;
        if (stage.clouds[k]) stage.setInitialCloud(k);
      };
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (s.id !== target) el.style.display = "none";
      }
      const idx = sections.findIndex((s) => s.id === target);
      if (idx >= 0) {
        currentIndex = idx;
        applySection(sections[idx]);
      }
      mainEl.style.transition = "none";
      mainEl.style.transform = "translateX(0)";
    } else if (target === "go") {
      mainEl.style.transition = "none";
      goTo(Number(args[0]) || 0, true);
    } else {
      mainEl.style.transition = "none";
      const idx = sections.findIndex((s) => s.id === target);
      if (idx >= 0) goTo(idx, true);
    }
    setTimeout(() => {
      if (target === "timeline") {
        if (args[0]) libChar = args[0];
        syncLibChips();
        if (args[1] !== undefined) {
          libProgress = Number(args[1]) / 100;
          rangeEl.value = args[1];
        }
        showTimeline(true);
      }
      if (target === "combine") {
        const chars = (args[0] || "").split("").filter(Boolean);
        chars.forEach((ch) => {
          const b = chipsEl.querySelector('[data-ch="' + ch + '"]');
          if (b) b.click();
        });
        if (args[1] === "go") btnCombine.click();
      }
      if (target === "write") {
        if (args[0] === "name") {
          setWriteMode("name");
          nameInput.value = "牛景飞";
          nameGenerateBtn.click();
        } else {
          if (args[0] === "guide" || args[0] === "grade" || args[0] === "evolve") {
            setWriteMode("guide");
            guideCharSel.value = "牛";
            updateGuideInfo();
          }
          const mk = (pts) => {
            const st = pts.map(([x, y]) => ({ x, y, w: 7 }));
            inkStrokes.push(st);
            inkCtx.strokeStyle = "rgba(233,230,223,.85)";
            inkCtx.lineWidth = 7;
            inkCtx.lineCap = "round";
            inkCtx.lineJoin = "round";
            inkCtx.beginPath();
            inkCtx.moveTo(st[0].x, st[0].y);
            for (let i = 1; i < st.length; i++) inkCtx.lineTo(st[i].x, st[i].y);
            inkCtx.stroke();
          };
          mk([[240, 150], [270, 132], [300, 128], [330, 132], [360, 150]]);
          mk([[300, 140], [300, 440]]);
          mk([[230, 270], [370, 270]]);
          inkHasContent = true;
          if (args[0] === "hsgo") {
            // 等增强引擎就绪后再粒子化（测试用）
            let n = 0;
            const iv = setInterval(() => {
              n++;
              if (window.__hsReady || n > 80) {
                clearInterval(iv);
                document.getElementById("btn-particle").click();
              }
            }, 250);
          } else if (args[0] === "go") {
            document.getElementById("btn-particle").click();
          }
          if (args[0] === "grade") document.getElementById("btn-grade").click();
          if (args[0] === "evolve") {
            document.getElementById("btn-grade").click();
            setTimeout(() => {
              const b = recogCard.querySelector("[data-evolve]");
              if (b) b.click();
            }, 600);
          }
        }
      }
      if (target === "quiz") {
        if (args[0] === "meaning" || args[0] === "meaning-go") {
          qs = 1;
          quizRound = [];
          startQuizRound();
        }
        if (args[0] === "order" || args[0] === "order-go") {
          qs = 2;
          quizRound = [];
          startQuizRound();
        }
        const t = devQuizCorrectText();
        const btn = t && [...quizOptsEl.querySelectorAll("button")].find((b) => b.textContent === t);
        const go = args[0] === "go" || (args[0] || "").endsWith("go");
        if (go && btn) btn.click();
      }
      if (target === "drawer") {
        tocDrawer.style.transition = "none";
        openDrawer();
      }
    }, 700);
  }, 900);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stage.update(dt);
  stage.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
