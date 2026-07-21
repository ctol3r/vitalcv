/**
 * Career Evidence Field — WebGPU renderer (SHD-2.1).
 *
 * The Graphene-language tier: the SAME semantic model as the 2D canvas and
 * SVG poster, rendered with real depth — a perspective camera that breathes
 * and answers the pointer with a bounded orbit, atoms as lit soft spheres on
 * true z-layers, evidence pulses travelling the links in 3D, the wallet
 * capsule as a frosted plate with a sweeping caustic, and one bounded
 * acceptance ring. Original WGSL throughout — nothing imported.
 *
 * Contract (SHD-1.1 / VHS-1 runtime ladder):
 *  - `initEvidenceFieldGpu` resolves null on ANY failure — missing adapter,
 *    slow init (deadline), context loss — and never throws to the caller;
 *  - the caller (CareerEvidenceField) then mounts the Canvas-2D tier, and
 *    a crash beyond init is caught by SceneBoundary → poster. No user-visible
 *    error state exists;
 *  - DPR ≤ 2, rAF suspends offscreen/hidden, destroy() releases the device.
 */

import {
  cssColorToRgb,
  KIND_COLOR,
  MODEL,
  readPalette,
  type RGB,
} from './model';

const INIT_DEADLINE_MS = 900;

/** Frame index whose render target is copied back for the paint self-check. */
const PAINT_CHECK_FRAME = 8;

/** shape ids matched in the fragment shader */
const SHAPE_ATOM = 0;
const SHAPE_PULSE = 1;
const SHAPE_CAPSULE = 2;
const SHAPE_RING = 3;

const FLOATS_PER_INSTANCE = 12; // pos(3) size(1) color(3) alpha(1) shape(1) phase(1) aspect(1) pad(1)

