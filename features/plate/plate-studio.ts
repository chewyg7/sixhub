import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CORNER, HOLES, drawPlateMask, drawPlateNormals, type FrameKind } from "./plate-art";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/**
 * The 3D side of the plate creator: a stamped aluminium plate you can turn in
 * your hands, and 6 Hub Customs, where it's bolted to the back of a Banshee
 * (public/tools/plate/customs.glb, loaded the first time Car view opens). Renders
 * only when something changes, and pauses entirely while hidden.
 */

export type StudioView = "plate" | "car";

// A real plate: 12" × 6".
const PW = 0.305;
const PH = 0.1525;
const THICK = 0.0012;
const BEVEL = 0.0006;

const CAR_URL = "/tools/plate/customs.glb";
/** Where the plate's centre sits on the Banshee's rear (found by ray-casting the model). */
// Between the tail lights, like the GTA Online creator. The bodywork behind the plate's
// footprint peaks at z 2.124, so the plate's back (1.8 mm behind its centre) clears it.
const MOUNT = new THREE.Vector3(0, 0.72, 2.1265);
/** How far the stamped characters and rim stand out of the plate (metres). */
const EMBOSS = 0.0012;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Pose {
  cam: THREE.Vector3;
  target: THREE.Vector3;
}

/** A dark studio with soft light strips, used as the reflection map: what makes paint and chrome look expensive. */
function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene();
  // A dim grey base, so polished metal reflects soft grey rather than black.
  env.background = new THREE.Color(0x26262c);
  const strip = (w: number, h: number, color: number, intensity: number, pos: [number, number, number], look: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    env.add(m);
  };
  // Overhead softboxes, long side strips, and Leonida-coloured accents low down.
  strip(6, 1.2, 0xffffff, 3.2, [0, 6, 0], [0, 0, 0]);
  strip(5, 0.5, 0xffffff, 2.2, [0, 5, 3.5], [0, 0, 0]);
  strip(0.5, 5, 0xffffff, 1.8, [-6, 2.5, 1], [0, 1, 0]);
  strip(0.5, 5, 0xffffff, 1.8, [6, 2.5, 1], [0, 1, 0]);
  strip(8, 3, 0x8d8d96, 1, [0, 1.5, 7], [0, 1, 0]);
  strip(4, 0.6, 0x2fd6c9, 1.6, [-5, 0.6, -3], [0, 0.6, 0]);
  strip(4, 0.6, 0xff5fa2, 1.6, [5, 0.6, -3], [0, 0.6, 0]);
  strip(6, 2, 0x1a1a1f, 1, [0, 1, 6], [0, 1, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  env.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return tex;
}

function roundedRectPath(path: THREE.Path, x: number, y: number, w: number, h: number, r: number) {
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
}

/** Plate units (0..1 from the top-left) → metres from the centre. */
const px = (u: number) => (u - 0.5) * PW;
const py = (v: number) => (0.5 - v) * PH;

function plateGeometry() {
  const s = new THREE.Shape();
  const inset = BEVEL;
  roundedRectPath(s, -PW / 2 + inset, -PH / 2 + inset, PW - inset * 2, PH - inset * 2, CORNER * PH);
  for (const h of HOLES.round) {
    const p = new THREE.Path();
    p.absarc(px(h.x), py(h.y), h.r * PH, 0, Math.PI * 2, true);
    s.holes.push(p);
  }
  for (const sl of HOLES.slots) {
    const p = new THREE.Path();
    roundedRectPath(p, px(sl.x - sl.w / 2), py(sl.y + sl.h / 2), sl.w * PW, sl.h * PH, (sl.h * PH) / 2 - 1e-5);
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: THICK, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 2, curveSegments: 24 });
  g.translate(0, 0, -THICK);
  // Front face maps the artwork edge to edge; the back gets plain sheet.
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (z > -THICK / 2) uv.setXY(i, x / PW + 0.5, y / PH + 0.5);
    else uv.setXY(i, 0.01, 0.5);
  }
  uv.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

