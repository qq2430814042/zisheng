// main.js — 叙事控制、构字互动与数据动画
import { ParticleStage, makeClusterCloud, makeDiskCloud } from "./particles.js";
import { CHARS, LIB, STAGES, STAGE_NAMES, drawGlyph } from "./glyphs.js";
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
  data: NOTES.zhi,
};

const FONT_STACK = '"KaiTi","STKaiti","楷体","Microsoft YaHei",serif';

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

// 单字点云（一字千年章节 / 认字章节用，按需构建）
function buildSingleCloud(ch, stageName, yRatio = 0.3) {
  const size = L.portrait ? 280 : 360;
  const cx = L.W * (SIDE ? 0.71 : 0.5);
  const cy = L.H * (SIDE ? 0.5 : yRatio);
  const clusters = [{ x: cx - size / 2 - 20, y: cy - size / 2 - 20, w: size + 40, h: size + 40 }];
  const drawAll = (ctx) => drawGlyph(ctx, ch, stageName, cx, cy, size);
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
  { id: "about", label: "关于", cloud: "idle2", color: "#9ab8d8", bg: "#0a0b0f", era: "关于", opacity: 0.22 },
];

const eraName = document.getElementById("era-name");
const mainEl = document.querySelector("main");
const navEl = document.getElementById("nav");
const progressEl = document.querySelector("#progress i");
const tocItems = [];

sections.forEach((s, i) => {
  const a = document.createElement("a");
  a.className = "toc-item";
  a.href = "javascript:void(0)";
  a.innerHTML = "<span>" + s.label + "</span>";
  a.title = s.label;
  a.addEventListener("click", () => goTo(i));
  navEl.appendChild(a);
  tocItems.push(a);
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
  tocItems.forEach((el, i) => el.classList.toggle("active", sections[i].id === sec.id));
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
  progressEl.style.width = (((i + 1) / sections.length) * 100).toFixed(1) + "%";
  applySection(sections[i]);
}

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

// ---------- 写字：手写粒子化 ----------
const inkCanvas = document.getElementById("ink-canvas");
const inkCtx = inkCanvas.getContext("2d");
const writeHint = document.getElementById("write-hint");
let inkStrokes = [];
let inkCurrent = null;
let inkHasContent = false;

function inkClear() {
  inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
  inkStrokes = [];
  inkCurrent = null;
  inkHasContent = false;
  writeHint.textContent = "提示：鼠标或手指按住即可书写";
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
  inkCurrent = [inkPos(e)];
  inkStrokes.push(inkCurrent);
  inkHasContent = true;
});

inkCanvas.addEventListener("pointermove", (e) => {
  if (!inkCurrent) return;
  e.preventDefault();
  const p = inkPos(e);
  const last = inkCurrent[inkCurrent.length - 1];
  if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return;
  inkCurrent.push(p);
  inkCtx.strokeStyle = "rgba(233,230,223,.85)";
  inkCtx.lineWidth = 7;
  inkCtx.lineCap = "round";
  inkCtx.lineJoin = "round";
  inkCtx.beginPath();
  inkCtx.moveTo(last.x, last.y);
  inkCtx.lineTo(p.x, p.y);
  inkCtx.stroke();
});

function inkEnd() {
  if (!inkCurrent) return;
  if (inkCurrent.length === 1) {
    const p = inkCurrent[0];
    inkCtx.beginPath();
    inkCtx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    inkCtx.fillStyle = "rgba(233,230,223,.85)";
    inkCtx.fill();
  }
  inkCurrent = null;
}
inkCanvas.addEventListener("pointerup", inkEnd);
inkCanvas.addEventListener("pointercancel", inkEnd);

