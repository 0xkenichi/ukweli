// The 3D stage: a balance scale between two agents.
// Evidence lands on each agent's pan as a tablet. Standing evidence weighs
// the scale down. Rebuttals fire a beam that shatters the other side's tablet.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const gsap = window.gsap;

export const COLORS = {
  ledger: 0xf2a33a,
  mpesa: 0x2fd27a,
  owner: 0x7b93ff,
  gold: 0xffcf6b,
};

const BEAM_HALF = 2.3;   // half the length of the scale's beam
const HANG = 1.35;       // how far the pans hang below the beam
const MAX_TILT = 0.24;   // radians
const SLOTS = [
  new THREE.Vector3(0, 0.36, 0.28),
  new THREE.Vector3(-0.34, 0.36, -0.18),
  new THREE.Vector3(0.34, 0.36, -0.18),
  new THREE.Vector3(0, 0.36, -0.5),
];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const tween = (target, vars) => new Promise(resolve => gsap.to(target, { ...vars, onComplete: resolve }));
const hex = c => "#" + c.toString(16).padStart(6, "0");

// ---------- Canvas textures for text ----------

function canvasTexture(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const redraw = (...args) => { ctx.clearRect(0, 0, w, h); draw(ctx, w, h, ...args); tex.needsUpdate = true; };
  return { tex, redraw };
}

function fitText(ctx, text, maxWidth, size, weight = 700, family = "Space Grotesk, system-ui, sans-serif") {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxWidth && s > 10);
}

