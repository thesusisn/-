import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const WORLD_RADIUS = 24;
const WATER_LEVEL = 3;
const REACH = 6;
const GRAVITY = 24;
const JUMP_SPEED = 8.2;
const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const PLAYER_RADIUS = 0.3;
const EXTRA_CAPACITY = 600;

const BLOCK_TYPES = ["grass", "dirt", "stone", "sand", "wood", "leaves"];

const SWATCH_COLOR = {
  grass: "#5a9c3f",
  dirt: "#8b5a2b",
  stone: "#888a8d",
  sand: "#dccb83",
  wood: "#7a5230",
  leaves: "#3e7d2c",
};

// ---- deterministic value noise (no deps) ----
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
}

function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const v00 = hash2(xi, yi);
  const v10 = hash2(xi + 1, yi);
  const v01 = hash2(xi, yi + 1);
  const v11 = hash2(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const top = v00 + (v10 - v00) * u;
  const bottom = v01 + (v11 - v01) * u;
  return top + (bottom - top) * v;
}

function fbm(x, y) {
  let total = 0;
  let freq = 1;
  let amp = 1;
  let maxAmp = 0;
  for (let i = 0; i < 4; i++) {
    total += valueNoise(x * freq, y * freq) * amp;
    maxAmp += amp;
    freq *= 2;
    amp *= 0.5;
  }
  return total / maxAmp;
}

function heightAt(x, z, seed) {
  const n = fbm(x * 0.07 + seed, z * 0.07 + seed * 1.3);
  return Math.max(2, Math.floor(3 + n * 10));
}

// ---- pixel-art style textures, generated once ----
const textureCache = new Map();

