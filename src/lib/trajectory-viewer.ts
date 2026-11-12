/**
 * Small three.js scene that shows the cameras behind a fly-through: the
 * context views as thumbnail frustums, the rendered camera path as a dashed
 * line, and the camera of the frame currently shown in the video.
 *
 * Camera matrices use the dataset's OpenCV convention (x right, y down,
 * z forward) and are stored as 12 numbers (row-major 3x4 camera-to-world).
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface TrajContext {
  frame: number;
  name: string;
  c2w: number[];
}

export interface TrajData {
  scene: string;
  views: number;
  fps: number;
  frames: number;
  hfov: number;
  vfov: number;
  up: number[];
  context: TrajContext[];
  path: number[][];
}

export interface TrajectoryViewer {
  load(data: TrajData, thumbUrl: (frame: number) => string): void;
  setFrame(index: number): void;
  dispose(): void;
}

const COLOR_CONTEXT = 0xa1a1aa;
const COLOR_PATH = 0x52525b;
const COLOR_CURRENT = 0x76b900;

function matrixFromC2W(c2w: number[]): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  // prettier-ignore
  m.set(
    c2w[0], c2w[1], c2w[2], c2w[3],
    c2w[4], c2w[5], c2w[6], c2w[7],
    c2w[8], c2w[9], c2w[10], c2w[11],
    0, 0, 0, 1,
  );
  return m;
}

/** Wireframe pyramid for a camera, apex at the origin, image plane at depth `d`. */
function frustumLines(hfov: number, vfov: number, d: number, color: number, opacity = 1): THREE.LineSegments {
  const w = d * Math.tan(hfov / 2);
  const h = d * Math.tan(vfov / 2);
  const c = [
    new THREE.Vector3(-w, -h, d),
    new THREE.Vector3(w, -h, d),
    new THREE.Vector3(w, h, d),
    new THREE.Vector3(-w, h, d),
  ];
  const o = new THREE.Vector3(0, 0, 0);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 4; i++) {
    pts.push(o, c[i]);
    pts.push(c[i], c[(i + 1) % 4]);
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.LineSegments(geo, mat);
}

/** Textured image plane at depth `d`, flipped so that image rows run downwards (y down). */
function imagePlane(hfov: number, vfov: number, d: number, texture: THREE.Texture): THREE.Mesh {
  const w = d * Math.tan(hfov / 2);
  const h = d * Math.tan(vfov / 2);
  const geo = new THREE.PlaneGeometry(2 * w, 2 * h);
  const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = d;
  mesh.scale.y = -1;
  return mesh;
}