function buildInkCloud() {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const st of inkStrokes) {
    for (const p of st) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
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
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const st of inkStrokes) {
      if (st.length === 1) {
        ctx.beginPath();
        ctx.arc(st[0].x, st[0].y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(st[0].x, st[0].y);
        for (let i = 1; i < st.length; i++) ctx.lineTo(st[i].x, st[i].y);
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  const cluster = [{ x: 0, y: 0, w: L.W, h: L.H }];
  return makeClusterCloud(L.W, L.H, cluster, COUNT, drawAll, worldW, worldH);
}

function applyWriteCloud() {
  if (activeId !== "write") return;
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
  writeHint.textContent = "你的字，已经被粒子接住了";
  audio.pluck(NOTES.jue);
});
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
inkClear();

// ---------- 认字：甲骨文竞猜 ----------
const QUIZ = [
  { ch: "日", opts: ["日", "目", "口", "田"], tip: "圆的轮廓像太阳，里面的一笔是光的标记。" },
  { ch: "月", opts: ["月", "山", "水", "口"], tip: "弯弯的月牙，中间一竖是月的纹路。" },
  { ch: "山", opts: ["山", "火", "田", "大"], tip: "三座山峰连成一道山脉。" },
  { ch: "水", opts: ["水", "雨", "火", "人"], tip: "中间是水流，两旁是溅起的水滴。" },
  { ch: "人", opts: ["人", "大", "木", "月"], tip: "侧身站立的人，低头垂手。" },
  { ch: "木", opts: ["木", "大", "火", "山"], tip: "一棵树：树干、枝丫和根。" },
  { ch: "火", opts: ["火", "水", "山", "雨"], tip: "腾起的火苗和四溅的火星。" },
  { ch: "目", opts: ["目", "日", "口", "田"], tip: "一只眼睛，中间是瞳孔。" },
];
let quizIndex = 0;
let quizScore = 0;
let quizWrong = false;
const quizOptsEl = document.getElementById("quiz-options");
const quizFeedbackEl = document.getElementById("quiz-feedback");
const quizProgressEl = document.getElementById("quiz-progress");

function showQuizGlyph(animate) {
  const q = QUIZ[Math.min(quizIndex, QUIZ.length - 1)];
  if (quizIndex >= QUIZ.length) return;
  stage.setCloud(ensureCloud("quiz:" + q.ch + ":oracle", () => buildSingleCloud(q.ch, "oracle", 0.3)), animate ? 1.1 : false);
  stage.setColor("#ffd9a0");
}

function renderQuizQuestion() {
  if (quizIndex >= QUIZ.length) return;
  const q = QUIZ[quizIndex];
  quizWrong = false;
  quizOptsEl.innerHTML = "";
  q.opts.forEach((op) => {
    const b = document.createElement("button");
    b.textContent = op;
    b.addEventListener("click", () => answerQuiz(op, b));
    quizOptsEl.appendChild(b);
  });
  quizFeedbackEl.textContent = "";
  quizProgressEl.textContent = "第 " + (quizIndex + 1) + " / " + QUIZ.length + " 题 · 已认出 " + quizScore + " 个";
}

function answerQuiz(op, btn) {
  const q = QUIZ[quizIndex];
  if (op === q.ch) {
    btn.classList.add("right");
    quizOptsEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
    if (!quizWrong) quizScore++;
    quizFeedbackEl.textContent = "对！" + q.tip;
    audio.pluck(NOTES.zhi);
    stage.setCloud(ensureCloud("quiz:" + q.ch + ":regular", () => buildSingleCloud(q.ch, "regular", 0.3)), 1.0);
    setTimeout(() => {
      quizIndex++;
      if (quizIndex >= QUIZ.length) {
        showQuizEnd();
      } else {
        renderQuizQuestion();
        showQuizGlyph(true);
      }
    }, 1700);
  } else {
    if (!quizWrong) quizWrong = true;
    btn.classList.add("wrong");
    btn.disabled = true;
    quizFeedbackEl.textContent = "再想想……";
    audio.pluck(NOTES.yu);
  }
}

function showQuizEnd() {
  quizOptsEl.innerHTML = "";
  quizFeedbackEl.textContent = "全部答完！你认出了 " + quizScore + " / " + QUIZ.length + " 个甲骨文。";
  quizProgressEl.textContent = "";
  const again = document.createElement("button");
  again.textContent = "再来一轮";
  again.style.marginTop = "12px";
  again.addEventListener("click", () => {
    quizIndex = 0;
    quizScore = 0;
    renderQuizQuestion();
    showQuizGlyph(true);
  });
  quizOptsEl.appendChild(again);
  stage.setCloud(ensureCloud("quiz:done", () => buildTextCloud("字", L.portrait ? 260 : 300, 0.28)), 1.2);
}

function applyQuiz(animate) {
  if (activeId !== "quiz") return;
  if (quizIndex >= QUIZ.length) {
    showQuizEnd();
  } else {
    renderQuizQuestion();
    showQuizGlyph(animate);
  }
}

// ---------- 构字互动 ----------
const CHIPS = ["日", "月", "木", "人", "女", "子"];
const COMBO = {
  日月: ["明", "日月为明——日是太阳，月是月亮，天下最亮的两样合在一起，就是“明”。"],
  木木: ["林", "双木成林——两棵树并立，便是一片树林。"],
  人木: ["休", "人倚木为休——一个人靠在树旁，就是休息。"],
  女子: ["好", "女子为好——有孩子、有依靠，便是美好。"],
  日日: ["昌", "双日为昌——两个太阳，寓意光明与昌盛。"],
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
goTo(0, true);

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
        const mk = (pts) => {
          const st = pts.map(([x, y]) => ({ x, y }));
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
        mk([[200, 70], [230, 130], [260, 190], [285, 250]]);
        mk([[255, 165], [285, 230], [320, 290]]);
        inkHasContent = true;
        if (args[0] === "go") document.getElementById("btn-particle").click();
      }
      if (target === "quiz") {
        const q = QUIZ[Math.min(quizIndex, QUIZ.length - 1)];
        const btn = [...quizOptsEl.querySelectorAll("button")].find((b) => b.textContent === q.ch);
        if (args[0] === "go" && btn) btn.click();
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