const WGSL = /* wgsl */ `
struct Uniforms {
  viewProj : mat4x4<f32>,
  time : f32,
  // Projection scale terms (f/aspect, f) handed to the billboard expansion so
  // sprite corners grow with the SAME projection the camera applies: square
  // sprites stay square at any panel aspect instead of stretching with it.
  projX : f32,
  projY : f32,
  _pad0 : f32,
};
@group(0) @binding(0) var<uniform> U : Uniforms;

struct VSIn {
  @location(0) corner : vec2<f32>,          // unit quad corner (-1..1)
  @location(1) ipos : vec3<f32>,            // instance world position
  @location(2) isize : f32,                 // world size
  @location(3) icolor : vec3<f32>,
  @location(4) ialpha : f32,
  @location(5) ishape : f32,
  @location(6) iphase : f32,
  @location(7) iaspect : f32,               // width/height for plates
};

struct VSOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) uv : vec2<f32>,
  @location(1) color : vec3<f32>,
  @location(2) alpha : f32,
  @location(3) shape : f32,
  @location(4) phase : f32,
};

@vertex
fn vs(in : VSIn) -> VSOut {
  var out : VSOut;
  // billboard: expand the quad in clip space using the projection's own scale
  // terms. The perspective divide happens after this, so a sprite shrinks with
  // distance exactly like the geometry it sits on — depth reads as depth.
  let world = vec4<f32>(in.ipos, 1.0);
  let center = U.viewProj * world;
  let sx = in.isize * in.iaspect * U.projX;
  let sy = in.isize * U.projY;
  out.pos = center + vec4<f32>(in.corner.x * sx, in.corner.y * sy, 0.0, 0.0);
  out.uv = in.corner;
  out.color = in.icolor;
  out.alpha = in.ialpha;
  out.shape = in.ishape;
  out.phase = in.iphase;
  return out;
}

fn sdRoundBox(p : vec2<f32>, b : vec2<f32>, r : f32) -> f32 {
  let q = abs(p) - b + vec2<f32>(r, r);
  return length(max(q, vec2<f32>(0.0, 0.0))) + min(max(q.x, q.y), 0.0) - r;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4<f32> {
  let d = length(in.uv);
  var a : f32 = 0.0;
  var col : vec3<f32> = in.color;

  if (in.shape < 0.5) {
    // ATOM: lit soft sphere — core, vertical shade, specular, halo
    let core = 1.0 - smoothstep(0.42, 0.58, d);
    let halo = (1.0 - smoothstep(0.3, 1.0, d)) * 0.25;
    let shade = 0.85 + 0.3 * (0.5 - in.uv.y * 0.5);
    let spec = (1.0 - smoothstep(0.0, 0.22, length(in.uv - vec2<f32>(-0.18, -0.2)))) * 0.5;
    col = col * shade + vec3<f32>(spec, spec, spec);
    a = min(1.0, core + halo) * in.alpha;
  } else if (in.shape < 1.5) {
    // PULSE: small bright travelling dot
    a = (1.0 - smoothstep(0.0, 0.9, d)) * in.alpha;
    col = col + vec3<f32>(0.25, 0.25, 0.25) * (1.0 - d);
  } else if (in.shape < 2.5) {
    // CAPSULE: frosted rounded plate + sweeping caustic + rim light
    let sd = sdRoundBox(in.uv, vec2<f32>(0.86, 0.72), 0.28);
    let body = 1.0 - smoothstep(-0.02, 0.03, sd);
    let rim = (1.0 - smoothstep(0.0, 0.09, abs(sd))) * 0.55;
    let sweep = sin(U.time * 0.5 + in.phase);
    let caustic = (1.0 - smoothstep(0.0, 0.5, abs(in.uv.x - sweep * 0.35))) *
                  (1.0 - smoothstep(-0.7, 0.35, in.uv.y)) * 0.28;
    let shade = 0.96 + 0.08 * (0.5 - in.uv.y * 0.5);
    col = col * shade + vec3<f32>(caustic + rim * 0.4, caustic + rim * 0.4, caustic + rim * 0.5);
    a = (body * 0.94 + rim * 0.4) * in.alpha;
  } else {
    // RING: one bounded acceptance ring, breathing
    let r = 0.62 + 0.16 * sin(U.time * 0.8 + in.phase);
    let ring = 1.0 - smoothstep(0.02, 0.09, abs(d - r));
    a = ring * in.alpha;
  }

  return vec4<f32>(col * a, a); // premultiplied
}

// ── links: constant-color lines with per-vertex alpha ──
struct LVSIn {
  @location(0) pos : vec3<f32>,
  @location(1) color : vec4<f32>,
};
struct LVSOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) color : vec4<f32>,
};
@vertex
fn lvs(in : LVSIn) -> LVSOut {
  var out : LVSOut;
  out.pos = U.viewProj * vec4<f32>(in.pos, 1.0);
  out.color = in.color;
  return out;
}
@fragment
fn lfs(in : LVSOut) -> @location(0) vec4<f32> {
  return vec4<f32>(in.color.rgb * in.color.a, in.color.a);
}
`;

export interface GpuFieldHandle {
  destroy(): void;
  /**
   * Frames actually submitted. The caller's paint probe needs this to tell
   * "drew nothing because it is broken" apart from "drew nothing because the
   * loop is correctly parked" — the render loop suspends while the field is
   * offscreen or the tab is hidden, and a tab restored in the background
   * starts life at `document.hidden === true`.
   */
  framesDrawn(): number;
  /**
   * Non-transparent pixels counted from the render target, or null until the
   * self-check has run (it needs a drawn frame).
   *
   * This is measured GPU-side, inside the renderer, because it cannot be
   * measured from outside: `drawImage(webgpuCanvas)` on a live rAF loop reads
   * back empty once the frame has been presented, so an external probe scores
   * a perfectly healthy scene as blank and demotes it. Verified — that false
   * negative demoted this very renderer while it was visibly drawing.
   */
  paintedPixels(): number | null;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const FOV_Y = 0.62;
const CAM_DIST = 2.35;
const DEPTH_SPAN = 0.55;

/**
 * Model space (x, y in 0..1) → world, FITTED to the panel rather than fixed.
 *
 * Solving `ndc.x = (x − 0.5) · 2` for a point at camera distance D gives
 * spanX = 2·D·aspect/f and spanY = 2·D/f. So the z = 0 plane lands exactly on
 * the panel rect at any aspect ratio: nothing in the composition can be
 * cropped by a tall desktop panel, and the labelled anchors (pinned to z = 0)
 * sit under the HTML labels, which are placed by these same normalized
 * coordinates. Depth is carried by z alone — that is what parallaxes.
 *
 * The old fixed spans (2.2 × 1.5) assumed a 1.46 panel aspect; the real panel
 * is ~1.04 landscape and portrait on tall desktops, which pushed the outer
 * sources past |ndc.x| = 1.24 — outside the frustum.
 */
export function makeToWorld(aspect: number): (x: number, y: number, z: number) => Vec3 {
  const f = 1 / Math.tan(FOV_Y / 2);
  const spanX = (2 * CAM_DIST * aspect) / f;
  const spanY = (2 * CAM_DIST) / f;
  return (x, y, z) => ({ x: (x - 0.5) * spanX, y: (0.5 - y) * spanY, z: z * DEPTH_SPAN });
}

function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + c] * b[r * 4 + k];
      out[r * 4 + c] = s;
    }
  return out;
}