export function createTrajectoryViewer(container: HTMLElement): TrajectoryViewer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 0.6;
  controls.maxDistance = 7;
  controls.rotateSpeed = 0.7;

  const root = new THREE.Group();
  scene.add(root);
  const grid = new THREE.GridHelper(6, 30, 0xd4d4d8, 0xe4e4e7);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.9;
  scene.add(grid);

  const loader = new THREE.TextureLoader();
  let disposables: Array<{ dispose(): void }> = [];
  let current: THREE.Group | null = null;
  let pathMats: THREE.Matrix4[] = [];
  let frame = 0;
  let needsRender = true;

  function resize() {
    const w = container.clientWidth || 300;
    const h = container.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    needsRender = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  controls.addEventListener("change", () => (needsRender = true));

  let visible = true;
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) needsRender = true;
  });
  io.observe(container);

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    const moved = controls.update();
    if (moved || needsRender) {
      renderer.render(scene, camera);
      needsRender = false;
    }
  });

  function clear() {
    while (root.children.length) root.remove(root.children[0]);
    disposables.forEach((d) => d.dispose());
    disposables = [];
    current = null;
    pathMats = [];
  }

  function load(data: TrajData, thumbUrl: (frame: number) => string) {
    clear();

    // Rotate the world so the scene's estimated "up" points along +Y.
    const up = new THREE.Vector3(data.up[0], data.up[1], data.up[2]).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(0, 1, 0));

    // Normalise: centre on the cameras and scale so they fit in a unit sphere.
    const positions = [
      ...data.context.map((c) => new THREE.Vector3(c.c2w[3], c.c2w[7], c.c2w[11])),
      ...data.path.map((p) => new THREE.Vector3(p[3], p[7], p[11])),
    ].map((p) => p.applyQuaternion(q));
    const center = positions.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / positions.length);
    let radius = 0;
    let minY = Infinity;
    positions.forEach((p) => {
      radius = Math.max(radius, p.distanceTo(center));
      minY = Math.min(minY, p.y);
    });
    const s = radius > 1e-6 ? 1 / radius : 1;
    root.quaternion.copy(q);
    root.scale.setScalar(s);
    root.position.copy(center.clone().multiplyScalar(-s));
    grid.position.y = (minY - center.y) * s - 0.08;

    // Frustum sizes in normalised units, so they look the same for every scene.
    // Smaller for dense (64-view) captures so the thumbnails do not pile up.
    const frustumDepth = (data.context.length > 32 ? 0.09 : data.context.length > 16 ? 0.11 : 0.14) / s;
    const curDepth = 0.22 / s;

    // Context views: wireframe frustum plus the real image on its image plane.
    data.context.forEach((c) => {
      const g = new THREE.Group();
      g.matrixAutoUpdate = false;
      g.matrix.copy(matrixFromC2W(c.c2w));
      const lines = frustumLines(data.hfov, data.vfov, frustumDepth, COLOR_CONTEXT, 0.65);
      g.add(lines);
      disposables.push(lines.geometry, lines.material as THREE.Material);
      const tex = loader.load(thumbUrl(c.frame), () => (needsRender = true));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      const plane = imagePlane(data.hfov, data.vfov, frustumDepth, tex);
      g.add(plane);
      disposables.push(plane.geometry, plane.material as THREE.Material, tex);
      root.add(g);
    });

    // Camera path.
    const pts = data.path.map((p) => new THREE.Vector3(p[3], p[7], p[11]));
    const pathGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const pathMat = new THREE.LineDashedMaterial({ color: COLOR_PATH, dashSize: 0.035 / s, gapSize: 0.02 / s });
    const path = new THREE.Line(pathGeo, pathMat);
    path.computeLineDistances();
    root.add(path);
    disposables.push(pathGeo, pathMat);
    pathMats = data.path.map(matrixFromC2W);

    // Current camera.
    current = new THREE.Group();
    current.matrixAutoUpdate = false;
    const curLines = frustumLines(data.hfov, data.vfov, curDepth, COLOR_CURRENT);
    const w = curDepth * Math.tan(data.hfov / 2);
    const h = curDepth * Math.tan(data.vfov / 2);
    const fillGeo = new THREE.PlaneGeometry(2 * w, 2 * h);
    const fillMat = new THREE.MeshBasicMaterial({ color: COLOR_CURRENT, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.z = curDepth;
    const dotGeo = new THREE.SphereGeometry(0.016 / s, 16, 12);
    const dotMat = new THREE.MeshBasicMaterial({ color: COLOR_CURRENT });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    current.add(curLines, fill, dot);
    disposables.push(curLines.geometry, curLines.material as THREE.Material, fillGeo, fillMat, dotGeo, dotMat);
    root.add(current);
    setFrame(frame);

    // Look at the scene from behind the first fly-through camera, slightly above. The path is shared by every
    // view count of a scene, so the view stays put when the visitor switches 16 / 32 / 64 views; the context
    // cameras' mean direction nearly cancels for a full orbit and would point elsewhere for each view count.
    const look = new THREE.Vector3();
    if (data.path.length) look.set(data.path[0][2], data.path[0][6], data.path[0][10]);
    else data.context.forEach((c) => look.add(new THREE.Vector3(c.c2w[2], c.c2w[6], c.c2w[10])));
    look.applyQuaternion(q);
    look.y = 0;
    if (look.lengthSq() < 1e-6) look.set(0, 0, 1);
    look.normalize();
    camera.position.copy(look.clone().multiplyScalar(-2.1)).add(new THREE.Vector3(0, 1.9, 0));
    controls.target.set(0, 0, 0);
    controls.update();
    needsRender = true;
  }

  function setFrame(index: number) {
    frame = index;
    if (!current || !pathMats.length) return;
    const i = Math.min(pathMats.length - 1, Math.max(0, Math.floor(index)));
    current.matrix.copy(pathMats[i]);
    needsRender = true;
  }

  function dispose() {
    clear();
    ro.disconnect();
    io.disconnect();
    renderer.setAnimationLoop(null);
    controls.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { load, setFrame, dispose };
}
