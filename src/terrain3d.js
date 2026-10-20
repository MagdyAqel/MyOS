import { mapSize, mapX, mapY } from "./world.js";
import * as THREE from "three";
import { seededRandom } from "./maps.js";
import { QUALITY } from "./model-details.js";

export function createTerrain(scene, terrain, stage, map, renderer, quality) {
  const { width, height } = mapSize(map);
  const halfW = width / 2,
    halfH = height / 2;
  const random = seededRandom(map.seed),
    textures = [],
    materials = [];
  const coast = stage.terrain === "coast",
    abyss = stage.terrain === "abyss",
    green = stage.terrain === "highland";
  const level = abyss ? -21 : 0;
  const shoreZ = mapY(map, 240) - halfH;
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const material = (options) => {
    const m = new THREE.MeshStandardMaterial(options);
    materials.push(m);
    return m;
  };
  function texture(canvas, color = true) {
    const t = new THREE.CanvasTexture(canvas);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    textures.push(t);
    return t;
  }
  function canvas(w, h = w) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  const sand = canvas(256),
    ctx = sand.getContext("2d");
  ctx.fillStyle = "#bbb9af";
  ctx.fillRect(0, 0, 256, 256);
  const grain = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (random() - 0.5) * 38;
    for (let k = 0; k < 3; k++) grain.data[i + k] += n;
  }
  ctx.putImageData(grain, 0, 0);
  for (let i = 0; i < 70; i++) {
    const x = random() * 256,
      y = random() * 256,
      r = 0.6 + random() * 1.4;
    ctx.fillStyle = "#565b4a45";
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff8dd55";
    ctx.fillRect(x, y - 1, r, 0.5);
  }
  const soil = texture(sand);
  soil.wrapS = soil.wrapT = THREE.RepeatWrapping;
  soil.repeat.set(24, 18);
  const geometry = new THREE.PlaneGeometry(3000, 2400, 120, 96);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position,
    colors = [];
  const base = new THREE.Color(map.ground);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      z = position.getZ(i);
    const outside = Math.max(
      0,
      Math.abs(x) - halfW - 30,
      Math.abs(z) - halfH - 30,
    );
    const envelope = Math.min(1, outside / 250);
    const waves = Math.sin(x * 0.013 + z * 0.008) * Math.cos(z * 0.018) * 14;
    let height = level + envelope * (18 + waves);
    if (coast && z > shoreZ) height = -Math.min(25, (z - shoreZ) * 0.6);
    position.setY(i, height);
    const variation =
      Math.sin(x * 0.021 + z * 0.012) * 0.045 +
      Math.cos(z * 0.039 - x * 0.007) * 0.025;
    const c = base.clone().multiplyScalar(1.16 + variation);
    if (coast && z > -100 && z < -55) c.multiplyScalar(0.74);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(
    geometry,
    material({
      map: soil,
      bumpMap: soil,
      bumpScale: green ? 0.8 : 0.5,
      vertexColors: true,
      roughness: 1,
    }),
  );
  ground.receiveShadow = true;
  terrain.add(ground);

  // A worn access route and paired wheel ruts give the flat playable area scale.
  if (!abyss) {
    const c = canvas(1024, 640),
      p = c.getContext("2d");
    const z = coast ? 140 : 320;
    const path = (offset = 0) => {
      p.beginPath();
      p.moveTo(-20, z + offset);
      p.bezierCurveTo(
        250,
        z - 20 + offset,
        650,
        z + 25 + offset,
        1040,
        z + offset,
      );
    };
    p.lineWidth = 42;
    p.strokeStyle = green ? "#b1a78a35" : "#7f70501c";
    path();
    p.stroke();
    p.lineWidth = 30;
    p.strokeStyle = green ? "#b8a58438" : "#e5cd9c33";
    path();
    p.stroke();
    for (const offset of [-10, -5, 5, 10]) {
      p.lineWidth = 1.5;
      p.strokeStyle = "#554a3023";
      path(offset);
      p.stroke();
    }
    for (let i = 0; i < 1500; i++) {
      p.fillStyle = i % 2 ? "#493f2d0a" : "#fff3c410";
      const x = random() * 1024,
        y = random() * 640;
      p.beginPath();
      p.ellipse(x, y, random() * 11 + 1, random() * 3 + 1, 0.3, 0, Math.PI * 2);
      p.fill();
    }
    const decalMaterial = material({
      map: texture(c),
      transparent: true,
      depthWrite: false,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      decalMaterial,
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.y = 0.16;
    decal.receiveShadow = true;
    // Keep the decoration out of the navigable water.
    if (coast) {
      const pos = decal.geometry.attributes.position,
        uv = decal.geometry.attributes.uv;
      for (let i = 0; i < pos.count; i++)
        if (pos.getY(i) < 0) {
          pos.setY(i, halfH - mapY(map, 235));
          uv.setY(i, 1 - 235 / 620);
        }
      pos.needsUpdate = uv.needsUpdate = true;
    }
    terrain.add(decal);
  }

  const rockTexture = soil.clone();
  rockTexture.repeat.set(2, 2);
  textures.push(rockTexture);
  const stone = material({
    map: rockTexture,
    bumpMap: rockTexture,
    bumpScale: 0.7,
    vertexColors: true,
    roughness: 0.98,
    flatShading: true,
  });
  function rock(x, z, radius, height, seed) {
    const rng = seededRandom(seed),
      geo = new THREE.IcosahedronGeometry(1, 2),
      p = geo.attributes.position,
      c = [];
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i),
        vy = p.getY(i),
        vz = p.getZ(i);
      // Coordinate-based displacement keeps duplicate edge vertices welded.
      const noise = Math.sin(vx * 13 + seed) * Math.cos(vz * 11 - vy * 8) * 0.2;
      const strata = Math.floor((vy + 1) * 5) * 0.016;
      p.setXYZ(
        i,
        vx * radius * (0.92 + noise),
        ((vy + 0.8) * height) / 1.8,
        vz * radius * (0.92 + noise),
      );
      const color = new THREE.Color(
        abyss ? "#4b6b69" : green ? "#7a8071" : "#978772",
      );
      color.multiplyScalar(
        0.76 + strata + rng() * 0.12 + Math.max(0, vy) * 0.15,
      );
      c.push(color.r, color.g, color.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, stone);
    m.position.set(x, level, z);
    m.castShadow = m.receiveShadow = true;
    terrain.add(m);
  }
  for (const [i, o] of map.obstacles.entries()) {
    rock(o.x - halfW, o.y - halfH, o.r * 0.8, o.h, map.seed + i * 7);
    for (let j = 0; j < 4; j++) {
      const angle = j * 1.7 + i;
      rock(
        o.x - halfW + Math.cos(angle) * o.r * 0.55,
        o.y - halfH + Math.sin(angle) * o.r * 0.55,
        o.r * 0.35,
        o.h * (0.28 + random() * 0.25),
        map.seed + i + j + 30,
      );
    }
  }
  // Distant ridgelines continue the landscape past the tactical boundary.
  for (let i = 0; i < 11; i++) {
    const x = -1250 + i * 250,
      z = -halfH - 470 - random() * 240;
    rock(
      x,
      z,
      170 + random() * 100,
      (green ? 180 : 65) + random() * 80,
      map.seed + i + 90,
    );
  }
  const boundary = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-halfW, level + 0.5, -halfH),
    new THREE.Vector3(halfW, level + 0.5, -halfH),
    new THREE.Vector3(halfW, level + 0.5, halfH),
    new THREE.Vector3(-halfW, level + 0.5, halfH),
    new THREE.Vector3(-halfW, level + 0.5, -halfH),
  ]);
  const boundaryMaterial = new THREE.LineDashedMaterial({
    color: "#d6ccb1",
    dashSize: 5,
    gapSize: 9,
    transparent: true,
    opacity: 0.28,
  });
  materials.push(boundaryMaterial);
  const border = new THREE.Line(boundary, boundaryMaterial);
  border.computeLineDistances();
  terrain.add(border);

  // Instance scrub in blocked rock footprints only; no decorative tree blocks an open route.
  const vegetation = [];
  if (green || (!coast && !abyss)) {
    const leaf = material({
      color: green ? "#4a6243" : "#6d7450",
      roughness: 1,
      flatShading: true,
    });
    const scrubGeo = new THREE.IcosahedronGeometry(1, 0),
      count = green ? 180 : 70;
    const scrub = new THREE.InstancedMesh(scrubGeo, leaf, count),
      matrix = new THREE.Matrix4(),
      rotation = new THREE.Quaternion(),
      scale = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const o = map.obstacles[i % map.obstacles.length];
      const a = random() * Math.PI * 2,
        d = o.r * (0.6 + random() * 0.28),
        size = 2 + random() * (green ? 5 : 2);
      scale.set(size, size * (green ? 1.4 : 0.65), size);
      matrix.compose(
        new THREE.Vector3(
          o.x - halfW + Math.cos(a) * d,
          level + size * 0.5,
          o.y - halfH + Math.sin(a) * d,
        ),
        rotation,
        scale,
      );
      scrub.setMatrixAt(i, matrix);
    }
    scrub.instanceMatrix.needsUpdate = true;
    scrub.castShadow = scrub.receiveShadow = true;
    terrain.add(scrub);
    vegetation.push({ mesh: scrub, count });
  }

  // A small sky environment gives metal and glass outdoor reflections.
  const sky = canvas(256, 128),
    skyCtx = sky.getContext("2d");
  const skyGradient = skyCtx.createLinearGradient(0, 0, 0, 128);
  skyGradient.addColorStop(0, abyss ? "#194656" : "#789bab");
  skyGradient.addColorStop(0.49, abyss ? "#276373" : "#d4d9cb");
  skyGradient.addColorStop(0.51, map.ground);
  skyGradient.addColorStop(1, abyss ? "#142e37" : "#4b483c");
  skyCtx.fillStyle = skyGradient;
  skyCtx.fillRect(0, 0, 256, 128);
  const skyTexture = texture(sky);
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  const generator = new THREE.PMREMGenerator(renderer),
    environment = generator.fromEquirectangular(skyTexture);
  generator.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.45;

  let water;
  const clock = { value: 0 };
  if (coast) {
    const geo = new THREE.PlaneGeometry(3000, height + 1200, 90, 60);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -3, shoreZ + (height + 1200) / 2);
    const m = material({
      color: "#316a70",
      metalness: 0.25,
      roughness: 0.3,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
    });
    m.onBeforeCompile = (s) => {
      s.uniforms.waterTime = clock;
      s.vertexShader =
        "uniform float waterTime; varying vec3 waterWorld;\n" + s.vertexShader;
      s.vertexShader = s.vertexShader
        .replace(
          "#include <beginnormal_vertex>",
          `
        vec3 objectNormal = normalize(vec3(-0.026 * cos(position.x * 0.025 + waterTime * 0.8), 1.0, -0.036 * cos(position.z * 0.04 + waterTime * 0.65)));
      `,
        )
        .replace(
          "#include <begin_vertex>",
          `
        vec3 transformed = vec3(position);
        transformed.y += sin(position.x * 0.025 + waterTime * 0.8) * 1.04 + sin(position.z * 0.04 + waterTime * 0.65) * 0.9;
        waterWorld = transformed;
      `,
        );
      s.fragmentShader =
        "uniform float waterTime; varying vec3 waterWorld;\n" +
        s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        "#include <color_fragment>",
        `
        #include <color_fragment>
        float shore = 1.0 - smoothstep(${(shoreZ + 8).toFixed(1)}, ${(shoreZ + 85).toFixed(1)}, waterWorld.z);
        float ripples = sin(waterWorld.x * 0.11 + waterWorld.z * 0.18 + waterTime) * sin(waterWorld.z * 0.23 - waterTime * 0.7);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.42, 0.39), shore * 0.65);
        diffuseColor.rgb += max(0.0, ripples - 0.72) * 0.15;
        float surf = pow(max(0.0, sin(waterWorld.z * 0.31 + sin(waterWorld.x * 0.045) * 0.4 + waterTime * 0.8)), 12.0) * shore;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.65, 0.76, 0.69), surf * 0.7);
      `,
      );
    };
    water = new THREE.Mesh(geo, m);
    water.receiveShadow = true;
    terrain.add(water);
  }
  function setQuality(value) {
    quality = value;
    scene.environment = value === "low" ? null : environment.texture;
    for (const m of materials) {
      if (!m.isMeshStandardMaterial) continue;
      m.userData.relief ??= m.bumpMap;
      const bump = value === "low" ? null : m.userData.relief;
      if (m.bumpMap !== bump) {
        m.bumpMap = bump;
        m.needsUpdate = true;
      }
    }
    for (const v of vegetation) {
      v.mesh.count = Math.floor(v.count * QUALITY[value].vegetation);
      v.mesh.visible = v.mesh.count > 0;
    }
  }
  setQuality(quality);
  return {
    setQuality,
    animate(time) {
      clock.value = time;
    },
    dispose() {
      scene.environment = null;
      environment.dispose();
      for (const t of textures) t.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