function createSpeckleTexture(base, speck, density = 0.22) {
  const cacheKey = `${base}-${speck}-${density}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = speck;
  const n = Math.floor(size * size * density);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    ctx.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  textureCache.set(cacheKey, tex);
  return tex;
}

function createGrassSideTexture() {
  const cacheKey = "grass-side";
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (Math.random() < 0.18) {
        ctx.fillStyle = "#7a4c23";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.fillStyle = "#5a9c3f";
  for (let x = 0; x < size; x++) {
    const dip = Math.random() < 0.4 ? 1 : 0;
    ctx.fillRect(x, 0, 1, 4 - dip);
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < 4; y++) {
      if (Math.random() < 0.2) {
        ctx.fillStyle = "#4c8a33";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  textureCache.set(cacheKey, tex);
  return tex;
}

function createRingTexture() {
  const cacheKey = "wood-ring";
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#a87a45";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#7a5230";
  for (let r = 1; r < 8; r += 2) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  textureCache.set(cacheKey, tex);
  return tex;
}

function buildMaterials(type) {
  const matFromTex = (tex) => new THREE.MeshLambertMaterial({ map: tex });
  switch (type) {
    case "grass": {
      const top = createSpeckleTexture("#5a9c3f", "#4c8a33", 0.25);
      const side = createGrassSideTexture();
      const bottom = createSpeckleTexture("#8b5a2b", "#7a4c23", 0.2);
      return [
        matFromTex(side),
        matFromTex(side),
        matFromTex(top),
        matFromTex(bottom),
        matFromTex(side),
        matFromTex(side),
      ];
    }
    case "dirt": {
      const tex = createSpeckleTexture("#8b5a2b", "#7a4c23", 0.2);
      return new Array(6).fill(0).map(() => matFromTex(tex));
    }
    case "stone": {
      const tex = createSpeckleTexture("#888a8d", "#76787b", 0.25);
      return new Array(6).fill(0).map(() => matFromTex(tex));
    }
    case "sand": {
      const tex = createSpeckleTexture("#dccb83", "#cdba6c", 0.18);
      return new Array(6).fill(0).map(() => matFromTex(tex));
    }
    case "wood": {
      const bark = createSpeckleTexture("#7a5230", "#664323", 0.3);
      const ring = createRingTexture();
      return [
        matFromTex(bark),
        matFromTex(bark),
        matFromTex(ring),
        matFromTex(ring),
        matFromTex(bark),
        matFromTex(bark),
      ];
    }
    case "leaves": {
      const tex = createSpeckleTexture("#3e7d2c", "#326524", 0.3);
      return new Array(6).fill(0).map(() => matFromTex(tex));
    }
    default:
      return new Array(6).fill(0).map(() => matFromTex(createSpeckleTexture("#ff00ff", "#cc00cc")));
  }
}

export default function Game() {
  const mountRef = useRef(null);
  const [locked, setLocked] = useState(false);
  const [selected, setSelected] = useState(0);
  const selectedRef = useRef(0);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const skyColor = 0x9fd1f0;
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(skyColor, WORLD_RADIUS * 0.9, WORLD_RADIUS * 1.9);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.rotation.order = "YXZ";

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff3d6, 0.9);
    sun.position.set(40, 60, 20);
    scene.add(sun);

    // ---- world generation ----
    const seed = Math.random() * 1000;
    const blocks = new Map(); // "x,y,z" -> type
    const genLists = { grass: [], dirt: [], stone: [], sand: [], wood: [], leaves: [] };

    function addGenBlock(type, x, y, z) {
      const key = `${x},${y},${z}`;
      if (blocks.has(key)) return;
      blocks.set(key, type);
      genLists[type].push([x, y, z]);
    }

    const treePositions = [];
    for (let x = -WORLD_RADIUS; x < WORLD_RADIUS; x++) {
      for (let z = -WORLD_RADIUS; z < WORLD_RADIUS; z++) {
        const h = heightAt(x, z, seed);
        const biome = h <= WATER_LEVEL + 1 ? "sand" : h >= 11 ? "stone" : "grass";
        for (let y = 0; y <= h; y++) {
          let type;
          if (y === h) {
            type = biome === "stone" ? "stone" : biome;
          } else if (y >= h - 2) {
            type = biome === "sand" ? "sand" : "dirt";
          } else {
            type = "stone";
          }
          addGenBlock(type, x, y, z);
        }

        const edgeMargin = 3;
        const farEnough = treePositions.every(
          (t) => Math.abs(t[0] - x) + Math.abs(t[1] - z) > 4
        );
        if (
          biome === "grass" &&
          h > WATER_LEVEL + 2 &&
          h < 11 &&
          Math.abs(x) < WORLD_RADIUS - edgeMargin &&
          Math.abs(z) < WORLD_RADIUS - edgeMargin &&
          farEnough &&
          Math.random() < 0.012
        ) {
          treePositions.push([x, z, h]);
        }
      }
    }

    for (const [tx, tz, th] of treePositions) {
      const trunkHeight = 4 + Math.floor(Math.random() * 2);
      for (let i = 1; i <= trunkHeight; i++) {
        addGenBlock("wood", tx, th + i, tz);
      }
      const top = th + trunkHeight;
      const ring = (cx, cz, r, dy, skipCorners) => {
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (skipCorners && Math.abs(dx) === r && Math.abs(dz) === r) continue;
            addGenBlock("leaves", cx + dx, top + dy, cz + dz);
          }
        }
      };
      ring(tx, tz, 2, -2, true);
      ring(tx, tz, 2, -1, true);
      ring(tx, tz, 1, 0, false);
      addGenBlock("leaves", tx, top + 1, tz);
    }

    // ---- instanced meshes per block type ----
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const typeData = {};
    const dummy = new THREE.Object3D();

    for (const type of BLOCK_TYPES) {
      const list = genLists[type];
      const capacity = list.length + EXTRA_CAPACITY;
      const materials = buildMaterials(type);
      const mesh = new THREE.InstancedMesh(geometry, materials, capacity);
      mesh.frustumCulled = false;
      mesh.userData.type = type;
      mesh.count = capacity;
      const keyToIndex = new Map();
      const indexToKey = new Map();

      // park all slots far away first
      dummy.position.set(0, -200, 0);
      dummy.updateMatrix();
      for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, dummy.matrix);

      let nextFree = 0;
      for (const [x, y, z] of list) {
        const idx = nextFree++;
        dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
        const key = `${x},${y},${z}`;
        keyToIndex.set(key, idx);
        indexToKey.set(idx, key);
      }
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);

      typeData[type] = {
        mesh,
        capacity,
        nextFree,
        freeStack: [],
        keyToIndex,
        indexToKey,
      };
    }

    function addInstance(type, key, x, y, z) {
      const data = typeData[type];
      let idx;
      if (data.freeStack.length > 0) {
        idx = data.freeStack.pop();
      } else if (data.nextFree < data.capacity) {
        idx = data.nextFree++;
      } else {
        return false;
      }
      dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
      dummy.updateMatrix();
      data.mesh.setMatrixAt(idx, dummy.matrix);
      data.mesh.instanceMatrix.needsUpdate = true;
      data.keyToIndex.set(key, idx);
      data.indexToKey.set(idx, key);
      return true;
    }

    function removeInstance(type, key) {
      const data = typeData[type];
      const idx = data.keyToIndex.get(key);
      if (idx === undefined) return;
      dummy.position.set(0, -200, 0);
      dummy.updateMatrix();
      data.mesh.setMatrixAt(idx, dummy.matrix);
      data.mesh.instanceMatrix.needsUpdate = true;
      data.freeStack.push(idx);
      data.keyToIndex.delete(key);
      data.indexToKey.delete(idx);
    }

    // water plane
    const waterGeo = new THREE.PlaneGeometry(WORLD_RADIUS * 2.4, WORLD_RADIUS * 2.4);
    const waterMat = new THREE.MeshLambertMaterial({
      color: 0x2f6fb0,
      transparent: true,
      opacity: 0.65,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, WATER_LEVEL + 0.5, 0);
    scene.add(water);

    // ---- player state ----
    const spawnH = heightAt(0, 0, seed);
    const pos = { x: 0.5, y: spawnH + 3, z: 0.5 };
    const velocity = { x: 0, y: 0, z: 0 };
    let grounded = false;
    let yaw = 0;
    let pitch = 0;

    function isSolid(x, y, z) {
      return blocks.has(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`);
    }

    function collidesAtY(px, y, pz) {
      const r = PLAYER_RADIUS;
      return (
        isSolid(px - r, y, pz - r) ||
        isSolid(px - r, y, pz + r) ||
        isSolid(px + r, y, pz - r) ||
        isSolid(px + r, y, pz + r)
      );
    }

    function tryMoveHorizontal(dx, dz) {
      const feetY = pos.y + 0.1;
      const headY = pos.y + PLAYER_HEIGHT - 0.1;
      if (dx !== 0) {
        const nx = pos.x + dx;
        if (!collidesAtY(nx, feetY, pos.z) && !collidesAtY(nx, headY, pos.z)) {
          pos.x = nx;
        }
      }
      if (dz !== 0) {
        const nz = pos.z + dz;
        if (!collidesAtY(pos.x, feetY, nz) && !collidesAtY(pos.x, headY, nz)) {
          pos.z = nz;
        }
      }
    }

    function tryMoveVertical(dy) {
      const ny = pos.y + dy;
      if (dy < 0) {
        if (collidesAtY(pos.x, ny, pos.z)) {
          pos.y = Math.floor(ny) + 1;
          velocity.y = 0;
          grounded = true;
        } else {
          pos.y = ny;
          grounded = false;
        }
      } else if (dy > 0) {
        if (collidesAtY(pos.x, ny + PLAYER_HEIGHT, pos.z)) {
          velocity.y = 0;
        } else {
          pos.y = ny;
        }
      }
    }

    // ---- input ----
    const keys = new Set();
    function onKeyDown(e) {
      keys.add(e.code);
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= BLOCK_TYPES.length) {
        setSelected(num - 1);
      }
    }
    function onKeyUp(e) {
      keys.delete(e.code);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    function onWheel(e) {
      setSelected((s) => {
        const dir = e.deltaY > 0 ? 1 : -1;
        return (s + dir + BLOCK_TYPES.length) % BLOCK_TYPES.length;
      });
    }
    mount.addEventListener("wheel", onWheel);

    const PITCH_LIMIT = Math.PI / 2 - 0.01;
    function onMouseMove(e) {
      if (document.pointerLockElement !== renderer.domElement) return;
      yaw -= e.movementX * 0.0022;
      pitch -= e.movementY * 0.0022;
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
    }
    document.addEventListener("mousemove", onMouseMove);

    function onPointerLockChange() {
      setLocked(document.pointerLockElement === renderer.domElement);
    }
    document.addEventListener("pointerlockchange", onPointerLockChange);

    function requestLock() {
      renderer.domElement.requestPointerLock();
    }
    renderer.domElement.addEventListener("click", requestLock);

    const raycaster = new THREE.Raycaster();
    raycaster.far = REACH;
    const meshList = BLOCK_TYPES.map((t) => typeData[t].mesh);

    function getTarget() {
      camera.updateMatrixWorld();
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      const hits = raycaster.intersectObjects(meshList, false);
      if (hits.length === 0) return null;
      const hit = hits[0];
      const type = hit.object.userData.type;
      const key = typeData[type].indexToKey.get(hit.instanceId);
      if (!key) return null;
      const [bx, by, bz] = key.split(",").map(Number);
      const normal = hit.face.normal;
      return { type, key, bx, by, bz, normal };
    }

    function onMouseDown(e) {
      if (document.pointerLockElement !== renderer.domElement) return;
      const target = getTarget();
      if (!target) return;
      if (e.button === 0) {
        removeInstance(target.type, target.key);
        blocks.delete(target.key);
      } else if (e.button === 2) {
        const tx = target.bx + target.normal.x;
        const ty = target.by + target.normal.y;
        const tz = target.bz + target.normal.z;
        const newKey = `${tx},${ty},${tz}`;
        if (blocks.has(newKey)) return;
        const feetCell = `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
        const headCell = `${Math.floor(pos.x)},${Math.floor(pos.y + 1)},${Math.floor(pos.z)}`;
        if (newKey === feetCell || newKey === headCell) return;
        const placeType = BLOCK_TYPES[selectedRef.current];
        const ok = addInstance(placeType, newKey, tx, ty, tz);
        if (ok) blocks.set(newKey, placeType);
      }
    }
    function onContextMenu(e) {
      e.preventDefault();
    }
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("contextmenu", onContextMenu);

    function onResize() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    // ---- game loop ----
    const clock = new THREE.Clock();
    let frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      if (document.pointerLockElement === renderer.domElement) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3(-forward.z, 0, forward.x);

        let mx = 0;
        let mz = 0;
        if (keys.has("KeyW")) mz += 1;
        if (keys.has("KeyS")) mz -= 1;
        if (keys.has("KeyD")) mx += 1;
        if (keys.has("KeyA")) mx -= 1;

        const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? SPRINT_SPEED : WALK_SPEED;
        let moveX = 0;
        let moveZ = 0;
        if (mx !== 0 || mz !== 0) {
          const len = Math.hypot(mx, mz);
          mx /= len;
          mz /= len;
          moveX = (forward.x * mz + right.x * mx) * speed * dt;
          moveZ = (forward.z * mz + right.z * mx) * speed * dt;
        }
        tryMoveHorizontal(moveX, moveZ);

        if (keys.has("Space") && grounded) {
          velocity.y = JUMP_SPEED;
          grounded = false;
        }
      }

      velocity.y -= GRAVITY * dt;
      velocity.y = Math.max(velocity.y, -40);
      tryMoveVertical(velocity.y * dt);

      camera.position.set(pos.x, pos.y + EYE_HEIGHT, pos.z);

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      mount.removeEventListener("wheel", onWheel);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      renderer.domElement.removeEventListener("click", requestLock);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }
      for (const type of BLOCK_TYPES) {
        const data = typeData[type];
        data.mesh.geometry.dispose();
        for (const m of data.mesh.material) m.dispose();
      }
      geometry.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="game-page">
      <div className="game-canvas-wrap" ref={mountRef}>
        {!locked && (
          <div className="game-overlay">
            <h1>Voxel Craft</h1>
            <p>Click to play</p>
            <ul className="game-controls">
              <li><strong>WASD</strong> move &nbsp; <strong>Shift</strong> sprint &nbsp; <strong>Space</strong> jump</li>
              <li><strong>Mouse</strong> look &nbsp; <strong>Left click</strong> break &nbsp; <strong>Right click</strong> place</li>
              <li><strong>1-6</strong> or <strong>scroll</strong> to pick a block</li>
            </ul>
          </div>
        )}
        <div className="game-crosshair" />
        <div className="game-hotbar">
          {BLOCK_TYPES.map((type, i) => (
            <div
              key={type}
              className={`hotbar-slot${i === selected ? " selected" : ""}`}
              onClick={() => setSelected(i)}
              title={type}
            >
              <span className="hotbar-swatch" style={{ background: SWATCH_COLOR[type] }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
