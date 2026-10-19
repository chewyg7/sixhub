import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * A muscle coupe built from code (no third-party model): an extruded side
 * profile with wheel arches, a narrower glass cabin, and the rear end detailed
 * for the plate: taillight bar, plate recess and lamp, diffuser and exhausts.
 * Metres; the rear faces +z. `mount` is where the plate's centre goes.
 */

export interface Car {
  group: THREE.Group;
  paint: THREE.MeshPhysicalMaterial;
  mount: THREE.Object3D;
  /** Lights that belong to the car (taillight glow, plate lamp), faded in with the scene. */
  lights: THREE.Light[];
  dispose: () => void;
}

const WIDTH = 1.88;
const REAR_Z = 2.32;
const WHEEL_R = 0.355;
const WHEELS: [number, number][] = [
  [-1.38, -1],
  [-1.38, 1],
  [1.42, -1],
  [1.42, 1],
];

/** Side profile (z along the car, y up), with arches cut for the wheels. */
function bodyProfile(): THREE.Shape {
  const s = new THREE.Shape();
  const arch = (cz: number, fromFront: boolean) => {
    const r = WHEEL_R + 0.07;
    // Arch: semicircle around the wheel centre, opening downwards.
    if (fromFront) s.absarc(cz, 0.36, r, Math.PI, 0, true);
  };
  s.moveTo(-2.3, 0.3);
  s.lineTo(-1.38 - (WHEEL_R + 0.07), 0.3);
  arch(-1.38, true);
  s.lineTo(1.42 - (WHEEL_R + 0.07), 0.3);
  arch(1.42, true);
  s.lineTo(2.22, 0.3);
  s.quadraticCurveTo(2.33, 0.31, 2.34, 0.42); // bumper corner
  s.lineTo(2.35, 0.78);
  s.quadraticCurveTo(2.35, 0.87, 2.24, 0.885); // lip of the deck
  s.lineTo(1.5, 0.9); // trunk deck
  s.lineTo(-0.6, 0.88); // beltline
  s.lineTo(-1.95, 0.8); // hood
  s.quadraticCurveTo(-2.32, 0.78, -2.33, 0.62); // nose
  s.quadraticCurveTo(-2.34, 0.32, -2.3, 0.3);
  return s;
}

/** Cabin profile: windshield, roof, fastback rear window. */
function cabinProfile(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.62, 0.86);
  s.quadraticCurveTo(-0.3, 1.08, -0.05, 1.2);
  s.quadraticCurveTo(0.35, 1.27, 0.85, 1.24);
  s.quadraticCurveTo(1.25, 1.18, 1.62, 0.92);
  s.lineTo(1.62, 0.86);
  s.closePath();
  return s;
}

/** Extrudes a side profile across the car's width, centred, rear towards +z. */
function extrudeAcross(shape: THREE.Shape, width: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 6, curveSegments: 28 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2); // profile x → world z, extrusion → world x
  g.computeVertexNormals();
  return g;
}

function wheel(mats: { tire: THREE.Material; rim: THREE.Material; disc: THREE.Material }) {
  const w = new THREE.Group();
  // Tyre: a lathed rounded profile.
  const pts: THREE.Vector2[] = [];
  const tw = 0.27;
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    pts.push(new THREE.Vector2(WHEEL_R - 0.045 + Math.sin(a) * 0.045, -tw / 2 + (i / 16) * tw));
  }
  pts.unshift(new THREE.Vector2(0.24, -tw / 2));
  pts.push(new THREE.Vector2(0.24, tw / 2));
  const tire = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), mats.tire);
  tire.rotation.z = Math.PI / 2;
  w.add(tire);
  // Rim: dished face with five spokes.
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.02, 40), mats.disc);
  face.rotation.z = Math.PI / 2;
  face.position.x = tw / 2 - 0.035;
  w.add(face);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.2, 0.05, 2, 0.01), mats.rim);
    spoke.position.set(tw / 2 - 0.02, 0, 0);
    spoke.rotation.x = (i / 5) * Math.PI * 2;
    spoke.geometry.translate(0, 0.11, 0);
    w.add(spoke);
  }
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.012, 10, 48), mats.rim);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = tw / 2 - 0.012;
  w.add(lip);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.03, 24), mats.rim);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = tw / 2 - 0.005;
  w.add(cap);
  return w;
}

