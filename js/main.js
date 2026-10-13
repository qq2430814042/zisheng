// main.js — 叙事控制、构字互动与数据动画
import { ParticleStage, makeClusterCloud, makeDiskCloud } from "./particles.js";
import { CHARS, LIB, RECOG, STAGES, STAGE_NAMES, drawGlyph, ETY, STROKE_COUNT, EVO_CHARS, EVO_COUNT, evoAvailable, evoFontOk, ensureEvo, STROKES, evoRadical, evoStrokes, radicalChar } from "./glyphs.js";
import { COMBO, COMBO_ALIAS } from "./combo-data.js";
import { RECOG_STROKES } from "./stroke-counts.js";
import { AmbientAudio, NOTES } from "./audio.js";

const STAGE_NOTE = {
  oracle: NOTES.gong,
  bronze: NOTES.shang,
  bamboo: NOTES.jue,
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

// 各阶段大致年代（扩展字库的"字形档案"用）
const STAGE_ERA = {
  oracle: "商",
  bronze: "商周",
  "bamboo-silk": "战国—汉",
  seal: "秦",
  clerical: "汉",
  regular: "今",
};
const EVO_ANCIENT = ["oracle", "bronze", "bamboo-silk", "seal", "clerical"];

// 某字是否可在"一字千年"中推演（精选 30 或全量字库 14,873）
function hasEvo(ch) {
  return !!STROKES[ch] || !!evoAvailable(ch);
}

// 某字的阶段序列：精选 30 字固定五体；扩展字按实际收录的阶段（可缺早期阶段）
function seqOf(ch) {
  if (LIB.includes(ch)) return STROKES[ch] ? STAGES : null;
  const av = evoAvailable(ch);
  if (!av) return null;
  const seq = EVO_ANCIENT.filter((s) => av.includes(s));
  if (!seq.length) return null;
  seq.push("regular");
  return seq;
}

const FONT_STACK = '"ZiShengKai","KaiTi","STKaiti","楷体","Microsoft YaHei",serif';

// 内嵌楷体就绪后再构建粒子（避免用回退字体采样字形）；最多等待 3 秒。
// 传作品实际用到的字符集：字墙/五幕在模块顶层就要栅格化，必须确保这些字符已就绪
await Promise.race([
  document.fonts.load('64px "ZiShengKai"', LIB.join("") + "写名字").catch(() => {}),
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
stage.reduced = REDUCED;
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
  if (SIDE) {
    // 让开左侧文字面板：按实际窗口宽度反推面板右缘（世界坐标），
    // 五个字（±5.82 世界单位中心跨度 + 1.167 单字半宽）整体缩放平移进右半区
    const vw = Math.max(761, window.innerWidth);
    const padLeft = Math.max(0.06 * vw + 96, 196);
    const panelRightPx = padLeft + Math.min(450, 0.4 * vw);
    const worldPerPx = worldW / vw;
    const leftWorld = (panelRightPx + 40) * worldPerPx - worldW / 2;
    const rightWorld = worldW / 2 - 0.25;
    const halfSpan = 5.82 + 1.167;
    const s = Math.min(0.8, (rightWorld - leftWorld) / (halfSpan * 2));
    shiftCloud(pos, leftWorld + halfSpan * s, 0, s);
  }
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
// 简帛一幕：精选字补齐数据集中的"简帛"阶段（墨迹），再构建该幕点云
for (const ch of CHARS) await ensureEvo(ch);
stage.addCloud("act-bamboo", buildActCloud("bamboo-silk"));
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

// 尾声：30 字字墙（10×3 或 6×5 网格；桌面右移让开左侧目录）
function buildFinaleCloud() {
  const cols = L.portrait ? 6 : 10;
  const rows = L.portrait ? 5 : 3;
  const startX = L.portrait ? 0 : L.W * 0.17;
  const spanW = L.portrait ? L.W : L.W * 0.82;
  const cellW = spanW / cols;
  const cellH = (L.H * 0.6) / rows;
  const size = Math.min(cellW, cellH) * 0.62;
  const y0 = L.H * 0.12 + cellH / 2;
  const cells = [];
  LIB.forEach((ch, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    cells.push({ ch, cx: startX + cellW * (c + 0.5), cy: y0 + r * cellH });
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
  { id: "act-bamboo", label: "简帛", cloud: "act-bamboo", color: "#d8c8a8", bg: "#0d0b08", era: "简帛 · 战国—汉", opacity: 1 },
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
// ---------- 目录视图（sections[] 的唯一视图；只决定"怎么呈现"，不改章节本身） ----------
// 硬约束：不移动/增删/重排 <main> 的 section，不改 sections[] 的索引与字段
const NAV_GROUPS = [
  { key: "hero", name: "开篇", items: [0] },
  { key: "evolve", name: "演变", items: [1, 2, 3, 4, 5, 6, 7] },
  { key: "write", name: "书写", items: [9] },
  { key: "read", name: "辨字", items: [10, 8] },
  { key: "data", name: "数据", items: [11] },
  { key: "end", name: "收束", items: [12, 13] },
];

let activeGroupKey = "hero";
const navLeafEls = {}; // sectionIndex -> [桌面元素, 抽屉元素]
const groupHeads = {}; // key -> { desk, mob }
const groupEls = {}; // key -> { desk, mob }
const lightItems = []; // 首访点亮（桌面可见项）
let tocPosEl = null;
const drawerListEl = document.getElementById("toc-list-mobile");

function registerLeaf(idx, el, light) {
  (navLeafEls[idx] = navLeafEls[idx] || []).push(el);
  if (light) lightItems.push(el);
}

function buildGroup(listEl, g, mobile) {
  const li = document.createElement("li");
  li.className = "toc-group";
  const head = document.createElement("button");
  head.type = "button";
  head.className = "toc-item toc-group-head";
  head.setAttribute("aria-expanded", "false");
  head.innerHTML = mobile
    ? '<span class="toc-label">' + g.name + "</span>"
    : '<i class="toc-tick" aria-hidden="true"></i><span class="toc-label">' + g.name + "</span>";
  if (!mobile) lightItems.push(head);
  const sub = document.createElement("ul");
  sub.className = "toc-group-items";
  g.items.forEach((idx) => {
    const s = sections[idx];
    const sli = document.createElement("li");
    const a = document.createElement("a");
    a.className = "toc-item toc-sub";
    a.href = "#" + s.id;
    a.title = s.label;
    const hot = s.id === "combine" ? '<em class="toc-hot">特色</em>' : "";
    a.innerHTML = mobile
      ? '<span class="toc-label">' + s.label + "</span>" + hot + '<i class="num">' + String(idx + 1).padStart(2, "0") + "</i>"
      : '<i class="toc-tick" aria-hidden="true"></i><span class="toc-label">' + s.label + "</span>" + hot;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      goTo(idx);
      if (mobile) closeDrawer();
    });
    sli.appendChild(a);
    sub.appendChild(sli);
    registerLeaf(idx, a, false);
  });
  head.setAttribute("aria-label", g.name + "：进入第一项「" + sections[g.items[0]].label + "」");
  head.addEventListener("click", () => {
    // 点大标题 = 直达该组第一项；导航后本组自动展开、其他组收起（稳定手风琴）
    goTo(g.items[0]);
    if (mobile) closeDrawer();
  });
  li.appendChild(head);
  li.appendChild(sub);
  listEl.appendChild(li);
  groupHeads[g.key] = groupHeads[g.key] || {};
  groupEls[g.key] = groupEls[g.key] || {};
  groupHeads[g.key][mobile ? "mob" : "desk"] = head;
  groupEls[g.key][mobile ? "mob" : "desk"] = li;
}

function buildHero(listEl, mobile) {
  const s = sections[0];
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.className = "toc-item toc-entry";
  a.href = "#" + s.id;
  a.title = s.label;
  a.innerHTML = mobile
    ? '<span class="toc-label">' + s.label + '</span><i class="num">01</i>'
    : '<i class="toc-tick" aria-hidden="true"></i><span class="toc-label">' + s.label + "</span>";
  a.addEventListener("click", (e) => {
    e.preventDefault();
    goTo(0);
    if (mobile) closeDrawer();
  });
  li.appendChild(a);
  listEl.appendChild(li);
  registerLeaf(0, a, !mobile);
}

function renderNavState() {
  NAV_GROUPS.forEach((g) => {
    // 稳定手风琴：任何时刻只有"当前组"展开，不再随悬停跳动
    const open = g.key === activeGroupKey;
    const heads = groupHeads[g.key];
    const els = groupEls[g.key];
    if (!heads) return;
    if (heads.desk) {
      heads.desk.setAttribute("aria-expanded", open ? "true" : "false");
      heads.desk.classList.toggle("active", g.key === activeGroupKey);
      els.desk.classList.toggle("open", open);
    }
    if (heads.mob) {
      heads.mob.setAttribute("aria-expanded", open ? "true" : "false");
      heads.mob.classList.toggle("active", g.key === activeGroupKey);
      els.mob.classList.toggle("open", open);
    }
  });
}

// 只在初始化执行一次；applySection 里只调 syncNavActive，禁止重建 DOM
function buildNav() {
  const inner = document.createElement("div");
  inner.className = "toc-inner";
  const rootUl = document.createElement("ul");
  rootUl.className = "toc-root";
  inner.appendChild(rootUl);
  tocPosEl = document.createElement("div");
  tocPosEl.className = "toc-pos";
  inner.appendChild(tocPosEl);
  navEl.appendChild(inner);

  NAV_GROUPS.forEach((g) => {
    if (g.key === "hero" && g.items.length === 1) {
      buildHero(rootUl, false);
      buildHero(drawerListEl, true);
    } else {
      buildGroup(rootUl, g, false);
      buildGroup(drawerListEl, g, true);
    }
  });
}

function syncNavActive(sec) {
  const idx = sections.indexOf(sec);
  for (const key in navLeafEls) {
    const on = Number(key) === idx;
    navLeafEls[key].forEach((el) => {
      el.classList.toggle("active", on);
      if (on) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
  }
  const g = NAV_GROUPS.find((gr) => gr.items.includes(idx));
  if (g) activeGroupKey = g.key;
  renderNavState();
  tocPosEl.textContent = String(idx + 1).padStart(2, "0") + " / " + String(sections.length).padStart(2, "0");
}

buildNav();
syncNavActive(sections[0]);

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

// 音色选择（四个音色，记忆用户偏好）
const timbreSel = document.getElementById("timbre-sel");
try {
  const saved = localStorage.getItem("zisheng-timbre");
  if (saved && audio.setTimbre(saved)) timbreSel.value = saved;
} catch (e) {
  /* ignore */
}
timbreSel.addEventListener("change", () => {
  audio.setTimbre(timbreSel.value);
  try {
    localStorage.setItem("zisheng-timbre", timbreSel.value);
  } catch (e) {
    /* ignore */
  }
  if (audio.enabled) audio.pluck(NOTES.gongHigh);
});

// 开篇"构字实验室"特色入口
document.getElementById("hero-combine").addEventListener("click", () => {
  const i = sections.findIndex((s) => s.id === "combine");
  if (i >= 0) goTo(i);
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
  syncNavActive(sec);
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
  const hash = "#" + sections[i].id;
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

window.addEventListener("hashchange", () => {
  const idx = sections.findIndex((s) => s.id === location.hash.slice(1));
  if (idx >= 0 && idx !== currentIndex) goTo(idx, true);
});

let wheelAcc = 0;
let wheelLockUntil = 0;
// 事件目标处于"还能沿该方向滚动"的容器内时，放行原生滚动（如构字面板、矮屏面板）
function canScrollIn(el, deltaY) {
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.scrollHeight > el.clientHeight + 2) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") {
        if (deltaY < 0 && el.scrollTop > 0) return true;
        if (deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 2) return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}
window.addEventListener(
  "wheel",
  (e) => {
    // 浮层 / 抽屉 / 目录 / 字库网格内部滚动优先：放行，不拦滚轮、不切章节
    if (e.target && e.target.closest && e.target.closest("#lib-overlay, #toc-drawer, #nav")) return;
    if (canScrollIn(e.target, e.deltaY)) return;
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
const TOUCH_IGNORE_SEL =
  "input, select, button, a, canvas, #ety-card, #toc-drawer, #lib-overlay, [role=dialog]";
window.addEventListener(
  "touchstart",
  (e) => {
    touchIgnore = !!(e.target.closest && e.target.closest(TOUCH_IGNORE_SEL));
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
const timeNoteEl = document.getElementById("time-note");

LIB.forEach((ch) => {
  const b = document.createElement("button");
  b.className = "lib-chip";
  b.dataset.ch = ch;
  b.textContent = ch;
  b.addEventListener("click", () => loadLibChar(ch, true));
  libChipsEl.appendChild(b);
});

// 扩展字库选择器（14,873 字）
const libMoreBtn = document.createElement("button");
libMoreBtn.className = "lib-chip lib-more";
libMoreBtn.textContent = "更多字 " + EVO_COUNT.toLocaleString("zh-CN") + " ›";
libChipsEl.appendChild(libMoreBtn);

const libOverlay = document.getElementById("lib-overlay");
const libGridEl = document.getElementById("lib-grid");
const libSearchEl = document.getElementById("lib-search");
const libRadSel = document.getElementById("lib-radical");
const libStrSel = document.getElementById("lib-strokes");
const libMatchEl = document.getElementById("lib-match");
document.getElementById("lib-count").textContent = EVO_COUNT.toLocaleString("zh-CN") + " 字";
libMoreBtn.addEventListener("click", () => {
  libOverlay.classList.add("open");
  libOverlay.setAttribute("aria-hidden", "false");
  libSearchEl.value = "";
  libRadSel.value = "0";
  libStrSel.value = "0";
  renderLibGrid(false);
  libSearchEl.focus();
});
function closeLibOverlay() {
  libOverlay.classList.remove("open");
  libOverlay.setAttribute("aria-hidden", "true");
  libPickCb = null;
}
// 以"挑选部件"模式打开字库网格（用于构字选字/更多部件）
let libPickCb = null;
function openLibPicker(cb) {
  libPickCb = cb;
  libOverlay.classList.add("open");
  libOverlay.setAttribute("aria-hidden", "false");
  libSearchEl.value = "";
  libRadSel.value = "0";
  libStrSel.value = "0";
  renderLibGrid(false);
  libSearchEl.focus();
}
document.getElementById("lib-close").addEventListener("click", closeLibOverlay);
libOverlay.addEventListener("click", (e) => {
  if (e.target === libOverlay) closeLibOverlay();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && libOverlay.classList.contains("open")) closeLibOverlay();
});

let libGridLimit = 480;
let libCells = null;
// 只算一次：14,873 字的可用阶段、字体覆盖与部首/笔画（首开网格时构建，之后复用）
function ensureLibCells() {
  if (libCells) return libCells;
  libCells = [];
  for (const ch of EVO_CHARS) {
    const ancient = evoAvailable(ch);
    if (!ancient || !ancient.length) continue;
    let cls = "lib-cell";
    if (ancient[0] !== "oracle") cls += " no-oracle";
    if (!evoFontOk(ch)) cls += " no-font";
    libCells.push({
      ch,
      cls,
      title: ancient.map((s) => STAGE_NAMES[s]).join(" · "),
      rad: evoRadical(ch),
      st: evoStrokes(ch),
    });
  }
  return libCells;
}

// 部首 / 笔画下拉：全部 + 214 部首 / 36 画
(function fillLibFilters() {
  let opts = '<option value="0">全部部首</option>';
  for (let n = 1; n <= 214; n++) {
    opts += '<option value="' + n + '">' + radicalChar(n) + " " + n + " 部</option>";
  }
  libRadSel.innerHTML = opts;
  opts = '<option value="0">全部笔画</option>';
  for (let n = 1; n <= 36; n++) {
    opts += '<option value="' + n + '">' + n + " 画</option>";
  }
  libStrSel.innerHTML = opts;
})();

function libFilteredCells() {
  const q = libSearchEl.value.trim();
  const r = Number(libRadSel.value) || 0;
  const s = Number(libStrSel.value) || 0;
  return ensureLibCells().filter(
    (c) => (!q || c.ch === q || c.ch.includes(q)) && (!r || c.rad === r) && (!s || c.st === s)
  );
}

function renderLibGrid(more) {
  if (!more) libGridLimit = 480;
  const matches = libFilteredCells();
  const total = matches.length;
  const n = Math.min(total, libGridLimit);
  let html = "";
  for (let i = 0; i < n; i++) {
    const cell = matches[i];
    html += '<button class="' + cell.cls + '" data-ch="' + cell.ch + '" title="' + cell.title + '">' + cell.ch + "</button>";
  }
  if (total > n) {
    html += '<button class="lib-cell lib-loadmore" id="lib-loadmore">显示更多（还有 ' + (total - n) + " 字）</button>";
  }
  libGridEl.innerHTML = html || '<p class="lib-empty">没有找到这个字</p>';
  libMatchEl.textContent = total ? "共 " + total.toLocaleString("zh-CN") + " 字" : "";
  const lm = document.getElementById("lib-loadmore");
  if (lm) {
    lm.addEventListener("click", () => {
      libGridLimit += 480;
      renderLibGrid(true);
    });
  }
}
libSearchEl.addEventListener("input", () => renderLibGrid(false));
libRadSel.addEventListener("change", () => renderLibGrid(false));
libStrSel.addEventListener("change", () => renderLibGrid(false));
document.getElementById("lib-random").addEventListener("click", () => {
  const matches = libFilteredCells();
  if (!matches.length) return;
  const pick = matches[Math.floor(Math.random() * matches.length)];
  if (libPickCb) {
    const cb = libPickCb;
    closeLibOverlay();
    cb(pick.ch);
    return;
  }
  closeLibOverlay();
  loadLibChar(pick.ch, true);
});
libGridEl.addEventListener("click", (e) => {
  const b = e.target.closest(".lib-cell[data-ch]");
  if (!b) return;
  const ch = b.dataset.ch;
  if (libPickCb) {
    const cb = libPickCb;
    closeLibOverlay();
    cb(ch);
    return;
  }
  closeLibOverlay();
  loadLibChar(ch, true);
});

function syncLibChips() {
  libChipsEl.querySelectorAll(".lib-chip[data-ch]").forEach((el) => {
    el.classList.toggle("active", el.dataset.ch === libChar);
  });
}

function renderTimeLabels(seq) {
  timeLabelsEl.innerHTML = seq.map((s) => "<span>" + STAGE_NAMES[s] + "</span>").join("");
}

function updateTimeNote(seq) {
  timeNoteEl.classList.remove("loading");
  const ancient = seq.filter((s) => s !== "regular");
  if (LIB.includes(libChar)) {
    timeNoteEl.classList.remove("show");
    return;
  }
  let note;
  if (ancient.length === 1) {
    note = "目前仅见「" + STAGE_NAMES[ancient[0]] + "」形态——更早的字形还没有被找到。";
  } else {
    note = "收录 " + ancient.length + " 个历史阶段：" + ancient.map((s) => STAGE_NAMES[s]).join(" → ");
    if (!ancient.includes("oracle")) note += "。甲骨文暂未见此字——有的字出生得晚，这也是汉字的故事。";
  }
  timeNoteEl.textContent = note;
  timeNoteEl.classList.add("show");
}

async function loadLibChar(ch, animate) {
  libChar = ch;
  syncLibChips();
  const seq = seqOf(ch) || STAGES;
  rangeEl.max = String((seq.length - 1) * 100);
  rangeEl.value = "0";
  libProgress = 0;
  renderTimeLabels(seq);
  updateTimeNote(seq);
  if (!STROKES[ch] && evoAvailable(ch)) {
    timeNoteEl.textContent = "正在加载「" + ch + "」的字形…";
    timeNoteEl.classList.add("show", "loading");
    const ok = await ensureEvo(ch, { retry: true });
    if (libChar !== ch) return;
    if (!ok) {
      timeNoteEl.classList.remove("loading");
      timeNoteEl.textContent = "字形数据加载失败——请检查网络后重新选择该字，或刷新页面重试";
      return;
    }
  }
  if (!document.fonts.check('64px "ZiShengKai"', ch)) {
    timeNoteEl.textContent = "正在加载「" + ch + "」的字体（首次使用，约 0.3–1 MB）…";
    timeNoteEl.classList.add("show", "loading");
  }
  await document.fonts.load('64px "ZiShengKai"', ch).catch(() => {});
  if (libChar !== ch) return;
  updateTimeNote(seq);
  if (activeId === "timeline") showTimeline(animate);
}

const timelineLRU = [];
function timelineCloudKey(ch, stageName) {
  const key = ensureCloud("s:" + ch + ":" + stageName, () => buildSingleCloud(ch, stageName));
  if (!timelineLRU.includes(key)) {
    timelineLRU.push(key);
    while (timelineLRU.length > 30) stage.removeCloud(timelineLRU.shift());
  }
  return key;
}

function showTimeline(animate) {
  const seq = seqOf(libChar) || STAGES;
  if (!STROKES[libChar] && evoAvailable(libChar)) {
    ensureEvo(libChar).then((ok) => {
      if (ok && STROKES[libChar]) {
        if (activeId === "timeline") showTimeline(animate);
      } else if (!STROKES[libChar]) {
        timeNoteEl.textContent = "字形数据加载失败——请检查网络后重新选择该字，或刷新页面重试";
        timeNoteEl.classList.add("show");
      }
    });
    return;
  }
  const i = Math.max(0, Math.min(seq.length - 2, Math.floor(libProgress)));
  const t = Math.min(1, libProgress - i);
  const keyA = timelineCloudKey(libChar, seq[i]);
  const keyB = timelineCloudKey(libChar, seq[i + 1]);
  stage.setBlend(keyA, keyB, t, animate);
  const idx = Math.round(libProgress);
  [...timeLabelsEl.children].forEach((el, k) => el.classList.toggle("on", k === idx));
}

rangeEl.addEventListener("input", () => {
  clearInterval(evolveTimer); // 用户手动拖动即接管，停止自动推演
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

// 多字检测：整体过于扁平才判"写了不止一个字"
// 注意：阈值 2.2——左右结构单字（好/明/休/林）常见宽高比 1.3–1.8，不能误伤；
// 不用"空白列"判据（川/三/小等单字本身就有竖向空白，会误判）
function looksMultiChar() {
  if (!inkHasContent) return false;
  const { bw, bh } = inkBBox();
  return bw / bh > 2.2 && bw > inkCanvas.width * 0.5;
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
  try {
    inkCanvas.setPointerCapture(e.pointerId);
  } catch (err) {
    /* 合成/异常指针：无捕获照常书写 */
  }
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

// HanScribe 加载三态：idle / loading / ready / failed（失败可重试）
let hsState = "idle";
let hsFallbackPending = false;

function applyWriteCloud() {
  if (activeId !== "write") return;
  // 懒加载增强识别引擎（12,000+ 常用字，本地模型）
  if (!hsEngine && !hsLoading) {
    loadHanScribe().then((ok) => {
      if (!ok) {
        if (activeId === "write" && writeMode === "free") {
          writeHint.textContent = "离线状态：增强识别引擎不可用，已切换到快速识别（本地模板）";
        }
        return;
      }
      if (activeId === "write") {
        writeHint.textContent = "增强识别引擎已就绪——写下任意一个常用字试试";
        // 用户在加载期间已点了粒子化（快速识别兜底）：就绪后自动重识别一次
        if (hsFallbackPending && inkHasContent && writeMode === "free") {
          hsFallbackPending = false;
          particleize();
        }
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

function particleize() {
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
      let hs = null;
      try {
        hs = hsRecognize();
      } catch (e) {
        hs = null;
      }
      if (hs) {
        renderRecogCardHS(hs);
      } else {
        renderRecogCard(recognizeInk());
        if (hsState === "loading") {
          hsFallbackPending = true;
          writeHint.textContent = "增强识别引擎还在加载，先用快速识别——加载完成后会自动重试";
        } else if (hsState === "failed") {
          writeHint.textContent = "增强识别引擎不可用（离线），这是快速识别结果";
        } else {
          writeHint.textContent = "增强识别引擎尚未就绪，先用快速识别——稍后可重新粒子化";
        }
      }
    }
  } else {
    writeHint.textContent = "粒子接住了。点“评分”对照描红看看像不像。";
  }
}
document.getElementById("btn-particle").addEventListener("click", particleize);
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
nameGenerateBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim().replace(/\s+/g, "").slice(0, 4);
  if (!name) {
    writeHint.textContent = "先输入名字（2–4 字）";
    return;
  }
  writeHint.textContent = "正在生成…";
  await document.fonts.load('64px "ZiShengKai"', name).catch(() => {});
  const size = name.length >= 4 ? 200 : name.length === 3 ? 240 : 280;
  stage.addCloud("name:user", buildTextCloud(name, size, 0.5));
  stage.setCloud("name:user", 1.5);
  stage.setColor("#ffd9a0");
  nameSaveBtn.disabled = false;
  writeHint.textContent = "生成好了——可以点“保存图片”带走它";
  audio.pluck(NOTES.gongHigh);
  const uniq = [...new Set(name.split(""))].filter((c) => hasEvo(c));
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

let savingName = false;
function saveNameImage() {
  if (savingName) return;
  savingName = true;
  setTimeout(() => {
    savingName = false;
  }, 1200);
  const cloud = stage.clouds["name:user"];
  if (!cloud) return;
  // 固定 pixelRatio=1：不同 DPI 机器导出构图/清晰度一致
  const prevPR = stage.renderer.getPixelRatio ? stage.renderer.getPixelRatio() : 1;
  stage.renderer.setPixelRatio(1);
  stage.resize();
  stage.render();
  const src = stage.renderer.domElement;

  // 粒子云屏幕包围盒（每 7 个点采样一次足够精确）
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < cloud.length; i += 21) {
    const p = stage.projectPoint(cloud[i], cloud[i + 1]);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) {
    minX = 0; minY = 0; maxX = src.width; maxY = src.height;
  }

  const out = document.createElement("canvas");
  out.width = 1920;
  out.height = 1080;
  const c = out.getContext("2d");
  const grad = c.createLinearGradient(0, 0, 1920, 1080);
  grad.addColorStop(0, "#0b0b0f");
  grad.addColorStop(1, "#14100a");
  c.fillStyle = grad;
  c.fillRect(0, 0, 1920, 1080);

  // 含边距的 fit（而非 cover），保证粒子字完整不裁边
  const padX = 130, padTop = 210, padBottom = 175;
  const avW = 1920 - padX * 2;
  const avH = 1080 - padTop - padBottom;
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const scale = Math.min(avW / bw, avH / bh, 4);
  const dw = src.width * scale;
  const dh = src.height * scale;
  c.drawImage(src, (1920 - dw) / 2, padTop + (avH - dh) / 2, dw, dh);

  // 标题 + 可读的楷体名字 + 日期
  c.fillStyle = "rgba(233,230,223,.88)";
  c.font = '46px "ZiShengKai","KaiTi","STKaiti","楷体",serif';
  c.textAlign = "left";
  c.fillText("名字 · 星图", 84, 132);
  c.fillStyle = "rgba(233,230,223,.5)";
  c.font = '24px "Microsoft YaHei",sans-serif';
  c.fillText("《字·生》——汉字五体演变的粒子交互体验", 86, 176);
  c.textAlign = "right";
  c.fillText(new Date().toLocaleDateString("zh-CN"), 1836, 132);

  const name = nameInput.value.trim().replace(/\s+/g, "").slice(0, 4);
  c.textAlign = "center";
  c.fillStyle = "rgba(224,179,106,.92)";
  c.font = '76px "ZiShengKai","KaiTi","STKaiti","楷体",serif';
  c.fillText(name, 960, 1006);
  c.fillStyle = "rgba(233,230,223,.35)";
  c.font = '20px "Microsoft YaHei",sans-serif';
  c.fillText("名字的每一笔，都是汉字的三千年", 960, 1052);

  // 恢复现场
  stage.renderer.setPixelRatio(prevPR);
  stage.resize();
  stage.render();

  writeHint.textContent = "已保存图片";
  audio.pluck(NOTES.gongHigh);
  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = "字生-名字星图.png";
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}
nameSaveBtn.addEventListener("click", saveNameImage);

// ---- 导出当前画面（任意章节，一键保存 1920×1080 PNG） ----
function exportSnapshot() {
  const prevPR = stage.renderer.getPixelRatio ? stage.renderer.getPixelRatio() : 1;
  stage.renderer.setPixelRatio(1);
  stage.resize();
  stage.render();
  const src = stage.renderer.domElement;
  const out = document.createElement("canvas");
  out.width = 1920;
  out.height = 1080;
  const c = out.getContext("2d");
  const scale = Math.max(1920 / src.width, 1080 / src.height);
  const dw = src.width * scale;
  const dh = src.height * scale;
  c.drawImage(src, (1920 - dw) / 2, (1080 - dh) / 2, dw, dh);
  // 底部信息带
  const grad = c.createLinearGradient(0, 780, 0, 1080);
  grad.addColorStop(0, "rgba(6,6,10,0)");
  grad.addColorStop(1, "rgba(6,6,10,.8)");
  c.fillStyle = grad;
  c.fillRect(0, 760, 1920, 320);
  const label = (sections[currentIndex] && sections[currentIndex].label) || "《字·生》";
  const era = eraName.textContent || "";
  c.fillStyle = "rgba(233,230,223,.92)";
  c.font = '54px "ZiShengKai","KaiTi","STKaiti","楷体",serif';
  c.textAlign = "left";
  c.fillText(label, 84, 1008);
  c.fillStyle = "rgba(233,230,223,.55)";
  c.font = '26px "Microsoft YaHei",sans-serif';
  c.fillText("《字·生》——汉字五体演变的粒子交互体验" + (era && era !== label ? " · " + era : ""), 86, 1052);
  c.textAlign = "right";
  c.font = '24px "Microsoft YaHei",sans-serif';
  c.fillText(new Date().toLocaleDateString("zh-CN"), 1836, 1008);
  stage.renderer.setPixelRatio(prevPR);
  stage.resize();
  stage.render();
  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = "字生-" + label + ".png";
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
  audio.pluck(NOTES.gongHigh);
}

const snapBtn = document.getElementById("snap-btn");
let snapBusy = false;
snapBtn.addEventListener("click", () => {
  if (snapBusy) return;
  snapBusy = true;
  snapBtn.classList.add("busy");
  snapBtn.textContent = "已保存 ✓";
  try {
    exportSnapshot();
  } catch (e) {
    snapBtn.textContent = "导出失败";
  }
  setTimeout(() => {
    snapBusy = false;
    snapBtn.classList.remove("busy");
    snapBtn.textContent = "存图";
  }, 1200);
});

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
  hsState = "loading";
  hsLoading = (async () => {
    const mod = await getHsLib();
    let wasmBytes;
    let modelBuf;
    if (window.__HS_WASM_B64 && window.__HS_MODEL_B64) {
      wasmBytes = b64ToU8(window.__HS_WASM_B64).buffer;
      modelBuf = b64ToU8(window.__HS_MODEL_B64).buffer;
    } else {
      const [w, m] = await Promise.all([
        fetch("vendor/hanscribe-inference.wasm").then((r) => {
          if (!r.ok) throw new Error("wasm http " + r.status);
          return r.arrayBuffer();
        }),
        fetch("vendor/hanscribe.hzmodel").then((r) => {
          if (!r.ok) throw new Error("model http " + r.status);
          return r.arrayBuffer();
        }),
      ]);
      wasmBytes = w;
      modelBuf = m;
    }
    const model = mod.parseHzModel(modelBuf);
    hsEngine = await mod.createWasmEngine(wasmBytes, model.header, model.weights);
    hsVocab = model.vocab;
    hsLib = mod;
    hsState = "ready";
    return true;
  })().catch(() => {
    // 失败：允许下次进入写字章或点击粒子化时重试（不锁死）
    hsState = "failed";
    hsLoading = null;
    return false;
  });
  return hsLoading;
}

// 用增强引擎识别墨迹；未就绪返回 null（调用方回退旧引擎）；source 可传任意笔迹数组
function hsRecognize(source = inkStrokes) {
  if (!hsEngine || !hsLib) return null;
  const strokes = source
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
  // 只保留汉字候选（HanScribe 词表含拉丁字母等，过滤后再取 Top-3）
  const isHan = (ch) => /^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]$/.test(ch);
  const out = res.indices.map((idx, k) => ({ ch: hsVocab[idx], score: res.scores[k] })).filter((r) => isHan(r.ch));
  return out.length ? out : null;
}

// 增强引擎结果卡：高置信直接确认，否则 Top-3 点选
function renderRecogCardHS(results) {
  const top = results[0];
  const second = results[1] || { ch: "", score: 0 };
  recogCard.hidden = false;
  const pct = (s) => Math.min(99, Math.round(s * 100));
  if (top.score >= 0.85 && top.score - second.score >= 0.25) {
    if (hasEvo(top.ch)) {
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
        "%）。它在字形库中暂未收录——可能是很晚才出现的字。</div>" +
        '<div class="recog-actions"><button data-again>再写一次</button></div>';
      writeHint.textContent = "认出来了——这个字的三千年暂时还没有";
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
  if (hasEvo(ch)) {
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
      "</b>。它在字形库中暂未收录——可能是很晚才出现的字。</div>" +
      '<div class="recog-actions"><button data-again>再写一次</button></div>';
    writeHint.textContent = "认出来了——这个字的三千年暂时还没有";
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
    if (hasEvo(top.ch)) {
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
        "%）。它在字形库中暂未收录——可能是很晚才出现的字。</div>" +
        '<div class="recog-actions"><button data-again>再写一次</button></div>';
      writeHint.textContent = "认出来了——这个字的三千年暂时还没有";
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
let gradeBusy = false;
btnGrade.addEventListener("click", () => {
  if (gradeBusy) return;
  gradeBusy = true;
  setTimeout(() => {
    gradeBusy = false;
  }, 700);
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
  const temps = TEMPLATES[guideTarget] || [];
  let simRaw = 0;
  for (const t of temps) {
    const s = similarity(f, t);
    if (s > simRaw) simRaw = s;
  }
  const sim = Math.min(95, Math.round(simRaw * 100));
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
async function showEvolution(ch, fromKey) {
  const seq = seqOf(ch);
  if (!seq) {
    const hint = document.getElementById("write-hint");
    if (hint) hint.textContent = "「" + ch + "」的字形演变暂未收录——有的字出生得晚。试试：我、爱、好、明、学、山、水、人…";
    return;
  }
  libChar = ch;
  syncLibChips();
  libProgress = 0;
  rangeEl.max = String((seq.length - 1) * 100);
  rangeEl.value = 0;
  renderTimeLabels(seq);
  updateTimeNote(seq);
  const idx = sections.findIndex((s) => s.id === "timeline");
  if (idx >= 0) goTo(idx);
  clearInterval(evolveTimer);
  if (!STROKES[ch] && evoAvailable(ch)) {
    timeNoteEl.textContent = "正在加载「" + ch + "」的字形…";
    timeNoteEl.classList.add("show", "loading");
    const ok = await ensureEvo(ch, { retry: true });
    if (libChar !== ch) return;
    if (!ok) {
      timeNoteEl.classList.remove("loading");
      timeNoteEl.textContent = "字形数据加载失败——请检查网络后重试";
      return;
    }
  }
  if (!document.fonts.check('64px "ZiShengKai"', ch)) {
    timeNoteEl.textContent = "正在加载「" + ch + "」的字体（首次使用，约 0.3–1 MB）…";
    timeNoteEl.classList.add("show", "loading");
  }
  await document.fonts.load('64px "ZiShengKai"', ch).catch(() => {});
  if (libChar !== ch) return;
  updateTimeNote(seq);
  const firstKey = timelineCloudKey(ch, seq[0]);
  const maxV = (seq.length - 1) * 100;
  const startPlay = () => {
    let v = 0;
    evolveTimer = setInterval(() => {
      // 用户已切走章节：停止推演，避免在别的章节里悄悄改变粒子云
      if (activeId !== "timeline" || libChar !== ch) {
        clearInterval(evolveTimer);
        return;
      }
      v += 4;
      if (v >= maxV) {
        v = maxV;
        clearInterval(evolveTimer);
      }
      rangeEl.value = v;
      libProgress = v / 100;
      showTimeline(false);
      if (v >= maxV) {
        setTimeout(() => {
          if (activeId === "timeline" && libChar === ch) showEtyCard(ch);
        }, 700);
      }
    }, 55);
  };
  if (fromKey && stage.clouds[fromKey]) {
    stage.setBlend(fromKey, fromKey, 0, false);
    stage.setBlend(fromKey, firstKey, 1, true);
    setTimeout(startPlay, 1550);
  } else {
    showTimeline(true);
    startPlay();
  }
  pluckForChar(ch);
}

function showEtyCard(ch) {
  const e = ETY[ch];
  document.getElementById("ety-char").textContent = ch;
  if (e) {
    document.getElementById("ety-method").textContent = e.method;
    document.getElementById("ety-meaning").textContent = "本义：" + e.meaning;
    document.getElementById("ety-note").textContent = e.note;
  } else {
    const seq = seqOf(ch) || [];
    const ancient = seq.filter((s) => s !== "regular");
    document.getElementById("ety-method").textContent = "字形流变";
    document.getElementById("ety-meaning").textContent =
      ancient.length && STAGE_ERA[ancient[0]] ? "可见最早形态：" + STAGE_NAMES[ancient[0]] + " · " + STAGE_ERA[ancient[0]] : "";
    let note =
      ancient.length === 1
        ? "该字目前仅见「" + STAGE_NAMES[ancient[0]] + "」形态，更早的字形还没有被找到。"
        : "该字共收录 " + ancient.length + " 个历史字形。";
    if (ancient.length > 1 && !ancient.includes("oracle")) note += "甲骨文暂未见此字——它出现得比较晚。";
    note += "精选 30 字附完整释读考据；扩展字形来自开源古文字数据集。";
    document.getElementById("ety-note").textContent = note;
  }
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

// ---------- 认字：三关制（认形 / 知义 / 辨体）× 三档难度 ----------
// 简单：干扰项字形相差远、辨体相隔远；普通：默认；困难：认形全字库随机+同部首干扰、辨体比相邻字体
const QUIZ_LEVELS = {
  easy: {
    name: "简单",
    stages: [
      { key: "shape", name: "认形", count: 6, dist: "far", lead: "热身关：看字形猜今字——干扰项字形相差很远。" },
      { key: "meaning", name: "知义", count: 4, lead: "理解关：它的本义是什么？" },
      { key: "order", name: "辨体", count: 3, lead: "时间关：左右两个字形，哪一个更早？（相隔较远，好认）", pairs: [[0, 3], [0, 4], [1, 4]] },
    ],
  },
  normal: {
    name: "普通",
    stages: [
      { key: "shape", name: "认形", count: 10, dist: "near", lead: "热身关：看字形猜今字——这个甲骨文是今天的哪个字？" },
      { key: "meaning", name: "知义", count: 6, lead: "理解关：它的本义是什么？" },
      { key: "order", name: "辨体", count: 4, lead: "时间关：左右两个字形，哪一个更早？", pairs: [[0, 2], [1, 3], [2, 4], [0, 4]] },
    ],
  },
  hard: {
    name: "困难",
    stages: [
      { key: "shape", name: "认形", count: 12, dist: "radical", lead: "挑战关：从全字库随机抽取的甲骨文，干扰项同部首——小心认。", },
      { key: "meaning", name: "知义", count: 8, lead: "理解关：它的本义是什么？" },
      { key: "order", name: "辨体", count: 5, lead: "时间关：相邻字体最难分辨——哪一个更早？", pairs: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    ],
  },
};
let quizLevel = "normal";
try {
  const savedLv = localStorage.getItem("zisheng-quiz-level");
  if (savedLv && QUIZ_LEVELS[savedLv]) quizLevel = savedLv;
} catch (e) {
  /* ignore */
}
let QUIZ_STAGES = QUIZ_LEVELS[quizLevel].stages;
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

// 难度选择（三档，记忆偏好；切换即重开一轮）
const quizLvBtns = Array.from(document.querySelectorAll(".quiz-levels button"));
function syncQuizLevelUI() {
  quizLvBtns.forEach((b) => b.classList.toggle("on", b.dataset.lv === quizLevel));
}
quizLvBtns.forEach((b) =>
  b.addEventListener("click", () => {
    if (b.dataset.lv === quizLevel) return;
    quizLevel = b.dataset.lv;
    try {
      localStorage.setItem("zisheng-quiz-level", quizLevel);
    } catch (e) {
      /* ignore */
    }
    QUIZ_STAGES = QUIZ_LEVELS[quizLevel].stages;
    qs = 0;
    qi = 0;
    quizScore = 0;
    quizRound = [];
    syncQuizLevelUI();
    if (activeId === "quiz") startQuizRound();
  })
);
syncQuizLevelUI();

function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

// 轮次不重样：记住最近用过的字（localStorage 持久化），下一轮优先排除
let quizRecent = [];
try {
  const saved = JSON.parse(localStorage.getItem("zisheng-quiz-recent") || "[]");
  if (Array.isArray(saved)) quizRecent = saved.filter((c) => typeof c === "string" && c.length === 1);
} catch (e) {
  /* ignore */
}
function quizSaveRecent() {
  try {
    localStorage.setItem("zisheng-quiz-recent", JSON.stringify(quizRecent));
  } catch (e) {
    /* ignore */
  }
}
function pickQuizChars(pool, n) {
  let fresh = pool.filter((c) => !quizRecent.includes(c));
  let picked = shuffleArr(fresh.slice()).slice(0, n);
  if (picked.length < n) {
    // 池子快用完：只保留最近 6 个在记忆里，其余释放后补足
    quizRecent = quizRecent.slice(-6);
    fresh = pool.filter((c) => !quizRecent.includes(c) && !picked.includes(c));
    picked = picked.concat(shuffleArr(fresh).slice(0, n - picked.length));
  }
  quizRecent = quizRecent.concat(picked).slice(-40);
  quizSaveRecent();
  return picked;
}

// 困难级认形题库：全字库中有甲骨文且有内嵌字体的字（一次构建，之后复用）
let evoQuizPool = null;
function getEvoQuizPool() {
  if (!evoQuizPool) {
    evoQuizPool = [];
    for (const ch of EVO_CHARS) {
      const av = evoAvailable(ch);
      if (av && av.includes("oracle") && evoFontOk(ch)) evoQuizPool.push(ch);
    }
  }
  return evoQuizPool;
}

function templateSim(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d;
}

function makeShapeQuestion(ch, dist) {
  if (dist === "radical") {
    // 困难：全字库字形 + 同部首干扰（部首太小时用随机字补足）
    const rad = evoRadical(ch);
    const pool = getEvoQuizPool().filter((c) => c !== ch);
    let mates = rad ? pool.filter((c) => evoRadical(c) === rad) : [];
    mates = shuffleArr(mates).slice(0, 3);
    if (mates.length < 3) {
      const extra = shuffleArr(pool.filter((c) => !mates.includes(c))).slice(0, 3 - mates.length);
      mates = mates.concat(extra);
    }
    return { ch, opts: shuffleArr([ch].concat(mates)), evo: true };
  }
  const ranked = LIB.filter((c) => c !== ch)
    .map((c) => ({ c, s: templateSim(TEMPLATES[ch][1], TEMPLATES[c][1]) }))
    .sort((x, y) => y.s - x.s);
  const others = dist === "far" ? ranked.slice(-3) : ranked.slice(0, 3);
  return { ch, opts: shuffleArr([ch].concat(others.map((o) => o.c))) };
}

function makeMeaningQuestion(ch) {
  const others = shuffleArr(LIB.filter((c) => c !== ch && ETY[c])).slice(0, 3);
  return { ch, opts: shuffleArr([ch, ...others]) };
}

function makeOrderQuestion(ch, pairs) {
  const pl = pairs || [
    [0, 2],
    [0, 4],
    [1, 3],
    [1, 4],
    [2, 4],
  ];
  const p = pl[Math.floor(Math.random() * pl.length)];
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
  const chars =
    lv.key === "shape" && lv.dist === "radical"
      ? pickQuizChars(getEvoQuizPool(), lv.count)
      : pickQuizChars(LIB, lv.count);
  quizRound = chars.map((ch) =>
    lv.key === "shape" ? makeShapeQuestion(ch, lv.dist) : lv.key === "meaning" ? makeMeaningQuestion(ch) : makeOrderQuestion(ch, lv.pairs)
  );
  qi = 0;
  renderQuestion(true);
}

const quizLRU = [];
function quizGlyphCloud(q) {
  const lv = QUIZ_STAGES[qs];
  let key;
  let k;
  if (lv.key === "order") {
    key = "quiz:pair:" + q.ch + ":" + q.left + ":" + q.right;
    k = ensureCloud(key, () => buildPairCloud(q.ch, STAGES[q.left], STAGES[q.right]));
  } else {
    key = "quiz:" + q.ch + ":oracle";
    k = ensureCloud(key, () => buildSingleCloud(q.ch, "oracle", 0.3));
  }
  // 认字点云 LRU：一轮 20 题 + 多轮不再无限累积
  if (!quizLRU.includes(k)) {
    quizLRU.push(k);
    while (quizLRU.length > 24) stage.removeCloud(quizLRU.shift());
  }
  return k;
}

function renderQuestion(animate) {
  const lv = QUIZ_STAGES[qs];
  const q = quizRound[qi];
  if (!q) return;
  quizWrong = false;
  clearTimeout(quizTimer);
  quizLeadEl.textContent = lv.lead;
  // 困难级认形：全字库字形需异步加载（首次慢，之后缓存秒开）
  if (q.evo && !STROKES[q.ch]) {
    quizFeedbackEl.textContent = "字形加载中……";
    ensureEvo(q.ch).then((ok) => {
      if (quizRound[qi] !== q) return;
      if (!ok) {
        quizFeedbackEl.textContent = "字形加载失败——跳过这一题。";
        quizTimer = setTimeout(quizAdvance, 1600);
        return;
      }
      quizFeedbackEl.textContent = "";
      stage.setCloud(quizGlyphCloud(q), 1.1);
      stage.setColor("#ffd9a0");
    });
  } else {
    stage.setCloud(quizGlyphCloud(q), animate ? 1.1 : false);
    stage.setColor("#ffd9a0");
  }
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
      let note;
      if (ETY[q.ch]) {
        note = ETY[q.ch].note;
      } else {
        const av = evoAvailable(q.ch);
        const radTxt = evoRadical(q.ch) ? "属「" + radicalChar(evoRadical(q.ch)) + "」部" : "";
        note = "『" + q.ch + "』" + radTxt + (av ? "，字库中首见" + STAGE_NAMES[av[0]] + "。" : "。");
      }
      quizFeedbackEl.textContent = "对！" + note;
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

// ---------- 构字互动（选字 + 手写，双入口） ----------
const QUICK_PARTS = ["日", "月", "木", "火", "水", "人", "女", "子", "口", "马", "鸟", "心", "风", "土"];
let selection = [];
let combineMode = "pick";
const chipsEl = document.getElementById("chips");
const btnCombine = document.getElementById("btn-combine");
const btnReset = document.getElementById("btn-reset");
const resultEl = document.getElementById("combine-result");
const combineModePickBtn = document.getElementById("combine-mode-pick");
const combineModeWriteBtn = document.getElementById("combine-mode-write");
const combinePickEl = document.getElementById("combine-pick");
const combineWriteEl = document.getElementById("combine-write");

QUICK_PARTS.forEach((ch) => {
  const b = document.createElement("button");
  b.className = "chip";
  b.dataset.ch = ch;
  b.textContent = ch;
  b.addEventListener("click", () => {
    const i = selection.indexOf(ch);
    if (i >= 0) selection.splice(i, 1);
    else {
      if (selection.length >= 2) selection.shift();
      selection.push(ch);
    }
    syncChips();
    applyCombineCloud();
  });
  chipsEl.appendChild(b);
});

document.getElementById("chips-more").addEventListener("click", () => {
  openLibPicker((ch) => {
    if (selection.length >= 2) selection.shift();
    selection.push(ch);
    syncChips();
    applyCombineCloud();
  });
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

// 组合查询：直接 / 部首归一（水→氵）/ 反序，依次尝试
function comboLookup(a, b) {
  const variants = (x) => (COMBO_ALIAS[x] && COMBO_ALIAS[x] !== x ? [x, COMBO_ALIAS[x]] : [x]);
  const tryPairs = (x, y) => {
    for (const c1 of variants(x)) {
      for (const c2 of variants(y)) {
        if (COMBO[c1 + c2]) return { key: c1 + c2, hit: COMBO[c1 + c2] };
      }
    }
    return null;
  };
  return tryPairs(a, b) || tryPairs(b, a);
}

const STRUCT_NAME = { "⿰": "左右结构", "⿱": "上下结构", "⿺": "左下包围", "⿵": "上三包围", "⿸": "左上包围", "⿴": "包围结构", "⿻": "穿插结构" };

// 构字章节点云 LRU：反复挑选/合成不再累积
const combineLRU = [];
function combineCloud(key) {
  if (!combineLRU.includes(key)) {
    combineLRU.push(key);
    while (combineLRU.length > 24) stage.removeCloud(combineLRU.shift());
  }
  return key;
}

async function showCombineResult(a, b) {
  const found = comboLookup(a, b);
  if (!found) {
    resultEl.innerHTML =
      "<div>「" + a + "」和「" + b + "」在字海里还没有相遇——换个部件试试。</div>" +
      '<div class="cr-actions"><button id="cr-random">随机推荐一组</button></div>';
    audio.pluck(NOTES.yu);
    document.getElementById("cr-random").addEventListener("click", randomCombo);
    setTimeout(() => resultEl.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
    return;
  }
  const { key, hit } = found;
  const c1 = key[0];
  const c2 = key[1];
  const canEvo = hasEvo(hit.r);
  await document.fonts.load('64px "ZiShengKai"', hit.r).catch(() => {});
  const rk = "res:" + hit.r;
  stage.addCloud(rk, buildTextCloud(hit.r, L.portrait ? 260 : 290, 0.2));
  stage.setCloud(combineCloud(rk), 1.5);
  stage.setColor("#ffd9a0");
  audio.pluck(NOTES.gongHigh);
  resultEl.innerHTML =
    '<div class="cr-head"><b>' + hit.r + "</b><i>" + (STRUCT_NAME[hit.s] || "") + " · " + hit.s + " · " + hit.t + "</i></div>" +
    '<div class="cr-parts">部件：' + c1 + " + " + c2 + "</div>" +
    (hit.t === "拆解" ? '<div class="cr-src">结构拆解 · 数据：CCD 汉字拆解表（Wikimedia Commons）</div>' : "") +
    '<div class="cr-actions">' +
    (hit.n ? '<button id="cr-note">看解读（' + hit.t + "）</button>" : "") +
    (canEvo ? '<button id="cr-evolve">看它三千年</button>' : "") +
    '<button id="cr-again">再来一组</button></div>' +
    (hit.n ? '<div class="cr-note" hidden>' + hit.n + "</div>" : "") +
    (canEvo ? "" : '<div class="cr-late">「' + hit.r + "」出现较晚，字形库里还没有它的古代身形——这本身也是汉字的故事。</div>");
  const noteBtn = document.getElementById("cr-note");
  if (noteBtn) {
    noteBtn.addEventListener("click", () => {
      const n = resultEl.querySelector(".cr-note");
      n.hidden = !n.hidden;
      noteBtn.textContent = n.hidden ? "看解读（" + hit.t + "）" : "收起解读";
    });
  }
  const evoBtn = document.getElementById("cr-evolve");
  if (evoBtn) evoBtn.addEventListener("click", () => showEvolution(hit.r, rk));
  document.getElementById("cr-again").addEventListener("click", resetCombine);
  setTimeout(() => resultEl.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
}

function randomCombo() {
  const keys = Object.keys(COMBO);
  const curated = keys.filter((k) => COMBO[k].t !== "拆解");
  const pool = Math.random() < 0.7 && curated.length ? curated : keys;
  const k = pool[Math.floor(Math.random() * pool.length)];
  selection = [k[0], k[1]];
  syncChips();
  showCombineResult(k[0], k[1]);
}

function resetCombine() {
  selection = [];
  cwParts = [null, null];
  cwStrokes = [];
  cwCurrent = null;
  cwRedraw();
  cwSyncSlots();
  cwRecogEl.hidden = true;
  cwCombineBtn.disabled = true;
  resultEl.textContent = "";
  syncChips();
  applyCombineCloud();
}

function applyCombineCloud() {
  if (activeId !== "combine") return;
  const yR = 0.22;
  if (combineMode === "write") {
    const slot = cwParts[0] || cwParts[1];
    if (slot) {
      stage.setCloud(combineCloud(ensureCloud("sel:" + slot, () => buildTextCloud(slot, L.portrait ? 260 : 300, yR))));
    } else {
      stage.setCloud(combineCloud(ensureCloud("sel:write", () => buildTextCloud("写", L.portrait ? 240 : 270, yR))));
    }
    return;
  }
  if (selection.length === 0) {
    resultEl.textContent = "选两个部件（或点『手写』亲手写）…";
    stage.setCloud(combineCloud(ensureCloud("sel:prompt", () => buildTextCloud("日月", L.portrait ? 220 : 250, yR))));
  } else if (selection.length === 1) {
    resultEl.textContent = "再选一个部件……";
    stage.setCloud(combineCloud(ensureCloud("sel:" + selection[0], L.portrait ? 260 : 300, yR)));
  } else {
    resultEl.textContent = "点“合成”看看会得到什么";
    const key = "sel:" + selection.join("");
    stage.setCloud(combineCloud(ensureCloud(key, () => buildTextCloud(selection.join(""), L.portrait ? 200 : 230, yR))));
  }
}

btnCombine.addEventListener("click", () => {
  if (selection.length !== 2) return;
  showCombineResult(selection[0], selection[1]);
});

btnReset.addEventListener("click", resetCombine);

// —— 手写模式 ——
const combineCanvas = document.getElementById("combine-canvas");
const cwCtx = combineCanvas.getContext("2d");
const cwRecogEl = document.getElementById("cw-recog");
const cwCombineBtn = document.getElementById("cw-combine");
let cwStrokes = [];
let cwCurrent = null;
let cwParts = [null, null];

function cwPos(e) {
  const r = combineCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (combineCanvas.width / r.width),
    y: (e.clientY - r.top) * (combineCanvas.height / r.height),
  };
}

function cwGrid() {
  const W = combineCanvas.width;
  const H = combineCanvas.height;
  cwCtx.save();
  cwCtx.strokeStyle = "rgba(233,230,223,.08)";
  cwCtx.lineWidth = 1;
  cwCtx.setLineDash([7, 9]);
  cwCtx.beginPath();
  cwCtx.moveTo(W / 2, 12);
  cwCtx.lineTo(W / 2, H - 12);
  cwCtx.moveTo(12, H / 2);
  cwCtx.lineTo(W - 12, H / 2);
  cwCtx.stroke();
  cwCtx.restore();
}

function cwRedraw() {
  cwCtx.clearRect(0, 0, combineCanvas.width, combineCanvas.height);
  cwGrid();
  cwCtx.strokeStyle = "rgba(233,230,223,.88)";
  cwCtx.fillStyle = "rgba(233,230,223,.88)";
  cwCtx.lineCap = "round";
  cwCtx.lineJoin = "round";
  cwCtx.lineWidth = 8;
  for (const st of cwStrokes) {
    if (st.length === 1) {
      cwCtx.beginPath();
      cwCtx.arc(st[0].x, st[0].y, 4, 0, Math.PI * 2);
      cwCtx.fill();
    } else {
      cwCtx.beginPath();
      cwCtx.moveTo(st[0].x, st[0].y);
      for (let i = 1; i < st.length; i++) cwCtx.lineTo(st[i].x, st[i].y);
      cwCtx.stroke();
    }
  }
}

combineCanvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  try {
    combineCanvas.setPointerCapture(e.pointerId);
  } catch (err) {
    /* ignore */
  }
  cwCurrent = [cwPos(e)];
  cwStrokes.push(cwCurrent);
});
combineCanvas.addEventListener("pointermove", (e) => {
  if (!cwCurrent) return;
  e.preventDefault();
  const p = cwPos(e);
  const last = cwCurrent[cwCurrent.length - 1];
  if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return;
  cwCurrent.push(p);
  cwRedraw();
});
function cwEnd() {
  cwCurrent = null;
}
combineCanvas.addEventListener("pointerup", cwEnd);
combineCanvas.addEventListener("pointercancel", cwEnd);

function cwSyncSlots() {
  [0, 1].forEach((i) => {
    const el = document.querySelector('#cw-slot-' + i + " .cw-char");
    if (el) el.textContent = cwParts[i] || "？";
  });
  cwCombineBtn.disabled = !(cwParts[0] && cwParts[1]);
}

function cwConfirm(ch) {
  const slot = cwParts[0] ? (cwParts[1] ? -1 : 1) : 0;
  if (slot < 0) {
    cwRecogEl.hidden = false;
    cwRecogEl.textContent = "两格已经满了——先点『合成』，或『清空』重来。";
    return;
  }
  cwParts[slot] = ch;
  cwSyncSlots();
  cwStrokes = [];
  cwCurrent = null;
  cwRedraw();
  cwRecogEl.hidden = true;
  audio.pluck(NOTES.gong);
  applyCombineCloud();
  if (cwParts[0] && cwParts[1]) {
    cwRecogEl.hidden = false;
    cwRecogEl.textContent = "两个部件都齐了——点『合 成』。";
  }
}

function cwRenderCandidates(ranked) {
  cwRecogEl.hidden = false;
  const pct = (s) => Math.min(99, Math.round(s * 100));
  const top = ranked[0];
  const second = ranked[1] || { score: 0 };
  if (top.score >= 0.85 && top.score - second.score >= 0.25) {
    cwRecogEl.innerHTML =
      "<div>认出来了：<b>" + top.ch + "</b>（" + pct(top.score) + "%）</div>" +
      '<div class="recog-actions"><button id="cw-use">就是这个</button><button id="cw-again">重写</button></div>';
    document.getElementById("cw-use").addEventListener("click", () => cwConfirm(top.ch));
    document.getElementById("cw-again").addEventListener("click", () => { cwStrokes = []; cwRedraw(); cwRecogEl.hidden = true; });
  } else {
    const cands = ranked.slice(0, 3);
    cwRecogEl.innerHTML =
      "<div>是哪一个？</div>" +
      '<div class="recog-actions">' +
      cands.map((c) => '<button data-cw="' + c.ch + '">' + c.ch + "（" + pct(c.score) + "%）</button>").join("") +
      '<button id="cw-again">都不是</button></div>';
    cwRecogEl.querySelectorAll("[data-cw]").forEach((b) =>
      b.addEventListener("click", () => cwConfirm(b.dataset.cw))
    );
    document.getElementById("cw-again").addEventListener("click", () => { cwStrokes = []; cwRedraw(); cwRecogEl.hidden = true; });
  }
}

document.getElementById("cw-particle").addEventListener("click", () => {
  if (!cwStrokes.length) {
    cwRecogEl.hidden = false;
    cwRecogEl.textContent = "先在画布上写一个部件（一笔也行）。";
    return;
  }
  const hs = hsRecognize(cwStrokes);
  if (hs) {
    cwRenderCandidates(hs);
  } else {
    cwRecogEl.hidden = false;
    cwRecogEl.textContent = hsState === "failed" ? "识别引擎不可用（离线）——切到『选字』方式吧。" : "识别引擎加载中，稍等一两秒再点一次。";
    if (!hsEngine && !hsLoading) loadHanScribe();
  }
});
document.getElementById("cw-undo").addEventListener("click", () => {
  cwStrokes.pop();
  cwRedraw();
});
document.getElementById("cw-clear").addEventListener("click", () => {
  cwStrokes = [];
  cwCurrent = null;
  cwRedraw();
  cwRecogEl.hidden = true;
});
cwCombineBtn.addEventListener("click", () => {
  if (cwParts[0] && cwParts[1]) showCombineResult(cwParts[0], cwParts[1]);
});

// —— 模式切换 ——
function setCombineMode(m) {
  combineMode = m;
  combineModePickBtn.classList.toggle("on", m === "pick");
  combineModeWriteBtn.classList.toggle("on", m === "write");
  combinePickEl.hidden = m !== "pick";
  combineWriteEl.hidden = m !== "write";
  resultEl.textContent = "";
  if (m === "write") {
    if (!hsEngine && !hsLoading) loadHanScribe();
    cwRedraw();
  }
  applyCombineCloud();
}
combineModePickBtn.addEventListener("click", () => setCombineMode("pick"));
combineModeWriteBtn.addEventListener("click", () => setCombineMode("write"));
cwSyncSlots();

// ---------- 数据小节动画 ----------
const dataEl = document.getElementById("data");
const barsIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    let k = 0;
    dataEl.querySelectorAll(".bars").forEach((box) => {
      const max = Number(box.dataset.max) || 47035;
      box.querySelectorAll(".bar-row").forEach((row) => {
        const v = Number(row.dataset.value);
        const fill = row.querySelector(".bar-fill");
        const delay = 120 * k++;
        setTimeout(() => {
          fill.style.width = ((v / max) * 100).toFixed(1) + "%";
        }, delay);
      });
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
    lightItems.forEach((el, i) => {
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

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stage.update(dt);
  stage.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