const FRAME_MATS: Record<Exclude<FrameKind, "none">, { color: number; metalness: number; roughness: number }> = {
  chrome: { color: 0xffffff, metalness: 1, roughness: 0.16 },
  black: { color: 0x0e0f10, metalness: 0.6, roughness: 0.3 },
  gold: { color: 0xe8be62, metalness: 1, roughness: 0.16 },
};

export class PlateStudio {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.01, 60);
  private controls: OrbitControls;
  private composer: EffectComposer | null = null;
  private plate = new THREE.Group();
  private frame = new THREE.Group();
  private faceTex: THREE.CanvasTexture;
  private bumpTex: THREE.CanvasTexture;
  private faceMat: THREE.MeshPhysicalMaterial;
  private bumpCanvas: HTMLCanvasElement;
  private normalCanvas = Object.assign(document.createElement("canvas"), { width: 1024, height: 512 });
  private normalTex: THREE.CanvasTexture;
  private garage = new THREE.Group();
  private mount = new THREE.Object3D();
  private paintMats: THREE.MeshStandardMaterial[] = [];
  private paint: string;
  private carLoad: Promise<void> | null = null;
  /** Told when the car starts and finishes loading (for a loading message). */
  onCarLoading?: (loading: boolean) => void;
  /** 0 = plate on its own, 1 = garage fully lit. */
  private carMix = 0;
  private plateLights: THREE.Light[] = [];
  private garageLights: { light: THREE.Light; full: number }[] = [];
  private view: StudioView = "plate";
  private anim: { from: number; to: number; start: number; dur: number; poseFrom: Pose; poseTo: Pose; plateFrom: THREE.Matrix4; plateTo: THREE.Matrix4 } | null = null;
  private dirty = true;
  private active = true;
  private raf = 0;
  private ro: ResizeObserver;
  private disposed = false;
  private idleSpin = 0;
  private lastInteract = 0;

  constructor(
    private container: HTMLElement,
    face: HTMLCanvasElement,
    bump: HTMLCanvasElement,
    opts: { bloom: boolean; paint: string },
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x020203);
    // Car view: black fog closes in behind the car so the garage dissolves into darkness.
    this.scene.fog = new THREE.Fog(0x020203, 1000, 1001);
    this.scene.environment = studioEnvironment(this.renderer);
    this.scene.environmentIntensity = 0.9;

    // The plate.
    this.faceTex = new THREE.CanvasTexture(face);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.faceTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.bumpCanvas = bump;
    this.bumpTex = new THREE.CanvasTexture(bump);
    this.bumpTex.anisotropy = this.faceTex.anisotropy;
    drawPlateNormals(this.normalCanvas, bump);
    this.normalTex = new THREE.CanvasTexture(this.normalCanvas);
    this.normalTex.anisotropy = this.faceTex.anisotropy;
    const mask = Object.assign(document.createElement("canvas"), { width: 2048, height: 1024 });
    drawPlateMask(mask.getContext("2d")!, mask.width, mask.height);
    const maskTex = new THREE.CanvasTexture(mask);
    // Painted sheeting: bright, satin, with just a hint of clear-coat gloss.
