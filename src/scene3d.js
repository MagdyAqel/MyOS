import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mapFor } from "./maps.js";
import { enhanceEnvironment } from "./environment3d.js";

// All models are built locally from geometry; no downloaded textures or game assets.
export function createBattleScene(canvas, stage, map = mapFor(0)) {
  if (
    map.stage !==
    ["desert", "highland", "coast", "abyss"].indexOf(stage.terrain)
  )
    map = mapFor(
      ["desert", "highland", "coast", "abyss"].indexOf(stage.terrain),
    );
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  const touchDevice = matchMedia("(pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, touchDevice ? 1.15 : 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  const underwater = stage.terrain === "abyss",
    naval = stage.terrain === "coast";
  scene.background = new THREE.Color(map.sky);
  scene.fog = new THREE.Fog(
    scene.background,
    map.mist ? 850 : 1500,
    map.mist ? 2200 : 2900,
  );
  const camera = new THREE.PerspectiveCamera(42, 1, 2, 4000);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 520;
  controls.maxDistance = 1900;
  controls.maxPolarAngle = Math.PI / 2.7;
  controls.minPolarAngle = 0.2;
  controls.mouseButtons = {
    LEFT: null,
    MIDDLE: THREE.MOUSE.ROTATE,
    RIGHT: null,
  };
  controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  const home = () => {
    if (touchDevice) {
      const landscape =
        canvas.clientWidth / Math.max(1, canvas.clientHeight) > 1.7;
      controls.target.set(
        landscape ? 0 : -250,
        0,
        !landscape && stage.terrain === "coast" ? -100 : 0,
      );
      camera.position
        .copy(controls.target)
        .add(
          landscape
            ? new THREE.Vector3(300, 550, 520)
            : new THREE.Vector3(280, 620, 620),
        );
    } else {
      camera.position.set(470, 860, 870);
      controls.target.set(0, 0, 0);
    }
    controls.update();
  };
  home();
  scene.add(
    new THREE.HemisphereLight(
      underwater ? 0x6cc9ff : 0xd9f2ff,
      underwater ? 0x092838 : 0x77704e,
      2.1,
    ),
  );
  const sun = new THREE.DirectionalLight(underwater ? 0x58c4f8 : 0xfff0ca, 3);
  sun.position.set(-350, 750, 200);
  sun.castShadow = true;
  sun.shadow.mapSize.set(touchDevice ? 512 : 1024, touchDevice ? 512 : 1024);
  Object.assign(sun.shadow.camera, {
    left: -650,
    right: 650,
    top: 550,
    bottom: -550,
    far: 1600,
  });
  sun.shadow.normalBias = 1.5;
  scene.add(sun);
  const materials = new Map(),
    models = new Map();
  const material = (color, metalness = 0.15, roughness = 0.65) => {
    const key = color + ":" + metalness + ":" + roughness;
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({ color, metalness, roughness }),
      );
    return materials.get(key);
  };
  function mesh(geometry, color, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, material(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (parent, w, h, d, color, x = 0, y = h / 2, z = 0) =>
    mesh(new THREE.BoxGeometry(w, h, d), color, parent, x, y, z);
  const cylinder = (parent, r, h, color, x = 0, y = h / 2, z = 0) =>
    mesh(new THREE.CylinderGeometry(r, r, h, 16), color, parent, x, y, z);
  const terrain = new THREE.Group();
  scene.add(terrain);
  if (underwater) {
    box(terrain, 1080, 14, 700, "#234858", 0, -28, 0);
  } else if (naval) {
    box(terrain, 1060, 12, 720, "#216d88", 0, -16, 0);
    box(terrain, 1060, 18, 260, "#c6b489", 0, -8, -220);
    box(terrain, 1060, 5, 25, "#e0cca0", 0, -1, -70);
  } else {
    box(
      terrain,
      1060,
      14,
      680,
      stage.terrain === "highland" ? "#78835d" : "#bd9d6b",
      0,
      -10,
      0,
    );
    box(
      terrain,
      1040,
      1,
      72,
      stage.terrain === "highland" ? "#777b71" : "#ceb78d",
      0,
      -1,
      0,
    );
  }
  // Low-poly rocks, shoreline details and seabed formations.
  for (let i = 0; i < 24; i++) {
    const x = ((i * 173) % 980) - 490,
      z = ((i * 137) % 600) - 300;
    if (Math.abs(x) > 330 || Math.abs(z) < 90) continue;
    const color = underwater
      ? "#426571"
      : stage.terrain === "highland"
        ? "#6b735b"
        : "#978765";
    const rock = mesh(
      new THREE.DodecahedronGeometry(9 + (i % 4) * 4, 0),
      color,
      terrain,
      x,
      underwater ? -12 : 3,
      z,
    );
    rock.scale.y = 0.65;
    if (stage.terrain === "highland") {
      cylinder(terrain, 3, 15, "#594c38", x + 20, 7, z);
      mesh(
        new THREE.ConeGeometry(14, 40, 6),
        "#415e48",
        terrain,
        x + 20,
        35,
        z,
      );
    }
  }
  let water;
  if (naval || underwater) {
    const positions = [];
    for (let i = 0; i < 38; i++) {
      const z = naval ? -25 + i * 10 : -300 + i * 16;
      positions.push(-510, naval ? 1 : -17, z, 510, naval ? 1 : -17, z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    water = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: underwater ? 0x3e91a2 : 0x74c6d6,
        transparent: true,
        opacity: 0.3,
      }),
    );
    terrain.add(water);
  }
  const grid = new THREE.GridHelper(
    1000,
    20,
    underwater ? 0x77b6bf : 0x555c4b,
    underwater ? 0x3b6571 : 0x9e9577,
  );
  grid.scale.z = 0.62;
  grid.position.y = underwater ? -18 : 0.1;
  grid.material.transparent = true;
  grid.material.opacity = 0.13;
  scene.add(grid);
  grid.visible = false;
  if (water) water.visible = false;
  const environment = enhanceEnvironment(scene, terrain, stage, map);
  function label(text, color) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 48;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#071828d9";
    ctx.beginPath();
    ctx.roundRect(0, 0, 256, 48, 10);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = "22px Tahoma";
    ctx.textAlign = "center";
    ctx.direction = "rtl";
    ctx.fillText(text, 128, 32);
    const texture = new THREE.CanvasTexture(c),
      sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, depthTest: false }),
      );
    sprite.scale.set(106, 20, 1);
    return sprite;
  }
  function createModel(e) {
    const g = new THREE.Group(),
      color = e.team === "blue" ? "#3b91ba" : "#bf554a",
      light = e.team === "blue" ? "#93deed" : "#ffc89f",
      dark = "#263640";
    g.userData.entityId = e.id;
    if (e.type === "fighter" || e.type === "bomber") {
      const big = e.type === "bomber";
      const fuselage = mesh(
        new THREE.ConeGeometry(big ? 7 : 5, big ? 48 : 42, 10),
        color,
        g,
        0,
        1,
        0,
      );
      fuselage.rotation.x = Math.PI / 2;
      box(g, big ? 65 : 49, 2, 12, color, 0, 0, 2);
      box(g, 22, 2, 8, light, 0, 2, -15);
      box(g, 2, 12, 10, color, 0, 6, -15);
      const cockpit = mesh(
        new THREE.SphereGeometry(5, 12, 8),
        "#b5e5ef",
        g,
        0,
        5,
        6,
      );
      cockpit.scale.set(0.7, 0.7, 1.7);
      cylinder(g, 3, 12, "#394752", -8, -1, -13).rotation.x = Math.PI / 2;
      cylinder(g, 3, 12, "#394752", 8, -1, -13).rotation.x = Math.PI / 2;
    } else if (e.type === "destroyer" || e.type === "submarine") {
      const hull = mesh(
        new THREE.SphereGeometry(1, 18, 12),
        e.type === "submarine" ? "#344a57" : color,
        g,
      );
      hull.scale.set(
        e.type === "submarine" ? 11 : 14,
        e.type === "submarine" ? 9 : 8,
        e.type === "submarine" ? 35 : 43,
      );
      if (e.type === "submarine") {
        box(g, 8, 11, 15, color, 0, 10, 0);
        cylinder(g, 1, 12, light, 0, 20, 0);
      } else {
        box(g, 18, 12, 30, "#c1c9c8", 0, 10, -5);
        box(g, 12, 10, 16, color, 0, 20, -9);
        cylinder(g, 1.5, 24, dark, 0, 35, -9);
        cylinder(g, 7, 5, dark, 0, 8, 22);
        box(g, 3, 3, 22, light, 0, 12, 31);
      }
    } else if (e.type === "tank") {
      box(g, 30, 10, 38, color, 0, 8, 0);
      box(g, 8, 12, 42, dark, -19, 6, 0);
      box(g, 8, 12, 42, dark, 19, 6, 0);
      for (let i = -1; i <= 1; i++) {
        cylinder(g, 4, 6, "#637780", -19, 6, i * 12).rotation.z = Math.PI / 2;
        cylinder(g, 4, 6, "#637780", 19, 6, i * 12).rotation.z = Math.PI / 2;
      }
      box(g, 20, 9, 21, color, 0, 17, -2);
      box(g, 4, 4, 32, light, 0, 19, 20);
    } else if (e.type === "soldier") {
      cylinder(g, 5, 12, color, 0, 12, 0);
      mesh(new THREE.SphereGeometry(4, 8, 8), "#d0b18a", g, 0, 22, 0);
      cylinder(g, 4.5, 4, dark, 0, 25, 0);
      box(g, 3, 9, 3, dark, -3, 3, 0);
      box(g, 3, 9, 3, dark, 3, 3, 0);
      box(g, 3, 3, 15, "#33434a", 5, 14, 5);
    } else if (e.domain === "sub") {
      cylinder(g, e.radius, 18, color, 0, 0, 0);
      mesh(
        new THREE.SphereGeometry(e.radius * 0.65, 20, 12),
        "#6fc1cd",
        g,
        0,
        12,
        0,
      );
      box(g, 8, 24, 8, dark, e.radius - 8, 16, 0);
    } else {
      if (underwater)
        box(g, e.radius * 2 + 18, 8, e.radius * 2 + 18, "#667f85", 0, 0, 0);
      const r = e.radius;
      box(g, r * 2, 7, r * 1.7, "#69767b", 0, 3, 0);
      if (e.type === "turret") {
        cylinder(g, 15, 15, color, 0, 14, 0);
        box(g, 6, 6, 36, dark, 0, 23, 10);
      } else if (e.type === "airfield") {
        box(g, 55, 2, 82, "#3a454a", 0, 8, 0);
        for (let i = -2; i <= 2; i++) box(g, 3, 1, 8, "#eee8c9", 0, 10, i * 14);
        box(g, 23, 20, 27, color, -26, 16, -20);
        box(g, 13, 13, 15, "#8cbdd1", -26, 32, -20);
      } else if (e.type === "harbor") {
        box(g, 58, 12, 38, color, 0, 10, -15);
        box(g, 70, 6, 15, "#9b8b6c", 0, 2, 23);
        box(g, 7, 45, 7, "#d8b565", 24, 28, -8);
        box(g, 30, 5, 5, "#d8b565", 14, 49, -8);
      } else if (e.type === "power") {
        box(g, 38, 20, 32, color, 0, 17, 0);
        cylinder(g, 9, 35, "#a8b6bb", -12, 34, 0);
        cylinder(g, 9, 35, "#a8b6bb", 12, 34, 0);
        box(g, 22, 5, 20, light, 0, 28, 18);
      } else {
        box(g, r * 1.7, 28, r * 1.35, color, 0, 19, 0);
        box(g, r * 1.8, 5, r * 1.5, dark, 0, 35, 0);
        for (let i = -1; i <= 1; i++)
          box(g, 8, 8, 2, light, i * 15, 22, r * 0.68 + 1);
        if (e.type === "hq") {
          cylinder(g, 1.5, 35, "#eee1be", -20, 51, -10);
          box(g, 18, 11, 1, light, -12, 63, -10);
        }
        if (e.type === "factory") {
          cylinder(g, 6, 35, dark, -18, 38, -15);
          cylinder(g, 6, 35, dark, 18, 38, -15);
        }
        if (e.type === "supply") {
          for (let i = -1; i <= 1; i++)
            box(g, 12, 12, 12, "#c4b183", i * 14, 11, 30);
        }
      }
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(e.radius + 8, e.radius + 11, 40),
      new THREE.MeshBasicMaterial({
        color: 0x8cffe8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1;
    ring.visible = false;
    g.add(ring);
    const hp = new THREE.Group();
    hp.position.set(0, e.speed ? 46 : 83, 0);
    box(hp, e.radius * 2 + 12, 3, 4, "#14242b");
    const hpFill = box(hp, e.radius * 2 + 10, 3.4, 4.5, light);
    g.add(hp);
    if (!e.speed) {
      const text = label(e.name, light);
      text.position.y = e.domain === "sub" ? 60 : 102;
      g.add(text);
    }
    g.userData.ring = ring;
    g.userData.hp = hpFill;
    scene.add(g);
    models.set(e.id, g);
    return g;
  }
  const effectGeo = new THREE.BufferGeometry();
  const effectPositions = new THREE.Float32BufferAttribute(
    new Float32Array(3072),
    3,
  ).setUsage(THREE.DynamicDrawUsage);
  effectGeo.setAttribute("position", effectPositions);
  effectGeo.setDrawRange(0, 0);
  const effectMat = new THREE.LineBasicMaterial({ color: 0xffe4a1 });
  const lines = new THREE.LineSegments(effectGeo, effectMat);
  lines.frustumCulled = false;
  scene.add(lines);
  let lastOrientation = null;
  let lastWidth = 0,
    lastHeight = 0;
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    raycaster = new THREE.Raycaster(),
    mouse = new THREE.Vector2();
  const flightHeight = Math.max(110, ...map.obstacles.map((o) => o.h + 55));
  function altitude(domain, time) {
    return domain === "air"
      ? flightHeight
      : domain === "sub"
        ? underwater
          ? 12
          : -10
        : domain === "sea"
          ? 3
          : 0;
  }
  function draw(battle) {
    const w = Math.max(1, canvas.clientWidth),
      h = Math.max(1, canvas.clientHeight);
    if (w !== lastWidth || h !== lastHeight) {
      lastWidth = w;
      lastHeight = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const orientation = w / h > 1.7;
      if (touchDevice && orientation !== lastOrientation) {
        lastOrientation = orientation;
        home();
      }
    }
    const living = new Set(battle.entities.map((e) => e.id));
    for (const [id, model] of models)
      if (!living.has(id)) {
        disposeModel(model);
        models.delete(id);
      }
    for (const e of battle.entities) {
      const g = models.get(e.id) || createModel(e);
      g.position.set(e.x - 500, altitude(e.domain, battle.time), e.y - 310);
      if (e.speed)
        g.rotation.y =
          e.heading ?? (e.team === "blue" ? Math.PI / 2 : -Math.PI / 2);
      if (e.domain === "air")
        g.position.y += Math.sin(battle.time * 2 + e.id) * 2;
      g.userData.ring.visible = battle.selected.has(e.id);
      g.userData.hp.scale.x = Math.max(0.01, e.hp / e.maxHp);
    }
    const vertices = [];
    for (const e of battle.effects)
      vertices.push(
        e.x - 500,
        altitude(e.domain) + 15,
        e.y - 310,
        e.tx - 500,
        altitude(e.targetDomain) + 15,
        e.ty - 310,
      );
    effectPositions.array.set(vertices.slice(0, 3072));
    effectPositions.needsUpdate = true;
    effectGeo.setDrawRange(0, Math.min(vertices.length, 3072) / 3);
    if (water)
      water.material.opacity = 0.2 + Math.sin(battle.time * 1.5) * 0.06;
    environment.animate(battle);
    for (const entity of battle.entities) {
      const model = models.get(entity.id);
      if (entity.firing > 0 && model) {
        model.position.y -= entity.type === "tank" ? entity.firing * 9 : 0;
        if (entity.type === "turret") model.rotation.y = entity.aim || 0;
      }
      if (entity.domain === "sea" && model)
        model.rotation.z = Math.sin(battle.time * 1.7 + entity.id) * 0.025;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster
      .intersectObjects([...models.values()], true)
      .filter((h) => h.object.type === "Mesh");
    if (hits.length) {
      let model = hits[0].object;
      while (model && !model.userData.entityId) model = model.parent;
      if (model) {
        const p = model.position;
        return {
          x: p.x + 500,
          y: p.z + 310,
          entityId: model.userData.entityId,
        };
      }
    }
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, point)) return null;
    return { x: point.x + 500, y: point.z + 310 };
  }
  function project(x, y, domain = "ground") {
    const point = new THREE.Vector3(x - 500, altitude(domain), y - 310).project(
      camera,
    );
    return {
      x: ((point.x + 1) / 2) * canvas.clientWidth,
      y: ((1 - point.y) / 2) * canvas.clientHeight,
    };
  }
  function disposeModel(model) {
    scene.remove(model);
    model.traverse((o) => {
      if (!o.isSprite) o.geometry?.dispose();
      if (o.material?.map) {
        o.material.map.dispose();
        o.material.dispose();
      } else if (o.material && ![...materials.values()].includes(o.material))
        o.material.dispose();
    });
  }
  function dispose(releaseContext = false) {
    environment.dispose();
    controls.dispose();
    scene.traverse((o) => {
      if (!o.isSprite) o.geometry?.dispose();
      if (o.material?.map) o.material.map.dispose();
    });
    for (const m of materials.values()) m.dispose();
    effectMat.dispose();
    grid.material.dispose();
    water?.material.dispose();
    for (const model of models.values())
      model.traverse((o) => {
        if (o.material?.isSpriteMaterial || o.geometry?.type === "RingGeometry")
          o.material.dispose();
      });
    renderer.dispose();
    if (releaseContext) renderer.forceContextLoss();
    models.clear();
  }
  return {
    draw,
    effects: environment.events,
    focusPoint(x, y) {
      const offset = camera.position.clone().sub(controls.target);
      controls.target.set(
        Math.max(-480, Math.min(480, x - 500)),
        0,
        Math.max(-290, Math.min(290, y - 310)),
      );
      camera.position.copy(controls.target).add(offset);
      controls.update();
    },
    panPixels(dx, dy) {
      const scale =
        (camera.position.distanceTo(controls.target) *
          Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
          2) /
        Math.max(1, canvas.clientHeight);
      const right = new THREE.Vector3().setFromMatrixColumn(
        camera.matrixWorld,
        0,
      );
      right.y = 0;
      right.normalize();
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      up.y = 0;
      up.normalize();
      const delta = right
        .multiplyScalar(-dx * scale)
        .add(up.multiplyScalar(dy * scale));
      const x = Math.max(-550, Math.min(550, controls.target.x + delta.x)),
        z = Math.max(-330, Math.min(330, controls.target.z + delta.z));
      delta.set(x - controls.target.x, 0, z - controls.target.z);
      camera.position.add(delta);
      controls.target.add(delta);
      controls.update();
    },
    cameraTarget() {
      return { x: controls.target.x + 500, y: controls.target.z + 310 };
    },
    pick,
    project,
    home,
    dispose,
    focus(units) {
      if (!units.length) return;
      const x = units.reduce((sum, e) => sum + e.x, 0) / units.length - 500,
        z = units.reduce((sum, e) => sum + e.y, 0) / units.length - 310;
      const offset = camera.position
        .clone()
        .sub(controls.target)
        .normalize()
        .multiplyScalar(600);
      controls.target.set(x, 0, z);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    },
    zoom(factor) {
      camera.position
        .sub(controls.target)
        .multiplyScalar(factor)
        .add(controls.target);
      controls.update();
    },
    rotate(angle) {
      camera.position
        .sub(controls.target)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
        .add(controls.target);
      controls.update();
    },
  };
}
