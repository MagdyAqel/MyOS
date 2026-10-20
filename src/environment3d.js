import { mapSize, mapX, mapY } from "./world.js";
import * as THREE from "three";
import { seededRandom } from "./maps.js";
import { createTerrain } from "./terrain3d.js";
import { QUALITY } from "./model-details.js";
import { visionRadius } from "./unit-abilities.js";
export function enhanceEnvironment(
  scene,
  terrain,
  stage,
  map,
  renderer,
  quality,
) {
  const { width, height } = mapSize(map);
  const halfW = width / 2,
    halfH = height / 2;
  const landscape = createTerrain(
    scene,
    terrain,
    stage,
    map,
    renderer,
    quality,
  );
  const random = seededRandom(map.seed),
    textures = [];
  const particles = [],
    wrecks = [];
  const wreckGeometry = new THREE.BoxGeometry(1, 1, 1),
    wreckMaterial = new THREE.MeshStandardMaterial({
      color: "#343434",
      roughness: 1,
    });
  const smokeCanvas = document.createElement("canvas");
  smokeCanvas.width = smokeCanvas.height = 64;
  const ctx = smokeCanvas.getContext("2d"),
    gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(0.35, "#ffffffbb");
  gradient.addColorStop(1, "#ffffff00");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const smokeTexture = new THREE.CanvasTexture(smokeCanvas);
  textures.push(smokeTexture);
  const flightHeight = Math.max(110, ...map.obstacles.map((o) => o.h + 55));
  const level = (domain) =>
    domain === "air"
      ? flightHeight
      : domain === "sub"
        ? stage.terrain === "abyss"
          ? 15
          : -8
        : 12;
  const spawn = (x, y, z, color, size, life, kind = "smoke", end = null) => {
    if (particles.length >= QUALITY[quality].particles) return;
    const material = new THREE.SpriteMaterial({
      map: smokeTexture,
      color,
      transparent: true,
      depthWrite: false,
      blending:
        kind === "flash" ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(size);
    scene.add(sprite);
    particles.push({ sprite, x, y, z, size, life, max: life, kind, end });
  };
  function events(events) {
    for (const e of events) {
      if (e.kind === "explosion") {
        if (
          e.type &&
          e.domain !== "air" &&
          e.domain !== "sub" &&
          !["soldier", "survivor", "engineer"].includes(e.type)
        ) {
          const wreck = new THREE.Mesh(wreckGeometry, wreckMaterial);
          wreck.position.set(
            e.x - halfW,
            stage.terrain === "abyss" ? -17 : 3,
            e.y - halfH,
          );
          wreck.scale.set(
            e.size * 1.6,
            Math.max(4, e.size * 0.3),
            e.size * 1.4,
          );
          wreck.rotation.set(0.08, e.heading || 0, 0.12);
          scene.add(wreck);
          wrecks.push({ mesh: wreck, life: 35 });
          if (wrecks.length > 24) scene.remove(wrecks.shift().mesh);
        }
        spawn(
          e.x - halfW,
          level(e.domain),
          e.y - halfH,
          "#ffae45",
          e.size * 2.7,
          0.6,
          "flash",
        );
        for (let i = 0; i < 5; i++)
          spawn(
            e.x - halfW + (random() - 0.5) * 15,
            level(e.domain),
            e.y - halfH + (random() - 0.5) * 15,
            "#494846",
            e.size * 1.8,
            2.5,
          );
      } else if (e.kind === "shot") {
        const start = { x: e.x - halfW, y: level(e.domain), z: e.y - halfH };
        spawn(
          start.x,
          start.y,
          start.z,
          "#ffe1a1",
          e.type === "soldier" ? 6 : 14,
          0.12,
          "flash",
        );
        if (e.type !== "artillery")
          spawn(
            start.x,
            start.y,
            start.z,
            e.type === "submarine" ? "#b4f0ff" : "#ffc66c",
            e.type === "soldier" ? 3 : 7,
            0.35,
            "projectile",
            { x: e.tx - halfW, y: level(e.targetDomain), z: e.ty - halfH },
          );
      }
    }
  }
  let last = 0,
    lastTrail = 0;
  function animate(battle) {
    const dt = Math.min(0.1, Math.max(0, battle.time - last));
    last = battle.time;
    for (let i = wrecks.length - 1; i >= 0; i--) {
      const w = wrecks[i];
      w.life -= dt;
      w.mesh.visible =
        !battle.fog ||
        battle.entities.some(
          (e) =>
            e.team === "blue" &&
            !e.carriedBy &&
            Math.hypot(
              e.x - (w.mesh.position.x + halfW),
              e.y - (w.mesh.position.z + halfH),
            ) < visionRadius(e),
        );
      if (w.life <= 0) {
        scene.remove(w.mesh);
        wrecks.splice(i, 1);
      }
    }
    landscape.animate(battle.time);
    if (battle.time - lastTrail > 0.28) {
      lastTrail = battle.time;
      for (const e of battle.entities) {
        if (e.carriedBy || (battle.isVisible && !battle.isVisible(e))) continue;
        if (!e.speed || (!e.order && e.team === "blue")) continue;
        if (e.domain === "air")
          spawn(e.x - halfW, flightHeight - 1, e.y - halfH, "#e0e3df", 8, 1.5);
        else if (e.domain === "sea")
          spawn(e.x - halfW, 0, e.y - halfH, "#c9f1ec", 12, 1.3);
        else if (e.type === "tank")
          spawn(e.x - halfW, 4, e.y - halfH, "#b39d80", 9, 0.9);
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      const progress = 1 - p.life / p.max;
      if (p.kind === "projectile")
        p.sprite.position.set(
          p.x + (p.end.x - p.x) * progress,
          p.y + (p.end.y - p.y) * progress,
          p.z + (p.end.z - p.z) * progress,
        );
      else if (p.kind === "smoke") {
        p.sprite.position.y += dt * 12;
        p.sprite.scale.setScalar(p.size * (1 + progress));
      } else p.sprite.scale.setScalar(p.size * (1 + progress * 0.8));
      p.sprite.material.opacity = Math.max(0, 1 - progress);
      if (p.life <= 0) {
        scene.remove(p.sprite);
        p.sprite.material.dispose();
        particles.splice(i, 1);
      }
    }
  }
  return {
    events,
    animate,
    setQuality(value) {
      quality = value;
      landscape.setQuality(value);
    },
    dispose() {
      for (const wreck of wrecks) scene.remove(wreck.mesh);
      wreckGeometry.dispose();
      wreckMaterial.dispose();
      for (const p of particles) {
        scene.remove(p.sprite);
        p.sprite.material.dispose();
      }
      particles.length = 0;
      landscape.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
