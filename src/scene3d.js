import { mapSize, mapX, mapY } from "./world.js";
import { detailModel, QUALITY, resolveQuality } from "./model-details.js";
import { buildUnitModel } from "./realistic-models.js";
import { createSurfaceLibrary } from "./surface-materials.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mapFor } from "./maps.js";
import { enhanceEnvironment } from "./environment3d.js";
import { createFog } from "./fog3d.js";

// All models are built locally from geometry; no downloaded textures or game assets.
export function createBattleScene(
  canvas,
  stage,
  map = mapFor(0),
  options = {},
) {
  if (
    map.stage !==
    ["desert", "highland", "coast", "abyss"].indexOf(stage.terrain)
  )
    map = mapFor(
      ["desert", "highland", "coast", "abyss"].indexOf(stage.terrain),
    );
  const { width, height } = mapSize(map);
  const halfW = width / 2,
    halfH = height / 2;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: options.quality !== "low",
    alpha: false,
    powerPreference: "high-performance",
  });
  const touchDevice = matchMedia("(pointer: coarse)").matches;
  let quality = resolveQuality(options.quality, touchDevice);
  renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY[quality].ratio));
  renderer.shadowMap.enabled = QUALITY[quality].shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
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
  controls.minDistance = 260;
  controls.maxDistance = Math.max(1600, width * 1.5);
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
        landscape ? 0 : mapX(map, 250) - halfW,
        0,
        !landscape && stage.terrain === "coast" ? mapY(map, 210) - halfH : 0,
      );
      camera.position
        .copy(controls.target)
        .add(
          landscape
            ? new THREE.Vector3(300, 550, 520)
            : new THREE.Vector3(280, 620, 620),
        );
    } else {
      controls.target.set(
        mapX(map, 290) - halfW,
        0,
        naval ? mapY(map, 250) - halfH : 0,
      );
      camera.position
        .copy(controls.target)
        .add(new THREE.Vector3(310, 520, 520));
    }
    controls.update();
  };
  home();
  scene.add(
    new THREE.HemisphereLight(
      underwater ? 0x6cc9ff : 0xd9f2ff,
      underwater ? 0x092838 : 0x77704e,
      1.65,
    ),
  );
  const sun = new THREE.DirectionalLight(underwater ? 0x58c4f8 : 0xffe8c4, 2.8);
  sun.position.set(-480, 680, 340);
  sun.castShadow = true;
  sun.shadow.mapSize.set(QUALITY[quality].shadow, QUALITY[quality].shadow);
  Object.assign(sun.shadow.camera, {
    left: -halfW - 150,
    right: halfW + 150,
    top: halfH + 240,
    bottom: -halfH - 240,
    far: 2600,
  });
  sun.shadow.normalBias = 0.5;
  sun.shadow.bias = -0.00015;
  scene.add(sun);
  const surfaces = createSurfaceLibrary(renderer, stage.terrain),
    models = new Map();
  surfaces.setQuality(quality);
  const material = (color, metalness, roughness) =>
    surfaces.get(color, metalness, roughness);
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
  const fogOfWar = createFog(scene, stage, map);
  const environment = enhanceEnvironment(
    scene,
    terrain,
    stage,
    map,
    renderer,
    quality,
  );
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
      light = e.team === "blue" ? "#8ebdb6" : "#d29e82";
    g.userData.entityId = e.id;
    buildUnitModel(g, e, { box, cylinder, mesh });
    g.userData.detail = detailModel(g, e, { box, cylinder, mesh });
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(e.radius * 3.3, e.radius * 3.6),
      material("contact-shadow"),
    );
    contact.rotation.x = -Math.PI / 2;
    contact.userData.overlay = true;
    g.add(contact);
    g.userData.contact = contact;
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
    hp.position.set(0, e.speed ? 40 : 77, 0);
    g.userData.healthBar = hp;
    box(hp, e.radius * 2 + 12, 3, 4, "#14242b");
    const hpFill = box(hp, e.radius * 2 + 10, 3.4, 4.5, light);
    hp.traverse((part) => {
      part.castShadow = part.receiveShadow = false;
    });
    g.add(hp);
    if (!e.speed) {
      const text = label(e.name, light);
      text.position.y = e.domain === "sub" ? 58 : 89;
      g.userData.label = text;
      g.add(text);
    }
    ring.userData.overlay = true;
    hp.userData.overlay = true;
    g.userData.ring = ring;
    g.userData.hp = hpFill;
    scene.add(g);
    models.set(e.id, g);
    return g;
  }
  const rallyFlag = new THREE.Group();
  cylinder(rallyFlag, 1.5, 45, "#afd9bc", 0, 22, 0);
  box(rallyFlag, 20, 13, 1, "#55bd85", 10, 39, 0);
  scene.add(rallyFlag);
  rallyFlag.visible = false;
  const reconArea = new THREE.Mesh(
    new THREE.RingGeometry(107, 110, 64),
    new THREE.MeshBasicMaterial({
      color: 0x81e7cd,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  );
  reconArea.rotation.x = -Math.PI / 2;
  scene.add(reconArea);
  const objectiveArea = new THREE.Mesh(
    new THREE.RingGeometry(95, 100, 64),
    new THREE.MeshBasicMaterial({
      color: 0xf2ce79,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  objectiveArea.rotation.x = -Math.PI / 2;
  objectiveArea.position.set(mapX(map, 820) - halfW, 4, mapY(map, 470) - halfH);
  scene.add(objectiveArea);
  const shellModels = [];
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
  canvas.dataset.quality = quality;
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
    const scout = battle.entities.find(
      (e) =>
        e.type === "recon" && battle.selected.has(e.id) && e.team === "blue",
    );
    reconArea.visible = Boolean(scout);
    if (scout) {
      reconArea.position.set(scout.x - halfW, 4, scout.y - halfH);
      reconArea.scale.setScalar((scout.vision || 110) / 110);
    }
    objectiveArea.visible = battle.mission.id === "recon";
    while (shellModels.length < battle.shells.length) {
      const projectile = mesh(
        new THREE.SphereGeometry(2.8, 6, 4),
        "#ffcb76",
        scene,
      );
      shellModels.push(projectile);
    }
    for (let i = 0; i < shellModels.length; i++) {
      const shell = battle.shells[i],
        model = shellModels[i];
      model.visible = Boolean(shell);
      if (shell) {
        const t = 1 - shell.remaining / shell.duration;
        model.position.set(
          shell.x + (shell.tx - shell.x) * t - halfW,
          20 + Math.sin(Math.PI * t) * 150,
          shell.y + (shell.ty - shell.y) * t - halfH,
        );
      }
    }
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
    rallyFlag.visible = Boolean(battle.rally);
    if (battle.rally)
      rallyFlag.position.set(
        battle.rally.x - halfW,
        underwater ? -12 : 0,
        battle.rally.y - halfH,
      );
    const living = new Set(battle.entities.map((e) => e.id));
    for (const [id, model] of models)
      if (!living.has(id)) {
        disposeModel(model);
        models.delete(id);
      }
    for (const e of battle.entities) {
      const g = models.get(e.id) || createModel(e);
      g.visible =
        !e.carriedBy && (battle.isVisible ? battle.isVisible(e) : true);
      const height =
        e.domain === "air"
          ? 8 + (e.flight ?? 1) * (flightHeight - 8)
          : e.type === "submarine"
            ? underwater
              ? 22 - (e.depth ?? 1) * 10
              : -(e.depth ?? 1) * 14
            : altitude(e.domain, battle.time);
      g.position.set(e.x - halfW, height, e.y - halfH);
      if (e.speed)
        g.rotation.y =
          e.heading ?? (e.team === "blue" ? Math.PI / 2 : -Math.PI / 2);
      if (e.domain === "air")
        g.position.y += Math.sin(battle.time * 2 + e.id) * 2;
      g.userData.ring.visible = battle.selected.has(e.id);
      g.userData.hp.scale.x = Math.max(0.01, e.hp / e.maxHp);
      g.userData.healthBar.visible =
        battle.selected.has(e.id) || e.hp < e.maxHp;
      if (g.userData.label)
        g.userData.label.visible =
          camera.position.distanceTo(g.position) < 1050;
      // Rings sit on the terrain even while a jet flies above it.
      g.userData.ring.position.y = (underwater ? -18 : 2) - height;
      g.userData.contact.visible = e.domain === "ground";
      g.userData.contact.position.y = (underwater ? -20.6 : 0.2) - height;
      g.userData.detail.update(e, battle.time, quality);
      if (g.userData.weaponPivot) {
        g.userData.weaponPivot.rotation.y =
          (e.aim ?? e.heading ?? g.rotation.y) - g.rotation.y;
        const recoil = g.userData.recoil;
        if (recoil)
          recoil.position.z = g.userData.recoilOrigin - (e.firing || 0) * 12;
      }
    }
    const vertices = [];
    for (const e of battle.effects)
      vertices.push(
        e.x - halfW,
        altitude(e.domain) + 15,
        e.y - halfH,
        e.tx - halfW,
        altitude(e.targetDomain) + 15,
        e.ty - halfH,
      );
    effectPositions.array.set(vertices.slice(0, 3072));
    effectPositions.needsUpdate = true;
    effectGeo.setDrawRange(0, Math.min(vertices.length, 3072) / 3);
    environment.animate(battle);
    fogOfWar.draw(battle);
    for (const entity of battle.entities) {
      const model = models.get(entity.id);
      if (entity.firing > 0 && model) {
        model.position.y -= entity.type === "tank" ? entity.firing * 9 : 0;
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
      .intersectObjects(
        [...models.values()].filter((m) => m.visible),
        true,
      )
      .filter((h) => {
        if (!h.object.isMesh) return false;
        for (let o = h.object; o; o = o.parent)
          if (o.userData.overlay || !o.visible) return false;
        return true;
      });
    if (hits.length) {
      let model = hits[0].object;
      while (model && !model.userData.entityId) model = model.parent;
      if (model) {
        const p = model.position;
        return {
          x: p.x + halfW,
          y: p.z + halfH,
          entityId: model.userData.entityId,
        };
      }
    }
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, point)) return null;
    return { x: point.x + halfW, y: point.z + halfH };
  }
  function project(x, y, domain = "ground") {
    const point = new THREE.Vector3(
      x - halfW,
      altitude(domain),
      y - halfH,
    ).project(camera);
    return {
      x: ((point.x + 1) / 2) * canvas.clientWidth,
      y: ((1 - point.y) / 2) * canvas.clientHeight,
    };
  }
  function disposeModel(model) {
    model.userData.detail?.dispose();
    scene.remove(model);
    model.traverse((o) => {
      if (!o.isSprite) o.geometry?.dispose();
      if (o.material && !surfaces.owns(o.material)) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
  }
  function dispose(releaseContext = false) {
    for (const model of models.values()) disposeModel(model);
    models.clear();
    environment.dispose();
    fogOfWar.dispose();
    controls.dispose();
    scene.traverse((o) => {
      if (!o.isSprite) o.geometry?.dispose();
    });
    surfaces.dispose();
    effectMat.dispose();
    reconArea.material.dispose();
    objectiveArea.material.dispose();
    renderer.dispose();
    if (releaseContext) renderer.forceContextLoss();
  }
  return {
    statistics() {
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        ...renderer.info.memory,
      };
    },
    setQuality(value) {
      quality = resolveQuality(value, touchDevice);
      const preset = QUALITY[quality];
      renderer.setPixelRatio(Math.min(devicePixelRatio, preset.ratio));
      renderer.shadowMap.enabled = preset.shadows;
      sun.shadow.mapSize.set(preset.shadow, preset.shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      lastWidth = 0;
      canvas.dataset.quality = quality;
      environment.setQuality(quality);
      surfaces.setQuality(quality);
    },
    draw,
    effects: environment.events,
    focusPoint(x, y) {
      const offset = camera.position.clone().sub(controls.target);
      controls.target.set(
        Math.max(20 - halfW, Math.min(halfW - 20, x - halfW)),
        0,
        Math.max(20 - halfH, Math.min(halfH - 20, y - halfH)),
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
      const x = Math.max(
          -halfW - 50,
          Math.min(halfW + 50, controls.target.x + delta.x),
        ),
        z = Math.max(
          -halfH - 20,
          Math.min(halfH + 20, controls.target.z + delta.z),
        );
      delta.set(x - controls.target.x, 0, z - controls.target.z);
      camera.position.add(delta);
      controls.target.add(delta);
      controls.update();
    },
    cameraTarget() {
      return { x: controls.target.x + halfW, y: controls.target.z + halfH };
    },
    pick,
    project,
    home,
    dispose,
    focus(units) {
      if (!units.length) return;
      const x = units.reduce((sum, e) => sum + e.x, 0) / units.length - halfW,
        z = units.reduce((sum, e) => sum + e.y, 0) / units.length - halfH;
      const offset = camera.position
        .clone()
        .sub(controls.target)
        .normalize()
        .multiplyScalar(440);
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