export function buildCar(color: string): Car {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.45, metalness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x07090c, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.88, metalness: 0 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xc4c9ce, metalness: 1, roughness: 0.3, envMapIntensity: 0.7 });
  const disc = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, metalness: 0.8, roughness: 0.35 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0x2a0000, emissive: 0xff1e1e, emissiveIntensity: 3.2, roughness: 0.3 });
  const lampCore = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff5a4a, emissiveIntensity: 9, roughness: 0.2 });
  const lens = new THREE.MeshPhysicalMaterial({ color: 0x140203, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.72, clearcoat: 1 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 1.2 });
  const owned: { dispose(): void }[] = [paint, trim, glass, chrome, tire, rim, disc, lamp, lampCore, lens, white];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, pos?: [number, number, number]) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    group.add(m);
    owned.push(geo);
    return m;
  };

  add(extrudeAcross(bodyProfile(), WIDTH, 0.07), paint);
  add(extrudeAcross(cabinProfile(), WIDTH - 0.34, 0.09), glass);
  // Roof skin over the glass, so only the windows read as glass.
  const roof = new THREE.Shape();
  roof.moveTo(-0.08, 1.2);
  roof.quadraticCurveTo(0.35, 1.275, 0.85, 1.245);
  roof.quadraticCurveTo(1.05, 1.22, 1.12, 1.19);
  roof.lineTo(-0.08, 1.19);
  add(extrudeAcross(roof, WIDTH - 0.3, 0.05), paint, [0, 0.012, 0]);

  // Rear end. The body's rounded edges add ~0.065 m to the profile, so the
  // real rear surface sits at REAR_Z + 0.03 + 0.065.
  const rz = REAR_Z + 0.1;
  // Taillight bar: two lamps with bright cores behind a smoked lens, black panel between.
  for (const side of [-1, 1]) {
    add(new RoundedBoxGeometry(0.62, 0.11, 0.04, 3, 0.012), lamp, [side * 0.5, 0.72, rz - 0.005]);
    add(new RoundedBoxGeometry(0.5, 0.022, 0.03, 2, 0.008), lampCore, [side * 0.5, 0.735, rz + 0.012]);
    add(new RoundedBoxGeometry(0.64, 0.125, 0.02, 3, 0.012), lens, [side * 0.5, 0.72, rz + 0.02]);
  }
  add(new RoundedBoxGeometry(0.36, 0.11, 0.03, 3, 0.01), trim, [0, 0.72, rz]);
  // Plate recess, with the lamp above it.
  add(new RoundedBoxGeometry(0.4, 0.22, 0.03, 3, 0.02), trim, [0, 0.515, rz - 0.012]);
  add(new RoundedBoxGeometry(0.12, 0.008, 0.01, 2, 0.003), white, [0, 0.628, rz + 0.004]);
  // Diffuser and exhausts.
  add(new RoundedBoxGeometry(WIDTH - 0.1, 0.12, 0.12, 3, 0.03), trim, [0, 0.31, REAR_Z + 0.01]);
  for (const side of [-1, 1]) {
    const tip = add(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 28, 1, true), chrome, [side * 0.58, 0.3, REAR_Z + 0.08]);
    tip.rotation.x = Math.PI / 2;
    (tip.material as THREE.Material).side = THREE.DoubleSide;
    const inner = add(new THREE.CircleGeometry(0.04, 24), trim, [side * 0.58, 0.3, REAR_Z + 0.12]);
    inner.lookAt(side * 0.58, 0.3, 10);
  }
  // Wheels, with dark liners in the arches.
  for (const [z, side] of WHEELS) {
    const w = wheel({ tire, rim, disc });
    if (side < 0) w.rotation.y = Math.PI;
    w.position.set(side * (WIDTH / 2 - 0.13), WHEEL_R, z);
    group.add(w);
    w.traverse((o) => o instanceof THREE.Mesh && owned.push(o.geometry));
    const liner = add(new THREE.CylinderGeometry(WHEEL_R + 0.06, WHEEL_R + 0.06, WIDTH - 0.3, 32, 1, true, Math.PI * 1.5, Math.PI), trim, [0, WHEEL_R + 0.01, z]);
    liner.rotation.z = Math.PI / 2;
    (liner.material as THREE.Material).side = THREE.DoubleSide;
  }

  const mount = new THREE.Object3D();
  mount.position.set(0, 0.515, rz + 0.012);
  group.add(mount);

  // Red glow on the ground behind the lamps, and a white lamp on the plate.
  const glow = new THREE.PointLight(0xff2020, 0, 2.2, 2);
  glow.position.set(0, 0.72, rz + 0.35);
  const plateLamp = new THREE.SpotLight(0xfff1dc, 0, 1.2, 0.9, 0.6, 1.5);
  plateLamp.position.set(0, 0.64, rz + 0.08);
  plateLamp.target.position.set(0, 0.45, rz);
  group.add(glow, plateLamp, plateLamp.target);

  return {
    group,
    paint,
    mount,
    lights: [glow, plateLamp],
    dispose: () => owned.forEach((o) => o.dispose()),
  };
}