function perspective(fovY: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovY / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = far / (near - far);
  out[11] = -1;
  out[14] = (near * far) / (near - far);
  return out;
}

function lookAt(eye: Vec3, target: Vec3): Float32Array {
  const fz = { x: eye.x - target.x, y: eye.y - target.y, z: eye.z - target.z };
  const fl = Math.hypot(fz.x, fz.y, fz.z) || 1;
  const z = { x: fz.x / fl, y: fz.y / fl, z: fz.z / fl };
  const up = { x: 0, y: 1, z: 0 };
  const xv = { x: up.y * z.z - up.z * z.y, y: up.z * z.x - up.x * z.z, z: up.x * z.y - up.y * z.x };
  const xl = Math.hypot(xv.x, xv.y, xv.z) || 1;
  const x = { x: xv.x / xl, y: xv.y / xl, z: xv.z / xl };
  const y = { x: z.y * x.z - z.z * x.y, y: z.z * x.x - z.x * x.z, z: z.x * x.y - z.y * x.x };
  const out = new Float32Array(16);
  out[0] = x.x; out[4] = x.y; out[8] = x.z;
  out[1] = y.x; out[5] = y.y; out[9] = y.z;
  out[2] = z.x; out[6] = z.y; out[10] = z.z;
  out[12] = -(x.x * eye.x + x.y * eye.y + x.z * eye.z);
  out[13] = -(y.x * eye.x + y.y * eye.y + y.z * eye.z);
  out[14] = -(z.x * eye.x + z.y * eye.y + z.z * eye.z);
  out[15] = 1;
  return out;
}

/**
 * The field camera: a bounded orbit around the composition.
 *
 * Exported pure, with `projectToNdc` below, so the projection is assertable in
 * plain vitest with no GPU present. The bug these guard against — building
 * view × projection instead of projection × view — was invisible to every
 * existing check: init succeeded, no error was thrown, the canvas stayed
 * attached, and it drew nothing at all.
 */
export function computeViewProj(
  aspect: number,
  yaw: number,
  pitch: number,
): { viewProj: Float32Array; proj: Float32Array } {
  const eye = {
    x: Math.sin(yaw) * CAM_DIST,
    y: pitch * CAM_DIST * 0.9,
    z: Math.cos(yaw) * CAM_DIST,
  };
  const proj = perspective(FOV_Y, aspect, 0.1, 10);
  return { viewProj: mat4Multiply(proj, lookAt(eye, { x: 0, y: 0, z: 0 })), proj };
}

/** Column-major mat4 × point → NDC, or null when the point is degenerate/behind. */
export function projectToNdc(
  m: Float32Array,
  p: Vec3,
): { x: number; y: number; z: number } | null {
  const v = [p.x, p.y, p.z, 1];
  const o = [0, 0, 0, 0];
  for (let row = 0; row < 4; row++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += m[k * 4 + row] * v[k];
    o[row] = s;
  }
  if (!(o[3] > 1e-6)) return null; // w ≤ 0 → nothing drawable
  return { x: o[0] / o[3], y: o[1] / o[3], z: o[2] / o[3] };
}

/**
 * Initialize the WebGPU field. Resolves null (never throws) when the device
 * is unavailable or too slow — the caller mounts the Canvas-2D tier instead.
 */
