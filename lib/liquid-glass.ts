/**
 * Liquid glass maps (after https://kube.io/blog/liquid-glass-css-svg/).
 *
 * A glass slab with a curved bezel refracts what's behind it. For each
 * pixel we find how far it sits inside a rounded rectangle; inside the
 * bezel the surface slopes (convex squircle profile), so a ray passing
 * through bends by Snell's law (n₁ sin θ₁ = n₂ sin θ₂). The resulting
 * lateral shift is stored as a displacement vector in the R/G channels
 * (128 = none) for <feDisplacementMap>. A second map is a mask for the
 * specular rim: where the surface faces the light, the component shows a
 * brightened copy of the backdrop, so highlights take on the colours
 * behind the glass instead of being painted white.
 */

export interface GlassOptions {
  width: number;
  height: number;
  radius: number;
  /** Width of the curved rim in px. */
  bezel: number;
  /** Glass thickness in px — more thickness, more refraction. */
  thickness: number;
  /** Index of refraction (glass ≈ 1.5). */
  ior?: number;
  /** Specular strength 0..1. */
  specular?: number;
}

export interface GlassMaps {
  displacement: string;
  specular: string;
  /** feDisplacementMap scale in px. */
  scale: number;
}

/** Convex squircle height profile: soft rise from the edge (t=0) to the flat top (t=1). */
const squircle = (t: number) => Math.pow(1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 4), 0.25);

/** Lateral displacement (px) along the bezel, sampled at 128 steps from edge to flat top. */
function refractionProfile(bezel: number, thickness: number, ior: number) {
  const n = 128;
  const out = new Float32Array(n);
  const d = 1 / 512;
  for (let i = 0; i < n; i++) {
    const t = Math.max(d, i / (n - 1));
    const h = thickness * squircle(t);
    const slope = (thickness * (squircle(t + d) - squircle(t - d))) / (2 * d * bezel);
    const theta1 = Math.atan(slope); // angle of the surface normal from vertical
    const theta2 = Math.asin(Math.sin(theta1) / ior);
    out[i] = h * Math.tan(theta1 - theta2);
  }
  return out;
}

const cache = new Map<string, GlassMaps>();

export function buildGlassMaps(o: GlassOptions): GlassMaps {
  const W = Math.max(2, Math.round(o.width));
  const H = Math.max(2, Math.round(o.height));
  const r = Math.min(o.radius, W / 2, H / 2);
  const bezel = Math.max(1, Math.min(o.bezel, Math.min(W, H) / 2));
  const ior = o.ior ?? 1.5;
  const spec = o.specular ?? 0.6;
  const key = [W, H, r, bezel, o.thickness, ior, spec].join(":");
  const hit = cache.get(key);
  if (hit) return hit;

  const profile = refractionProfile(bezel, o.thickness, ior);
  let max = 0;
  for (const v of profile) max = Math.max(max, Math.abs(v));
  max = max || 1;

  const disp = document.createElement("canvas");
  const light = document.createElement("canvas");
  disp.width = light.width = W;
  disp.height = light.height = H;
  const dctx = disp.getContext("2d")!;
  const lctx = light.getContext("2d")!;
  const dImg = dctx.createImageData(W, H);
  const lImg = lctx.createImageData(W, H);
  const cx = W / 2;
  const cy = H / 2;
  const hx = W / 2 - r;
  const hy = H / 2 - r;
  // Light from the upper left; a weaker bounce from the lower right.
  const L1 = { x: -0.55, y: -0.83 };
  const L2 = { x: 0.6, y: 0.8 };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      const qx = Math.abs(px) - hx;
      const qy = Math.abs(py) - hy;
      // Signed distance to the rounded rectangle (negative inside).
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const sdf = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
      const inside = -sdf;

      let dx = 128;
      let dy = 128;
      let alpha = 0;
      if (inside > 0 && inside < bezel) {
        // Outward normal of the rounded rectangle.
        let nx: number;
        let ny: number;
        if (qx > 0 && qy > 0) {
          const len = Math.hypot(qx, qy) || 1;
          nx = (qx / len) * Math.sign(px);
          ny = (qy / len) * Math.sign(py);
        } else if (qx > qy) {
          nx = Math.sign(px);
          ny = 0;
        } else {
          nx = 0;
          ny = Math.sign(py);
        }
        const t = inside / bezel;
        const mag = profile[Math.min(127, Math.floor(t * 127))] / max;
        // Sample from further inside: the rim magnifies and bends the backdrop inward.
        dx = 128 - nx * mag * 127;
        dy = 128 - ny * mag * 127;

        // A thin catch-light hugging the outer edge, strongest facing the light.
        const rim = Math.pow(1 - t, 3.2);
        const s1 = Math.max(0, nx * L1.x + ny * L1.y);
        const s2 = Math.max(0, nx * L2.x + ny * L2.y);
        alpha = Math.min(1, (Math.pow(s1, 2) + 0.35 * Math.pow(s2, 2.4)) * rim * spec);
      }
      dImg.data[i] = dx;
      dImg.data[i + 1] = dy;
      dImg.data[i + 2] = 128;
      dImg.data[i + 3] = 255;
      lImg.data[i] = 255;
      lImg.data[i + 1] = 255;
      lImg.data[i + 2] = 255;
      lImg.data[i + 3] = Math.round(alpha * 255);
    }
  }
  dctx.putImageData(dImg, 0, 0);
  lctx.putImageData(lImg, 0, 0);
  const maps = { displacement: disp.toDataURL(), specular: light.toDataURL(), scale: max * 2 };
  if (cache.size > 40) cache.clear();
  cache.set(key, maps);
  return maps;
}

/** SVG filters as backdrop-filter only render in Chromium. */
export function supportsLiquidGlass(): boolean {
  if (typeof navigator === "undefined") return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  if (brands) return brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
  return /Chrome\/\d+/.test(navigator.userAgent) && !/Firefox|FxiOS/.test(navigator.userAgent);
}