// The face is real relief: a finely divided surface pushed out by the height map (so letters
    // stand up and show their edges at an angle), shaded by the matching normal map, and cut to
    // the plate's outline and bolt holes by the mask.
    this.faceMat = new THREE.MeshPhysicalMaterial({
      map: this.faceTex,
      displacementMap: this.bumpTex,
      displacementScale: EMBOSS,
      normalMap: this.normalTex,
      alphaMap: maskTex,
      alphaTest: 0.5,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.2,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.6,
    });
    const edge = new THREE.MeshStandardMaterial({ color: 0xd7dbde, metalness: 1, roughness: 0.32 });
    const sheet = new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.6 });
    const plateMesh = new THREE.Mesh(plateGeometry(), [sheet, edge]);
    const fine = window.matchMedia("(pointer: coarse)").matches ? 1 : 2;
    const relief = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH, 320 * fine, 160 * fine), this.faceMat);
    relief.position.z = BEVEL + 0.00005;
    this.plate.add(plateMesh, relief, this.frame);
    this.addBolts();
    this.scene.add(this.plate);

    // Lights for the plate on its own: a key from above-left and a cool rim.
    // Raking light from the upper left makes the stamping read.
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(-1.1, 1.0, 0.8);
    const rim = new THREE.DirectionalLight(0xbfe9ff, 0.9);
    rim.position.set(0.8, -0.3, 0.6);
    this.plateLights = [key, rim];
    this.scene.add(key, rim);

    // 6 Hub Customs: the scene file brings the car, floor and walls; these lights shape the paint.
    this.paint = opts.paint;
    this.mount.position.copy(MOUNT);
    this.garage.add(this.mount);
    const top = new THREE.SpotLight(0xffffff, 0, 14, 0.75, 0.85, 2);
    top.position.set(0, 5.5, 2.6);
    top.target.position.set(0, 0.4, 1.4);
    const rearKey = new THREE.SpotLight(0xfff6ea, 0, 12, 0.42, 0.75, 2);
    rearKey.position.set(-1.6, 2.8, 6.4);
    rearKey.target.position.set(0, 0.55, 2.35);
    const fill = new THREE.SpotLight(0xa7c8ff, 0, 12, 0.6, 0.9, 2);
    fill.position.set(-3.4, 1.8, 5.2);
    fill.target.position.set(0, 0.6, 2);
    const pink = new THREE.PointLight(0xff4f9a, 0, 9, 2);
    pink.position.set(3.2, 0.6, 3.2);
    const teal = new THREE.PointLight(0x2fd6c9, 0, 9, 2);
    teal.position.set(-3.2, 0.6, 3.2);
    this.garage.add(top, top.target, rearKey, rearKey.target, fill, fill.target, pink, teal);
    this.garageLights = [
      { light: top, full: 50 },
      { light: rearKey, full: 26 },
      { light: fill, full: 12 },
      { light: pink, full: 3 },
      { light: teal, full: 3 },
    ];
    this.garage.visible = false;
    this.scene.add(this.garage);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.addEventListener("change", () => (this.dirty = true));
    this.controls.addEventListener("start", () => (this.lastInteract = performance.now()));

    if (opts.bloom) {
      // A multisampled target: without it, post-processing drops antialiasing and fine
      // highlights shimmer ("sparkle") as the camera moves.
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, target);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      // High threshold: only the tail lights glow, never reflections.
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 4.5));
      this.composer.addPass(new OutputPass());
    }

    this.applyView("plate");
    if (process.env.NODE_ENV === "development") Object.assign(window, { __plateStudio: { camera: this.camera, controls: this.controls, studio: this, THREE } });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.loop();
  }

  /* ---------- Plate ---------- */

  private addBolts() {
    const head = new THREE.CylinderGeometry(0.0062, 0.0066, 0.0028, 6);
    head.rotateX(Math.PI / 2);
    const washer = new THREE.CylinderGeometry(0.0085, 0.0085, 0.0008, 32);
    washer.rotateX(Math.PI / 2);
    const steel = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, metalness: 0.95, roughness: 0.28, envMapIntensity: 2.6 });
    for (const h of HOLES.round) {
      const w = new THREE.Mesh(washer, steel);
      w.position.set(px(h.x), py(h.y), BEVEL + 0.0004);
      const b = new THREE.Mesh(head, steel);
      b.position.set(px(h.x), py(h.y), BEVEL + 0.0022);
      b.rotation.z = Math.PI / 6;
      this.plate.add(w, b);
    }
  }

  /** New artwork (text or style changed). */
  updatePlate() {
    drawPlateNormals(this.normalCanvas, this.bumpCanvas);
    this.normalTex.needsUpdate = true;
    this.faceTex.needsUpdate = true;
    this.bumpTex.needsUpdate = true;
    this.dirty = true;
  }

  setFrame(kind: FrameKind) {
    this.frame.children.forEach((c) => {
      if (c instanceof THREE.Mesh || c instanceof THREE.InstancedMesh) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
    });
    this.frame.clear();
    if (kind !== "none") {
      const spec = FRAME_MATS[kind];
      const mat = new THREE.MeshStandardMaterial(spec);
      const f = 0.014;
      const overlap = 0.006;
      const outer = new THREE.Shape();
      roundedRectPath(outer, -PW / 2 - f, -PH / 2 - f * 1.3, PW + f * 2, PH + f * 2.3, CORNER * PH + f);
      const hole = new THREE.Path();
      roundedRectPath(hole, -PW / 2 + overlap, -PH / 2 + overlap, PW - overlap * 2, PH - overlap * 2, CORNER * PH * 0.7);
      outer.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(outer, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0025, bevelSegments: 4, curveSegments: 20 });
      g.translate(0, 0, 0.0004);
      this.frame.add(new THREE.Mesh(g, mat));
      // Studs around the frame.
      const pts: THREE.Vector2[] = [];
      const ring = new THREE.Shape();
      const mid = (f - overlap) / 2 + overlap * 0.4;
      roundedRectPath(ring, -PW / 2 - mid, -PH / 2 - mid * 1.15, PW + mid * 2, PH + mid * 2.15, CORNER * PH + mid);
      const len = ring.getLength();
      const n = Math.floor(len / 0.0085);
      for (let i = 0; i < n; i++) pts.push(ring.getPointAt(i / n));
      const stud = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0021, 12, 8), new THREE.MeshStandardMaterial({ ...spec, roughness: Math.max(0.3, spec.roughness * 2) }), pts.length);
      const m = new THREE.Matrix4();
      pts.forEach((p, i) => stud.setMatrixAt(i, m.makeTranslation(p.x, p.y, 0.0072)));
      this.frame.add(stud);
    }
    this.dirty = true;
  }

  setPaint(color: string) {
    this.paint = color;
    for (const m of this.paintMats) m.color.set(color);
    this.dirty = true;
  }

  /** Loads 6 Hub Customs and the Banshee once; resolves when they're in the scene. */
  loadCar(): Promise<void> {
    if (this.carLoad) return this.carLoad;
    this.onCarLoading?.(true);
    // The scene file is meshopt-compressed with WebP textures (gltf-transform optimize), ~1.8 MB.
    this.carLoad = new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync(CAR_URL)
      .then((gltf) => {
        if (this.disposed) return;
        const backdrop = gltf.scene.getObjectByName("Environment_BiasedUVs_Unlit");
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          // The workshop behind the car stays clear of the fog; only the floor fades out.
          let inBackdrop = false;
          o.traverseAncestors((a) => (inBackdrop ||= a === backdrop));
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (inBackdrop) {
              m.fog = false;
              // Its baked lighting is dim; lift it so the workshop reads behind the car.
              if (m instanceof THREE.MeshBasicMaterial && m.name !== "Unlit_Black") m.color.multiplyScalar(1.45);
            }
            if (!(m instanceof THREE.MeshStandardMaterial)) continue;
            // A touch of clear-coat roughness keeps reflections smooth rather than glittery.
            if (m instanceof THREE.MeshPhysicalMaterial && m.clearcoat > 0) m.clearcoatRoughness = Math.max(m.clearcoatRoughness, 0.07);
            // Body colour: drop the flat colour texture so the paint picker drives it.
            if (m.name.startsWith("Banshee_Carpaint_1")) {
              m.map = null;
              m.color.set(this.paint);
              m.needsUpdate = true;
              this.paintMats.push(m);
            }
            // Light up the tail lights.
            if (m.name === "Banshee_Emissive") {
              m.emissiveMap = m.map;
              m.emissive.set(0xffffff);
              m.emissiveIntensity = 7;
              m.needsUpdate = true;
            }
          }
        });
        this.garage.add(gltf.scene);
        this.dirty = true;
      })
      .finally(() => this.onCarLoading?.(false));
    this.carLoad.catch(() => (this.carLoad = null));
    return this.carLoad;
  }

  /* ---------- Views ---------- */

  private platePose(): Pose {
    // Fit the plate (and frame) to ~70% of the view's width or height, whichever is tighter.
    const aspect = this.camera.aspect || 1;
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const needH = (PH * 1.25) / 0.62;
    const needW = (PW * 1.12) / 0.74 / aspect;
    const dist = Math.max(needH, needW) / 2 / Math.tan(vFov / 2);
    return { cam: new THREE.Vector3(0.12 * dist, 0.06 * dist, dist), target: new THREE.Vector3(0, 0, 0) };
  }

  private carPose(): Pose {
    // From behind and a little to the left, low, sized so the rear fills most of the frame.
    const aspect = this.camera.aspect || 1;
    const half = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const dist = Math.max(2.5 / 2 / (half * aspect), 1.6 / 2 / half) + 0.7;
    const target = new THREE.Vector3(0, 0.58, 1.7);
    const dir = new THREE.Vector3(-0.34, 0.13, 0.93).normalize();
    return { cam: target.clone().addScaledVector(dir, dist), target };
  }

  private plateMatrixFor(view: StudioView) {
    if (view === "plate") return new THREE.Matrix4();
    this.garage.updateMatrixWorld(true);
    return this.mount.matrixWorld.clone();
  }

  private applyView(view: StudioView) {
    this.view = view;
    const pose = view === "plate" ? this.platePose() : this.carPose();
    this.camera.position.copy(pose.cam);
    this.controls.target.copy(pose.target);
    this.plate.matrix.copy(this.plateMatrixFor(view));
    this.plate.matrix.decompose(this.plate.position, this.plate.quaternion, this.plate.scale);
    this.setCarMix(view === "car" ? 1 : 0);
    this.limitsFor(view);
    this.controls.update();
    this.dirty = true;
  }

  private limitsFor(view: StudioView) {
    const c = this.controls;
    if (view === "plate") {
      const d = this.platePose().cam.length();
      c.minDistance = d * 0.55;
      c.maxDistance = d * 1.6;
      c.minAzimuthAngle = -1.2;
      c.maxAzimuthAngle = 1.2;
      c.minPolarAngle = 0.5;
      c.maxPolarAngle = Math.PI - 0.5;
      c.rotateSpeed = 0.7;
    } else {
      c.minDistance = 2.2;
      c.maxDistance = 9;
      c.minAzimuthAngle = -1.9;
      c.maxAzimuthAngle = 1.9;
      c.minPolarAngle = 0.55;
      c.maxPolarAngle = 1.5;
      c.rotateSpeed = 0.55;
    }
  }

  private setCarMix(t: number) {
    this.carMix = t;
    this.garage.visible = t > 0.001;
    for (const { light, full } of this.garageLights) light.intensity = full * t;
    // The plate's own studio lights hand over to the garage's.
    this.plateLights[0].intensity = 2.6 * (1 - t) + 0.25 * t;
    this.plateLights[1].intensity = 0.9 * (1 - t);
    this.scene.environmentIntensity = 0.9 - 0.1 * t;
  }

  /** Fly between "plate in hand" and "plate on the car". */
  setView(view: StudioView) {
    if (view === this.view && !this.anim) return;
    // The car arrives with its own file; fly over once it's in.
    if (view === "car" && !this.paintMats.length) {
      void this.loadCar().then(() => this.view !== "car" && this.setView("car"));
      return;
    }
    const poseFrom = { cam: this.camera.position.clone(), target: this.controls.target.clone() };
    const poseTo = view === "plate" ? this.platePose() : this.carPose();
    this.anim = { from: this.carMix, to: view === "car" ? 1 : 0, start: performance.now(), dur: 1500, poseFrom, poseTo, plateFrom: this.plate.matrix.clone().compose(this.plate.position, this.plate.quaternion, this.plate.scale), plateTo: this.plateMatrixFor(view) };
    this.view = view;
    // Free the camera during the flight; limits return when it lands.
    Object.assign(this.controls, { minDistance: 0, maxDistance: Infinity, minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, minPolarAngle: 0, maxPolarAngle: Math.PI });
    this.controls.enabled = false;
    this.dirty = true;
  }

  /** Back to the starting angle of the current view. */
  resetView() {
    const v = this.view;
    this.view = v === "plate" ? "car" : "plate";
    this.setView(v);
  }

  /** Called when switching 2D → 3D: a short reveal from straight-on. */
  intro() {
    if (this.view !== "plate") return;
    const pose = this.platePose();
    this.camera.position.set(0, 0, pose.cam.length() * 1.15);
    this.controls.target.set(0, 0, 0);
    this.anim = { from: 0, to: 0, start: performance.now(), dur: 1100, poseFrom: { cam: this.camera.position.clone(), target: new THREE.Vector3() }, poseTo: pose, plateFrom: new THREE.Matrix4(), plateTo: new THREE.Matrix4() };
    this.controls.enabled = false;
    this.dirty = true;
  }

  private step(now: number) {
    const a = this.anim;
    if (!a) return;
    const t = Math.min(1, (now - a.start) / a.dur);
    const e = ease(t);
    this.camera.position.lerpVectors(a.poseFrom.cam, a.poseTo.cam, e);
    this.controls.target.lerpVectors(a.poseFrom.target, a.poseTo.target, e);
    // The plate travels with a slight lift and turn, then settles on its mount.
    const p0 = new THREE.Vector3(), q0 = new THREE.Quaternion(), s0 = new THREE.Vector3();
    const p1 = new THREE.Vector3(), q1 = new THREE.Quaternion(), s1 = new THREE.Vector3();
    a.plateFrom.decompose(p0, q0, s0);
    a.plateTo.decompose(p1, q1, s1);
    this.plate.position.lerpVectors(p0, p1, e);
    this.plate.position.y += Math.sin(e * Math.PI) * 0.12 * Math.abs(a.to - a.from);
    this.plate.quaternion.slerpQuaternions(q0, q1, e);
    this.setCarMix(a.from + (a.to - a.from) * Math.min(1, e * 1.2));
    this.dirty = true;
    if (t >= 1) {
      this.anim = null;
      this.limitsFor(this.view);
      this.controls.enabled = true;
    }
  }

  /* ---------- Loop ---------- */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.active || document.hidden) return;
    const now = performance.now();
    this.step(now);
    // A slow idle sway on the plate once it's been left alone.
    if (this.view === "plate" && !this.anim && now - this.lastInteract > 4000) {
      this.idleSpin += 0.006;
      this.plate.rotation.y = Math.sin(this.idleSpin) * 0.06;
      this.dirty = true;
    }
    if (this.controls.update()) this.dirty = true;
    // Fog starts just past the car and is black a few metres behind it, wherever the camera is.
    const fog = this.scene.fog as THREE.Fog;
    const reach = this.camera.position.distanceTo(this.controls.target);
    const near = this.carMix > 0.01 ? reach + 1.5 / this.carMix : 1000;
    if (Math.abs(fog.near - near) > 0.01) {
      fog.near = near;
      fog.far = near + 9;
      this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.anim) this.applyView(this.view);
    this.dirty = true;
  }

  /** Pause rendering while the 2D view is showing. */
  setActive(on: boolean) {
    this.active = on;
    this.dirty = true;
  }

  /** The current 3D view as a PNG. */
  snapshot(): Promise<Blob | null> {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL("image/png");
    return fetch(url).then((r) => r.blob());
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.setFrame("none");
    this.garage.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
      }
    });
    this.faceTex.dispose();
    this.bumpTex.dispose();
    this.scene.environment?.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
      }
    });
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
