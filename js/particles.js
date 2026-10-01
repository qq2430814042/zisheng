// particles.js — 粒子引擎：点云采样、形态过渡、渲染
import * as THREE from "../vendor/three.module.js";

const FONT_STACK = '"KaiTi","STKaiti","楷体","Microsoft YaHei",serif';

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 在给定画布尺寸上采样每个簇（cluster）内部的点，返回统一数量的世界坐标
// clusters: [{x, y, w, h}]；drawAll(ctx, W, H) 负责把内容画到画布上
export function makeClusterCloud(W, H, clusters, count, drawAll, worldW, worldH) {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  drawAll(ctx, W, H);
  const img = ctx.getImageData(0, 0, W, H).data;

  const K = clusters.length;
  const base = Math.floor(count / K);
  const pos = new Float32Array(count * 3);
  let write = 0;

  for (let k = 0; k < K; k++) {
    const c = clusters[k];
    const n = k === K - 1 ? count - write : base;
    const x0 = Math.max(0, Math.floor(c.x));
    const y0 = Math.max(0, Math.floor(c.y));
    const x1 = Math.min(W - 1, Math.ceil(c.x + c.w));
    const y1 = Math.min(H - 1, Math.ceil(c.y + c.h));
    const cand = [];
    for (let y = y0; y <= y1; y += 2) {
      for (let x = x0; x <= x1; x += 2) {
        if (img[(y * W + x) * 4 + 3] > 100) cand.push(x, y);
      }
    }
    const cn = cand.length / 2;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    const items = [];
    for (let i = 0; i < n; i++) {
      const j = cn > 0 ? (Math.random() * cn) | 0 : 0;
      const px = (cn > 0 ? cand[j * 2] : cx) + (Math.random() - 0.5) * 2.4;
      const py = (cn > 0 ? cand[j * 2 + 1] : cy) + (Math.random() - 0.5) * 2.4;
      const dx = px - cx;
      const dy = py - cy;
      items.push({ px, py, a: Math.atan2(dy, dx), r: Math.hypot(dx, dy) });
    }
    items.sort((p, q) => (p.a - q.a) || (p.r - q.r));
    for (let i = 0; i < items.length; i++) {
      const { px, py } = items[i];
      pos[write * 3] = (px / W - 0.5) * worldW;
      pos[write * 3 + 1] = -(py / H - 0.5) * worldH;
      pos[write * 3 + 2] = (Math.random() - 0.5) * 0.3;
      write++;
    }
  }
  return pos;
}

// 圆形星云点云（开篇与背景氛围）
export function makeDiskCloud(count, radius) {
  const pos = new Float32Array(count * 3);
  const items = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    items.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.62, a: a, r: r });
  }
  items.sort((p, q) => (p.a - q.a) || (p.r - q.r));
  for (let i = 0; i < count; i++) {
    pos[i * 3] = items[i].x;
    pos[i * 3 + 1] = items[i].y;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
  }
  return pos;
}