export async function initEvidenceFieldGpu(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  onLost: () => void,
): Promise<GpuFieldHandle | null> {
  try {
    const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
    if (!gpu) return null;

    const deadline = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), INIT_DEADLINE_MS),
    );
    const setup = (async () => {
      const adapter = await gpu.requestAdapter();
      if (!adapter) return null;
      const device = await adapter.requestDevice();
      return device;
    })();
    const device = await Promise.race([setup, deadline]);
    if (!device) return null;

    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
      device.destroy();
      return null;
    }
    const format = gpu.getPreferredCanvasFormat();
    // COPY_SRC so the renderer can read its OWN output back once and prove it
    // actually painted (see `paintedPixels`). RENDER_ATTACHMENT is the default
    // and must be restated once `usage` is given explicitly.
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    device.lost.then(() => onLost()).catch(() => onLost());

    const shaderModule = device.createShaderModule({ code: WGSL });

    const uniforms = device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });
    const bindGroup = device.createBindGroup({
      layout: bindLayout,
      entries: [{ binding: 0, resource: { buffer: uniforms } }],
    });
    const pipeLayout = device.createPipelineLayout({ bindGroupLayouts: [bindLayout] });

    const blend: GPUBlendState = {
      color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    };

    const spritePipeline = device.createRenderPipeline({
      layout: pipeLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: 8,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
          },
          {
            arrayStride: FLOATS_PER_INSTANCE * 4,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 1, offset: 0, format: 'float32x3' },
              { shaderLocation: 2, offset: 12, format: 'float32' },
              { shaderLocation: 3, offset: 16, format: 'float32x3' },
              { shaderLocation: 4, offset: 28, format: 'float32' },
              { shaderLocation: 5, offset: 32, format: 'float32' },
              { shaderLocation: 6, offset: 36, format: 'float32' },
              { shaderLocation: 7, offset: 40, format: 'float32' },
            ],
          },
        ],
      },
      fragment: { module: shaderModule, entryPoint: 'fs', targets: [{ format, blend }] },
      primitive: { topology: 'triangle-list' },
    });

    const linePipeline = device.createRenderPipeline({
      layout: pipeLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'lvs',
        buffers: [
          {
            arrayStride: 28,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x4' },
            ],
          },
        ],
      },
      fragment: { module: shaderModule, entryPoint: 'lfs', targets: [{ format, blend }] },
      primitive: { topology: 'line-list' },
    });

    const quad = device.createBuffer({
      size: 6 * 8,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      quad,
      0,
      new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
    );

    // palette → RGB uniforms (theme-correct at init; field is decorative, so
    // a theme flip mid-session simply re-inits on remount)
    const palette = readPalette(host);
    const rgb = (css: string, fallback: RGB): RGB => cssColorToRgb(css) ?? fallback;
    const colors = {
      source: rgb(palette.source, [0.11, 0.49, 0.33]),
      proof: rgb(palette.proof, [0.31, 0.27, 0.9]),
      opportunity: rgb(palette.opportunity, [0.18, 0.44, 0.69]),
      attention: rgb(palette.attention, [0.64, 0.4, 0.04]),
      capsule: rgb(palette.capsule, [1, 1, 1]),
      line: rgb(palette.line, [0.84, 0.86, 0.85]),
    };
    const kindRgb = (k: (typeof MODEL.atoms)[number]['kind']): RGB =>
      k === 'source'
        ? colors.source
        : k === 'proof'
          ? colors.proof
          : k === 'opportunity'
            ? colors.opportunity
            : colors.attention;

    // instances: atoms + pulses (one per link) + capsule + ring
    const pulseCount = MODEL.inLinks.length + MODEL.outLinks.length;
    const instanceCount = MODEL.atoms.length + pulseCount + 2;
    const instanceData = new Float32Array(instanceCount * FLOATS_PER_INSTANCE);
    const instances = device.createBuffer({
      size: instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // links: 2 verts per link
    const linkCount = MODEL.inLinks.length + MODEL.outLinks.length;
    const lineData = new Float32Array(linkCount * 2 * 7);
    const lines = device.createBuffer({
      size: lineData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    let raf = 0;
    let onscreen = true;
    let hidden = document.hidden;
    let destroyed = false;
    let framesDrawn = 0;
    let paintedPixels: number | null = null;
    const start = performance.now();
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };

    const resize = () => {
      const r = host.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
    };

    const frame = (now: number) => {
      raf = 0;
      if (destroyed || !onscreen || hidden) return;
      const t = (now - start) / 1000;

      // camera: gentle idle drift + bounded pointer orbit (≤ ~6°)
      ptr.x += (ptr.tx - ptr.x) * 0.06;
      ptr.y += (ptr.ty - ptr.y) * 0.06;
      // Idle drift is a visible slow orbit so the field reads as a living 3D
      // scene, not a flat graph; pointer adds a bounded parallax on top.
      const yaw = ptr.x * 0.12 + Math.sin(t * 0.11) * 0.07;
      const pitch = ptr.y * 0.09 + Math.cos(t * 0.13) * 0.045;
      const aspect = canvas.width / Math.max(1, canvas.height);
      const { viewProj, proj } = computeViewProj(aspect, yaw, pitch);
      const toWorld = makeToWorld(aspect);
      const capsuleWorld = toWorld(MODEL.capsule.x, MODEL.capsule.y, 0);

      const ub = new Float32Array(20);
      ub.set(viewProj, 0);
      ub[16] = t;
      ub[17] = proj[0]; // f / aspect
      ub[18] = proj[5]; // f
      device.queue.writeBuffer(uniforms, 0, ub);

      // ── instances ──
      let o = 0;
      const put = (
        p: Vec3,
        size: number,
        c: RGB,
        alpha: number,
        shape: number,
        phase: number,
        aspectRatio = 1,
      ) => {
        instanceData[o++] = p.x;
        instanceData[o++] = p.y;
        instanceData[o++] = p.z;
        instanceData[o++] = size;
        instanceData[o++] = c[0];
        instanceData[o++] = c[1];
        instanceData[o++] = c[2];
        instanceData[o++] = alpha;
        instanceData[o++] = shape;
        instanceData[o++] = phase;
        instanceData[o++] = aspectRatio;
        instanceData[o++] = 0;
      };

      // capsule first (behind atoms)
      const breathe = 1 + Math.sin(t * 0.9) * 0.04;
      put(capsuleWorld, 0.19 * breathe, colors.capsule, 0.96, SHAPE_CAPSULE, 0, 1.3);

      // atoms
      for (const a of MODEL.atoms) {
        const w = toWorld(a.x, a.y, a.z);
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.3 + a.phase);
        const size = (0.032 + a.base * 0.034) * (0.86 + pulse * 0.26);
        put(w, size, kindRgb(a.kind), a.kind === 'attention' ? 0.8 : 0.95, SHAPE_ATOM, a.phase);
      }

      // travelling pulses along links
      const travel = (i: number, into: boolean, idx: number) => {
        const a = MODEL.atoms[i];
        const aw = toWorld(a.x, a.y, a.z);
        const speed = into ? 0.16 : 0.12;
        const frac = ((t * speed + a.phase * 0.16) % 1 + 1) % 1;
        const f = into ? frac : 1 - frac;
        const sx = into ? aw : capsuleWorld;
        const ex = into ? capsuleWorld : aw;
        const p = {
          x: sx.x + (ex.x - sx.x) * f,
          y: sx.y + (ex.y - sx.y) * f,
          z: sx.z + (ex.z - sx.z) * f,
        };
        const alpha = 0.35 + 0.5 * Math.sin(frac * Math.PI);
        put(p, into ? 0.016 : 0.02, into ? kindRgb(a.kind) : colors.opportunity, alpha, SHAPE_PULSE, idx);
      };
      MODEL.inLinks.forEach((i, k) => travel(i, true, k));
      MODEL.outLinks.forEach((i, k) => travel(i, false, k));

      // acceptance ring around its opportunity — one, bounded
      const acc = MODEL.atoms[MODEL.acceptance];
      if (acc) {
        const w = toWorld(acc.x, acc.y, acc.z);
        put(w, 0.085, colors.opportunity, 0.6, SHAPE_RING, 0.3);
      }
      device.queue.writeBuffer(instances, 0, instanceData);

      // ── links ──
      let lo = 0;
      const seg = (ai: number, into: boolean) => {
        const a = MODEL.atoms[ai];
        const aw = toWorld(a.x, a.y, a.z);
        const alphaA = into ? 0.4 : 0.3;
        for (const [p, al] of [
          [aw, alphaA],
          [capsuleWorld, alphaA * 0.55],
        ] as const) {
          lineData[lo++] = p.x;
          lineData[lo++] = p.y;
          lineData[lo++] = p.z;
          lineData[lo++] = colors.line[0];
          lineData[lo++] = colors.line[1];
          lineData[lo++] = colors.line[2];
          lineData[lo++] = al;
        }
      };
      MODEL.inLinks.forEach((i) => seg(i, true));
      MODEL.outLinks.forEach((i) => seg(i, false));
      device.queue.writeBuffer(lines, 0, lineData);

      // ── encode ──
      const target = context.getCurrentTexture();
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: target.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      pass.setBindGroup(0, bindGroup);
      pass.setPipeline(linePipeline);
      pass.setVertexBuffer(0, lines);
      pass.draw(linkCount * 2);
      pass.setPipeline(spritePipeline);
      pass.setVertexBuffer(0, quad);
      pass.setVertexBuffer(1, instances);
      pass.draw(6, instanceCount);
      pass.end();

      // Self-check, once, on a settled frame: copy this frame's render target
      // and count what actually landed in it. Encoded into the SAME command
      // buffer as the draw, so it reads the texture while it is still valid —
      // the one place this measurement is trustworthy.
      let readback: GPUBuffer | null = null;
      let bytesPerRow = 0;
      if (framesDrawn === PAINT_CHECK_FRAME) {
        // Guarded: an implementation that refuses a copy from the swap-chain
        // texture must cost us the self-check, not the render loop. Throwing
        // here would escape rAF and kill the scene outright — a worse failure
        // than the one being checked for.
        try {
          bytesPerRow = Math.ceil((target.width * 4) / 256) * 256; // WebGPU alignment
          readback = device.createBuffer({
            size: bytesPerRow * target.height,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
          });
          encoder.copyTextureToBuffer(
            { texture: target },
            { buffer: readback, bytesPerRow },
            { width: target.width, height: target.height },
          );
        } catch {
          readback = null;
          paintedPixels = -1; // unmeasurable → the caller keeps this tier
        }
      }

      device.queue.submit([encoder.finish()]);
      framesDrawn += 1;

      if (readback) {
        const buf = readback;
        const w = target.width;
        const h = target.height;
        void buf
          .mapAsync(GPUMapMode.READ)
          .then(() => {
            const bytes = new Uint8Array(buf.getMappedRange());
            let painted = 0;
            for (let y = 0; y < h; y++) {
              const row = y * bytesPerRow;
              for (let x = 0; x < w; x++) if (bytes[row + x * 4 + 3] > 8) painted += 1;
            }
            paintedPixels = painted;
            buf.unmap();
          })
          .catch(() => {
            paintedPixels = -1; // unmeasurable → caller must not demote on this
          })
          .finally(() => {
            try {
              buf.destroy();
            } catch {
              /* already gone */
            }
          });
      }

      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf && !destroyed && onscreen && !hidden) raf = requestAnimationFrame(frame);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const io = new IntersectionObserver(
      (e) => {
        onscreen = e[0]?.isIntersecting ?? true;
        wake();
      },
      { threshold: 0.02 },
    );
    io.observe(host);
    const onVis = () => {
      hidden = document.hidden;
      wake();
    };
    document.addEventListener('visibilitychange', onVis);
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      ptr.tx = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
      ptr.ty = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
      wake();
    };
    const onLeave = () => {
      ptr.tx = 0;
      ptr.ty = 0;
      wake();
    };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);

    wake();

    return {
      framesDrawn: () => framesDrawn,
      paintedPixels: () => paintedPixels,
      destroy() {
        destroyed = true;
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        host.removeEventListener('pointermove', onMove);
        host.removeEventListener('pointerleave', onLeave);
        try {
          device.destroy();
        } catch {
          /* already lost */
        }
      },
    };
  } catch {
    return null;
  }
}