// ---------- The stage ----------

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06070c);
    this.scene.fog = new THREE.FogExp2(0x06070c, 0.045);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.camBase = new THREE.Vector3(0, 3.6, 12);
    this.lookAt = new THREE.Vector3(0, 2.75, 0);
    this.camOffset = new THREE.Vector3();   // push-ins and shakes
    this.shake = 0;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.86);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.tilt = { value: 0, wobble: 0 };
    this.tablets = new Map();   // key -> tablet mesh
    this.counts = { ledger: 0, mpesa: 0 };

    this._lights();
    this._floor();
    this._dust();
    this._scale();
    this._avatars();
    this._effects();

    this.clock = new THREE.Clock();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.renderer.setAnimationLoop(() => this._frame());
  }

  // ----- Building the world -----

  _lights() {
    this.scene.add(new THREE.HemisphereLight(0x8090ff, 0x100804, 0.35));

    const key = new THREE.SpotLight(0xfff1dc, 60, 30, Math.PI / 6, 0.6, 1.6);
    key.position.set(0, 11, 4);
    key.target.position.set(0, 1, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    this.scene.add(key, key.target);

    this.rimLedger = new THREE.PointLight(COLORS.ledger, 14, 12, 1.6);
    this.rimLedger.position.set(-4.5, 3.4, 2);
    this.rimMpesa = new THREE.PointLight(COLORS.mpesa, 14, 12, 1.6);
    this.rimMpesa.position.set(4.5, 3.4, 2);
    this.truthLight = new THREE.PointLight(COLORS.gold, 0, 14, 1.4);
    this.truthLight.position.set(0, 4.2, 1.2);
    this.scene.add(this.rimLedger, this.rimMpesa, this.truthLight);
  }

  _floor() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(16, 96),
      new THREE.MeshStandardMaterial({ color: 0x0b0c12, metalness: 0.7, roughness: 0.32 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.rings = [2.1, 3.6, 5.4, 7.6].map((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.018, 160),
        new THREE.MeshBasicMaterial({ color: 0x8a7fff, transparent: true, opacity: 0.16 - i * 0.03, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.005;
      ring.userData.base = ring.material.opacity;
      this.scene.add(ring);
      return ring;
    });
  }

  _dust() {
    const n = reduceMotion ? 250 : 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 4 + Math.random() * 22;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.random() * 12;
      pos[i * 3 + 2] = Math.sin(a) * r - 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xb8b2ff, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false,
    }));
    this.scene.add(this.dust);
  }

  _scale() {
    const gold = new THREE.MeshStandardMaterial({ color: 0xd7a94b, metalness: 1, roughness: 0.22 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x16161c, metalness: 0.8, roughness: 0.3 });
    this.goldMat = gold;

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.22, 64), dark);
    base.position.y = 0.11;
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.025, 12, 96), gold);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.23;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 3.3, 32), gold);
    pillar.position.y = 1.85;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 16), gold);
    cap.position.y = 3.55;
    [base, pillar, cap].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
    this.scene.add(base, baseRing, pillar, cap);

    // The beam pivots at the top of the pillar.
    this.beam = new THREE.Group();
    this.beam.position.y = 3.42;
    const bar = new THREE.Mesh(new RoundedBoxGeometry(BEAM_HALF * 2, 0.09, 0.12, 3, 0.03), gold);
    bar.castShadow = true;
    this.beam.add(bar);
    for (const x of [-BEAM_HALF, BEAM_HALF]) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 12), gold);
      knob.position.x = x;
      this.beam.add(knob);
    }
    // The needle shows which way the truth leans.
    this.needle = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.6, 16), new THREE.MeshStandardMaterial({
      color: 0xfff2c8, emissive: COLORS.gold, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3,
    }));
    this.needle.position.y = 0.36;
    this.beam.add(this.needle);
    this.scene.add(this.beam);

    // Pans hang from the beam ends and stay level.
    this.pans = {};
    for (const side of ["ledger", "mpesa"]) {
      const pan = new THREE.Group();
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.72, 0.1, 64), gold);
      dish.castShadow = true;
      dish.receiveShadow = true;
      const glow = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.02, 8, 96),
        new THREE.MeshBasicMaterial({ color: COLORS[side], transparent: true, opacity: 0.85 })
      );
      glow.rotation.x = Math.PI / 2;
      glow.position.y = 0.05;
      pan.add(dish, glow);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
        const rim = new THREE.Vector3(Math.cos(a) * 0.88, 0.05, Math.sin(a) * 0.88);
        const top = new THREE.Vector3(0, HANG, 0);
        const len = rim.distanceTo(top);
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 6), gold);
        chain.position.copy(rim).lerp(top, 0.5);
        chain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(rim).normalize());
        pan.add(chain);
      }
      pan.userData.glow = glow;
      this.pans[side] = pan;
      this.scene.add(pan);
    }
  }

  _avatars() {
    // Ledger agent: a floating book whose cover shows its belief.
    const book = new THREE.Group();
    const leather = new THREE.MeshStandardMaterial({ color: 0x7a4310, roughness: 0.55, metalness: 0.1 });
    const pages = new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: 0.9 });
    const back = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.9, 0.06, 2, 0.02), leather);
    back.position.z = -0.12;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.8, 0.2), pages);
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.9, 24, 1, false, Math.PI, Math.PI), leather);
    spine.position.set(-0.74, 0, 0);
    this.ledgerCover = canvasTexture(512, 640, (ctx, w, h, amount, sub) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#a8601a");
      g.addColorStop(1, "#5a2e08");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255,214,150,.7)";
      ctx.lineWidth = 6;
      ctx.strokeRect(26, 26, w - 52, h - 52);
      ctx.fillStyle = "#ffe2b0";
      ctx.textAlign = "center";
      ctx.font = "600 34px Space Grotesk, system-ui, sans-serif";
      ctx.fillText("LEDGER", w / 2, 120);
      ctx.font = "500 24px Space Grotesk, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,226,176,.75)";
      ctx.fillText(sub || "SHOP BOOK", w / 2, 160);
      ctx.fillStyle = "#fff4dd";
      fitText(ctx, amount, w - 90, 104);
      ctx.fillText(amount, w / 2, h / 2 + 70);
    });
    const cover = new THREE.Mesh(
      new RoundedBoxGeometry(1.5, 1.9, 0.06, 2, 0.02),
      [leather, leather, leather, leather, new THREE.MeshStandardMaterial({
        map: this.ledgerCover.tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: this.ledgerCover.tex, emissiveIntensity: 0.06,
      }), leather]
    );
    cover.position.z = 0.12;
    book.add(back, block, spine, cover);
    book.traverse(m => { if (m.isMesh) m.castShadow = true; });
    book.position.set(-4.1, 3.1, 0.4);
    book.rotation.y = 0.42;
    this.ledgerCover.redraw("KES 0");

    // M-Pesa agent: a floating phone whose screen shows its belief.
    const phone = new THREE.Group();
    const shell = new THREE.Mesh(
      new RoundedBoxGeometry(1.05, 2.0, 0.12, 6, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x1b1d24, metalness: 0.85, roughness: 0.25 })
    );
    this.mpesaScreen = canvasTexture(420, 820, (ctx, w, h, amount, sub) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#0e3d24");
      g.addColorStop(1, "#04170d");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2fd27a";
      ctx.fillRect(0, 0, w, 120);
      ctx.fillStyle = "#03140a";
      ctx.textAlign = "center";
      ctx.font = "700 40px Space Grotesk, system-ui, sans-serif";
      ctx.fillText("M-PESA", w / 2, 78);
      ctx.fillStyle = "rgba(200,255,220,.75)";
      ctx.font = "500 26px Space Grotesk, system-ui, sans-serif";
      ctx.fillText(sub || "STATEMENT", w / 2, 300);
      ctx.fillStyle = "#e9fff1";
      fitText(ctx, amount, w - 60, 92);
      ctx.fillText(amount, w / 2, 410);
      ctx.strokeStyle = "rgba(47,210,122,.35)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(48, 520 + i * 58);
        ctx.lineTo(w - 48, 520 + i * 58);
        ctx.stroke();
      }
    });
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 1.8),
      new THREE.MeshBasicMaterial({ map: this.mpesaScreen.tex, color: 0xc8c8c8 })
    );
    screen.position.z = 0.062;
    phone.add(shell, screen);
    shell.castShadow = true;
    phone.position.set(4.1, 3.1, 0.4);
    phone.rotation.y = -0.42;
    this.mpesaScreen.redraw("KES 0");
    this.screenMat = screen.material;

    // A glowing halo under each agent.
    const halo = color => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.025, 8, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
      m.rotation.x = Math.PI / 2;
      return m;
    };
    this.halos = { ledger: halo(COLORS.ledger), mpesa: halo(COLORS.mpesa) };
    this.halos.ledger.position.set(-4.1, 1.75, 0.4);
    this.halos.mpesa.position.set(4.1, 1.75, 0.4);

    this.avatars = { ledger: book, mpesa: phone };
    this.avatarBase = { ledger: book.position.clone(), mpesa: phone.position.clone() };
    this.avatarYaw = { ledger: 0.42, mpesa: -0.42 };
    this.scene.add(book, phone, this.halos.ledger, this.halos.mpesa);
  }

  _effects() {
    // A pool of shards for shattering tablets.
    this.shardCount = 90;
    this.shards = new THREE.InstancedMesh(
      new THREE.TetrahedronGeometry(0.07),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6, metalness: 0.2, roughness: 0.4 }),
      this.shardCount
    );
    this.shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shards.frustumCulled = false;
    this.shardState = Array.from({ length: this.shardCount }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler() }));
    this.scene.add(this.shards);
    this._hideShards();

    // Shockwave ring for the moment the agents agree.
    this.shock = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1, 128),
      new THREE.MeshBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    this.shock.rotation.x = -Math.PI / 2;
    this.shock.position.y = 0.02;
    this.scene.add(this.shock);

    // Rising sparks.
    const n = 160;
    this.sparkPos = new Float32Array(n * 3);
    this.sparkVel = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparks = new THREE.Points(geo, new THREE.PointsMaterial({
      color: COLORS.gold, size: 0.08, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.sparks.frustumCulled = false;
    this.scene.add(this.sparks);

    // The owner's lantern, for questions only the owner can answer.
    this.lantern = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 3), new THREE.MeshStandardMaterial({
      color: 0xdfe5ff, emissive: COLORS.owner, emissiveIntensity: 2.2, roughness: 0.2,
    }));
    const orbRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: COLORS.owner }));
    this.lanternRing = orbRing;
    const light = new THREE.PointLight(COLORS.owner, 10, 8, 1.5);
    this.lantern.add(orb, orbRing, light);
    this.lantern.position.set(0, 9, 1);
    this.lantern.visible = false;
    this.scene.add(this.lantern);
  }

  _hideShards() {
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.shardCount; i++) this.shards.setMatrixAt(i, m);
    this.shards.instanceMatrix.needsUpdate = true;
  }

  // ----- Every frame -----

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    // Scale: tilt toward the heavier side, plus an unresolved wobble.
    const wob = this.tilt.wobble * Math.sin(t * 2.4) * 0.16;
    this.beam.rotation.z = this.tilt.value + wob;
    for (const [side, x] of [["ledger", -BEAM_HALF], ["mpesa", BEAM_HALF]]) {
      const end = this.beam.localToWorld(new THREE.Vector3(x, 0, 0));
      this.pans[side].position.set(end.x, end.y - HANG, end.z);
    }

    // Agents float.
    for (const side of ["ledger", "mpesa"]) {
      const a = this.avatars[side];
      const base = this.avatarBase[side];
      const phase = side === "ledger" ? 0 : 1.7;
      a.position.y = base.y + (reduceMotion ? 0 : Math.sin(t * 1.1 + phase) * 0.12);
      a.rotation.y = this.avatarYaw[side] + (reduceMotion ? 0 : Math.sin(t * 0.6 + phase) * 0.05);
      this.halos[side].position.y = 1.62 + (a.position.y - base.y) * 0.4;
      this.halos[side].rotation.z += dt * 0.4;
    }

    // Shards fall and fade.
    let shardsAlive = false;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < this.shardCount; i++) {
      const s = this.shardState[i];
      if (s.life <= 0) continue;
      shardsAlive = true;
      s.life -= dt;
      s.v.y -= 6 * dt;
      s.p.addScaledVector(s.v, dt);
      s.r.x += dt * 6; s.r.y += dt * 4;
      const k = Math.max(s.life, 0) / 1.1;
      q.setFromEuler(s.r);
      m.compose(s.p, q, new THREE.Vector3(k, k, k));
      this.shards.setMatrixAt(i, m);
    }
    if (shardsAlive || this._shardsWereAlive) this.shards.instanceMatrix.needsUpdate = true;
    this._shardsWereAlive = shardsAlive;

    // Sparks rise.
    if (this.sparks.material.opacity > 0) {
      for (let i = 0; i < this.sparkPos.length; i += 3) {
        this.sparkPos[i] += this.sparkVel[i] * dt;
        this.sparkPos[i + 1] += this.sparkVel[i + 1] * dt;
        this.sparkPos[i + 2] += this.sparkVel[i + 2] * dt;
      }
      this.sparks.geometry.attributes.position.needsUpdate = true;
    }

    // Lantern spin.
    if (this.lantern.visible) {
      this.lanternRing.rotation.x = t * 1.3;
      this.lanternRing.rotation.y = t * 0.9;
    }

    this.dust.rotation.y = t * 0.012;

    // Camera: slow drift, plus push-ins and shake.
    const sway = reduceMotion ? 0 : Math.sin(t * 0.18) * 0.9;
    const cam = this.camBase.clone().add(new THREE.Vector3(sway, Math.sin(t * 0.23) * 0.15, 0)).add(this.camOffset);
    if (this.shake > 0) {
      cam.x += (Math.random() - 0.5) * this.shake;
      cam.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 0.9);
    }
    this.camera.position.copy(cam);
    this.camera.lookAt(this.lookAt);

    this.composer.render();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.camera.aspect = w / h;
    // Narrow screens: step back so both agents stay in view.
    const narrow = Math.max(0, 1.6 - this.camera.aspect);
    this.camBase.set(0, 3.6 + narrow * 1.8, 12 + narrow * 14);
    this.lookAt.set(0, 2.75 - narrow * 0.4, 0);
    this.camera.updateProjectionMatrix();
  }

  // ----- Things the debate can do -----

  reset(beliefs) {
    for (const tab of this.tablets.values()) {
      tab.parent?.remove(tab);
      tab.geometry.dispose();
    }
    this.tablets.clear();
    this.counts = { ledger: 0, mpesa: 0 };
    gsap.killTweensOf(this.tilt);
    gsap.to(this.tilt, { value: 0, wobble: 0, duration: 0.8, ease: "power2.out" });
    gsap.to(this.truthLight, { intensity: 0, duration: 0.6 });
    gsap.to(this.camOffset, { x: 0, y: 0, z: 0, duration: 1.2, ease: "power2.inOut" });
    this.hideLantern();
    for (const side of ["ledger", "mpesa"]) {
      gsap.to(this.avatarBase[side], { y: 3.1, duration: 0.6 });
      this.avatarYaw[side] = side === "ledger" ? 0.42 : -0.42;
      this.avatars[side].rotation.x = 0;
    }
    this.setBelief("ledger", beliefs.ledger, false);
    this.setBelief("mpesa", beliefs.mpesa, false);
  }

  setBelief(side, amount, animate = true, from = null) {
    const draw = v => {
      const text = "KES " + Math.round(v).toLocaleString("en-US");
      if (side === "ledger") this.ledgerCover.redraw(text);
      else this.mpesaScreen.redraw(text);
    };
    if (!animate) return draw(amount);
    const counter = { v: from ?? 0 };
    return tween(counter, { v: amount, duration: 1.4, ease: "power3.out", onUpdate: () => draw(counter.v) });
  }

  async speak(side) {
    const a = this.avatars[side];
    const halo = this.halos[side];
    gsap.fromTo(halo.scale, { x: 1, y: 1, z: 1 }, { x: 1.35, y: 1.35, z: 1.35, duration: 0.25, yoyo: true, repeat: 1, ease: "power2.out" });
    const light = side === "ledger" ? this.rimLedger : this.rimMpesa;
    gsap.fromTo(light, { intensity: 30 }, { intensity: 14, duration: 1.2, ease: "power2.out" });
    await tween(a.rotation, { z: side === "ledger" ? -0.08 : 0.08, duration: 0.18, yoyo: true, repeat: 1, ease: "power1.inOut" });
  }

  _tablet(side, label, color) {
    const { tex, redraw } = canvasTexture(512, 320, (ctx, w, h) => {
      ctx.fillStyle = "rgba(10,10,16,.92)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = hex(color);
      ctx.fillRect(0, 0, 18, h);
      ctx.strokeStyle = hex(color);
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.font = "600 30px Space Grotesk, system-ui, sans-serif";
      ctx.textAlign = "center";
      const header = color === COLORS.owner ? "FROM THE OWNER" : side === "ledger" ? "LEDGER EVIDENCE" : "M-PESA EVIDENCE";
      ctx.fillText(header, w / 2 + 8, 84);
      ctx.fillStyle = "#fff";
      fitText(ctx, label.toUpperCase(), w - 70, 64);
      ctx.fillText(label.toUpperCase(), w / 2 + 8, 200);
    });
    redraw();
    const edge = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, metalness: 0.4, roughness: 0.3 });
    const face = new THREE.MeshBasicMaterial({ map: tex, color: 0xdddddd });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.06), [edge, edge, edge, edge, face, edge]);
    mesh.castShadow = true;
    mesh.userData.color = color;
    return mesh;
  }

  // A piece of evidence flies from the agent onto its pan.
  async addEvidence(side, key, label, color = COLORS[side]) {
    if (this.tablets.has(key)) return;
    const tab = this._tablet(side, label, color);
    const slot = SLOTS[Math.min(this.counts[side], SLOTS.length - 1)].clone();
    slot.x += side === "ledger" ? 0.02 : -0.02;
    this.counts[side]++;
    this.tablets.set(key, tab);
    tab.userData.side = side;
    tab.userData.standing = true;

    const start = this.avatars[side].position.clone();
    tab.position.copy(start);
    tab.scale.setScalar(0.2);
    this.scene.add(tab);
    const pan = this.pans[side];
    const p = { t: 0 };
    const startQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side === "ledger" ? 0.5 : -0.5, 0));
    await tween(p, {
      t: 1, duration: 1.0, ease: "power2.inOut",
      onUpdate: () => {
        const end = pan.localToWorld(slot.clone());
        const mid = start.clone().lerp(end, 0.5);
        mid.y += 1.6;
        const u = p.t;
        tab.position.set(0, 0, 0)
          .addScaledVector(start, (1 - u) * (1 - u))
          .addScaledVector(mid, 2 * (1 - u) * u)
          .addScaledVector(end, u * u);
        tab.scale.setScalar(0.2 + 0.8 * Math.min(1, u * 1.4));
        tab.quaternion.copy(startQ).slerp(new THREE.Quaternion(), u);
        tab.rotation.y += (1 - u) * Math.PI * 2;
      },
    });
    pan.attach(tab);
    tab.position.copy(slot);
    tab.rotation.set(0, 0, 0);
    gsap.fromTo(tab.position, { y: slot.y + 0.25 }, { y: slot.y, duration: 0.5, ease: "bounce.out" });
    this._pulseRings(color);
    gsap.fromTo(pan.userData.glow.material, { opacity: 1 }, { opacity: 0.85, duration: 0.8 });
  }

  // Put evidence straight on its pan, for skipping to the verdict.
  addEvidenceInstant(side, key, label, color = COLORS[side]) {
    if (this.tablets.has(key)) return;
    const tab = this._tablet(side, label, color);
    const slot = SLOTS[Math.min(this.counts[side], SLOTS.length - 1)].clone();
    this.counts[side]++;
    this.tablets.set(key, tab);
    tab.userData.side = side;
    tab.userData.standing = true;
    this.pans[side].add(tab);
    tab.position.copy(slot);
  }

  // Knock evidence out without the beam, for skipping to the verdict.
  knock(key) {
    const tab = this.tablets.get(key);
    if (!tab) return;
    tab.userData.standing = false;
    tab.scale.setScalar(0.001);
  }

  // A beam from the attacking evidence shatters the target evidence.
  async rebut(attackerKey, targetKey) {
    const a = this.tablets.get(attackerKey);
    const b = this.tablets.get(targetKey);
    if (!a || !b) return;
    const from = a.getWorldPosition(new THREE.Vector3());
    const to = b.getWorldPosition(new THREE.Vector3());
    const color = a.userData.color;

    gsap.to(this.camOffset, { z: -1.6, y: -0.2, duration: 0.5, ease: "power2.out" });

    const dir = to.clone().sub(from);
    const len = dir.length();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, toneMapped: false })
    );
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 1, 16, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const group = new THREE.Group();
    group.add(beam, glow);
    group.position.copy(from);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    group.scale.set(1, 0.001, 1);
    this.scene.add(group);

    const grow = { k: 0 };
    await tween(grow, {
      k: 1, duration: 0.35, ease: "power3.in",
      onUpdate: () => {
        group.scale.y = len * grow.k;
        group.position.copy(from).addScaledVector(dir, grow.k / 2);
      },
    });
    this.shake = 0.18;
    this._shatter(to, b.userData.color);
    b.userData.standing = false;
    gsap.to(b.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.12, ease: "power2.in" });
    await tween([beam.material, glow.material], { opacity: 0, duration: 0.45, ease: "power2.out" });
    this.scene.remove(group);
    gsap.to(this.camOffset, { z: 0, y: 0, duration: 1.0, ease: "power2.inOut" });
  }

  // Evidence comes back when whatever beat it is beaten in turn.
  restore(key) {
    const tab = this.tablets.get(key);
    if (!tab || tab.userData.standing) return;
    tab.userData.standing = true;
    gsap.to(tab.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: "elastic.out(1, 0.5)" });
  }

  _shatter(at, color) {
    let made = 0;
    for (const s of this.shardState) {
      if (made >= 36) break;
      if (s.life > 0) continue;
      s.life = 0.8 + Math.random() * 0.4;
      s.p.copy(at);
      s.v.set((Math.random() - 0.5) * 5, Math.random() * 4 + 1, (Math.random() - 0.5) * 4);
      s.r.set(Math.random() * 6, Math.random() * 6, 0);
      made++;
    }
    this.shards.material.emissive.setHex(color);
  }

  _pulseRings(color) {
    this.rings.forEach((ring, i) => {
      ring.material.color.setHex(color);
      gsap.fromTo(ring.material, { opacity: 0.55 }, { opacity: ring.userData.base, duration: 1.2, delay: i * 0.08, ease: "power2.out" });
    });
  }

  // Tilt toward the side with more standing evidence.
  weigh() {
    let l = 0, r = 0;
    for (const tab of this.tablets.values()) {
      if (!tab.userData.standing) continue;
      if (tab.userData.side === "ledger") l++;
      else if (tab.userData.side === "mpesa") r++;
    }
    const target = Math.max(-MAX_TILT, Math.min(MAX_TILT, (l - r) * 0.13));
    gsap.to(this.tilt, { value: target, duration: 1.4, ease: "elastic.out(1, 0.45)" });
  }

  // One agent gives up: it bows, and its belief rolls over to the agreed value.
  async concede(loser, from, to) {
    const winner = loser === "ledger" ? "mpesa" : "ledger";
    gsap.to(this.tilt, { value: winner === "ledger" ? MAX_TILT : -MAX_TILT, duration: 0.9, ease: "power3.out" });
    gsap.to(this.avatars[loser].rotation, { x: 0.35, duration: 0.8, ease: "power2.out" });
    gsap.to(this.avatarBase[loser], { y: 2.7, duration: 0.8, ease: "power2.out" });
    gsap.to(this.avatarYaw, { [loser]: loser === "ledger" ? 0.15 : -0.15, duration: 0.8 });
    await this.setBelief(loser, to, true, from);
  }

  // The agents agree: the scale comes level and a gold wave goes out.
  async agree() {
    gsap.to(this.tilt, { value: 0, wobble: 0, duration: 1.6, ease: "elastic.out(1, 0.35)" });
    for (const side of ["ledger", "mpesa"]) {
      gsap.to(this.avatars[side].rotation, { x: 0, duration: 1 });
      gsap.to(this.avatarBase[side], { y: 3.1, duration: 1 });
    }
    gsap.fromTo(this.truthLight, { intensity: 60 }, { intensity: 10, duration: 2.4, ease: "power2.out" });
    gsap.fromTo(this.needle.material, { emissiveIntensity: 6 }, { emissiveIntensity: 0.6, duration: 2, ease: "power2.out" });
    this.shock.material.opacity = 0.9;
    this.shock.scale.setScalar(0.5);
    gsap.to(this.shock.scale, { x: 14, y: 14, z: 14, duration: 2.2, ease: "power2.out" });
    gsap.to(this.shock.material, { opacity: 0, duration: 2.2, ease: "power2.in" });
    this._pulseRings(COLORS.gold);
    for (let i = 0; i < this.sparkPos.length; i += 3) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.6;
      this.sparkPos[i] = Math.cos(a) * r;
      this.sparkPos[i + 1] = 0.6 + Math.random() * 2.6;
      this.sparkPos[i + 2] = Math.sin(a) * r;
      this.sparkVel[i] = Math.cos(a) * 0.6;
      this.sparkVel[i + 1] = 1 + Math.random() * 1.8;
      this.sparkVel[i + 2] = Math.sin(a) * 0.6;
    }
    gsap.fromTo(this.sparks.material, { opacity: 1 }, { opacity: 0, duration: 2.6, ease: "power2.in" });
    gsap.to(this.camOffset, { z: -0.5, y: 0, duration: 2.4, ease: "power2.inOut" });
  }

  // The agents can't agree: the scale won't settle, and the owner's lantern comes down.
  async escalate() {
    gsap.to(this.tilt, { value: 0, wobble: 1, duration: 1.2, ease: "power2.out" });
    this.lantern.visible = true;
    this.lantern.position.set(0, 9, 1);
    gsap.to(this.camOffset, { y: 0.6, z: -0.8, duration: 1.6, ease: "power2.inOut" });
    await tween(this.lantern.position, { y: 4.7, duration: 1.8, ease: "power3.out" });
  }

  hideLantern() {
    if (!this.lantern.visible) return;
    gsap.to(this.lantern.position, { y: 9, duration: 0.8, ease: "power2.in", onComplete: () => { this.lantern.visible = false; } });
  }

  // A small shrug for "nothing to add".
  pass(side) {
    gsap.fromTo(this.avatars[side].rotation, { z: 0 }, { z: side === "ledger" ? 0.06 : -0.06, duration: 0.15, yoyo: true, repeat: 3 });
  }
}