export class ParticleStage {
  constructor(canvas, count) {
    this.count = count;
    this.clouds = {};
    this.current = new Float32Array(count * 3);
    this.from = new Float32Array(count * 3);
    this.target = null;
    this.morphT = 1;
    this.morphDur = 1.3;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.current, 3));
    const rand = new Float32Array(count * 3);
    const shade = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      rand[i * 3] = Math.random();
      rand[i * 3 + 1] = Math.random();
      rand[i * 3 + 2] = Math.random();
      shade[i] = 0.55 + Math.random() * 0.6;
    }
    geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 3));
    geo.setAttribute("aShade", new THREE.BufferAttribute(shade, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2.6 },
        uPixel: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uColor: { value: new THREE.Color("#e8dcc8") },
        uOpacity: { value: 1 },
      },
      vertexShader: `
        attribute vec3 aRand;
        attribute float aShade;
        uniform float uTime, uSize, uPixel;
        varying float vShade;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.45 + aRand.x * 6.2832) * 0.035;
          p.y += cos(uTime * 0.52 + aRand.y * 6.2832) * 0.035;
          p.z += sin(uTime * 0.3 + aRand.z * 6.2832) * 0.08;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * uPixel * (10.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
          vShade = aShade;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vShade;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.02, d) * uOpacity * vShade;
          gl_FragColor = vec4(uColor, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.scene.add(this.points);

    this.bg = new THREE.Color("#0b0b0f");
    this.bgTarget = new THREE.Color("#0b0b0f");
    this.colorTarget = new THREE.Color("#e8dcc8");
    this.opacityTarget = 1;

    this.worldW = 10;
    this.worldH = 10;
    this.resize();
  }

  addCloud(key, positions) {
    this.clouds[key] = positions;
  }

  hasCloud(key) { return !!this.clouds[key]; }

  setCloud(key, duration = 1.3) {
    const target = this.clouds[key];
    if (!target || target === this.target) return;
    this.from.set(this.current);
    this.target = target;
    this.morphDur = duration;
    this.morphT = 0;
  }

  setWorld(worldW, worldH) {
    this.worldW = worldW;
    this.worldH = worldH;
    this.fitCamera();
  }

  setColor(hex, dur = 1.2) {
    this.colorTarget = new THREE.Color(hex);
    this.colorDur = dur;
    this.colorT = 0;
  }

  setOpacity(v) { this.opacityTarget = v; }

  setBackground(hex) { this.bgTarget = new THREE.Color(hex); }

  fitCamera() {
    const aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight || 1;
    this.camera.aspect = aspect;
    const fov = (this.camera.fov * Math.PI) / 180;
    const zH = (this.worldH / 2) / Math.tan(fov / 2);
    const zW = (this.worldW / 2) / (Math.tan(fov / 2) * aspect);
    this.camera.position.z = Math.max(zH, zW) * 1.12;
    this.camera.updateProjectionMatrix();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.fitCamera();
  }

  update(dt) {
    this.material.uniforms.uTime.value += dt;

    // 形态过渡
    if (this.target && this.morphT < 1) {
      this.morphT = Math.min(1, this.morphT + dt / this.morphDur);
      const e = easeInOutCubic(this.morphT);
      const from = this.from;
      const to = this.target;
      const cur = this.current;
      for (let i = 0; i < cur.length; i++) {
        cur[i] = from[i] + (to[i] - from[i]) * e;
      }
      this.points.geometry.attributes.position.needsUpdate = true;
      if (this.morphT >= 1) {
        cur.set(to);
        this.points.geometry.attributes.position.needsUpdate = true;
      }
    }

    // 颜色过渡
    this.material.uniforms.uColor.value.lerp(this.colorTarget, 1 - Math.exp(-dt * 3));
    this.material.uniforms.uOpacity.value += (this.opacityTarget - this.material.uniforms.uOpacity.value) * (1 - Math.exp(-dt * 3));
    this.bg.lerp(this.bgTarget, 1 - Math.exp(-dt * 2.2));
    this.renderer.setClearColor(this.bg, 1);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  setInitialCloud(key) {
    const c = this.clouds[key];
    if (!c) return;
    this.current.set(c);
    this.target = c;
    this.morphT = 1;
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  projectX(x) {
    const v = new THREE.Vector3(x, 0, 0).project(this.camera);
    return (v.x * 0.5 + 0.5) * this.renderer.domElement.clientWidth;
  }

  // 连续混合两个点云（用于时间轴拖动）；animate=true 时以缓动过渡到混合状态
  setBlend(keyA, keyB, t, animate = false) {
    const a = this.clouds[keyA];
    const b = this.clouds[keyB];
    if (!a || !b) return;
    if (!this._blendBuf) this._blendBuf = new Float32Array(this.count * 3);
    const s = this._blendBuf;
    for (let i = 0; i < s.length; i++) s[i] = a[i] + (b[i] - a[i]) * t;
    if (animate) {
      this.from.set(this.current);
      this.target = s;
      this.morphDur = 1.0;
      this.morphT = 0;
    } else {
      this.current.set(s);
      this.target = s;
      this.morphT = 1;
      this.points.geometry.attributes.position.needsUpdate = true;
    }
  }
}
