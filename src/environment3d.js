import * as THREE from "three";
import { seededRandom } from "./maps.js";
export function enhanceEnvironment(scene, terrain, stage, map) {
  const random = seededRandom(map.seed),
    textures = [],
    extras = [];
  const makeTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = map.ground;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 42000; i++) {
      const v = random() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgba(${v},${v},${v},${random() * 0.1})`;
      ctx.fillRect(
        random() * 512,
        random() * 512,
        random() * 3 + 1,
        random() * 2 + 1,
      );
    }
    for (let i = 0; i < 200; i++) {
      ctx.strokeStyle = "#312d2410";
      ctx.beginPath();
      const x = random() * 512,
        y = random() * 512;
      ctx.ellipse(x, y, random() * 12 + 2, random() * 5 + 1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 2);
    textures.push(texture);
    return texture;
  };
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, stage.terrain === "coast" ? 240 : 620),
    new THREE.MeshStandardMaterial({ map: makeTexture(), roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(
    0,
    stage.terrain === "abyss" ? -20.8 : stage.terrain === "coast" ? 1.2 : -2.5,
    stage.terrain === "coast" ? -190 : 0,
  );
  floor.receiveShadow = true;
  terrain.add(floor);
  extras.push(floor.material);
  for (const obstacle of map.obstacles) {
    const group = new THREE.Group();
    group.position.set(
      obstacle.x - 500,
      stage.terrain === "abyss" ? -20 : 0,
      obstacle.y - 310,
    );
    const stone = new THREE.MeshStandardMaterial({
      color:
        stage.terrain === "coast"
          ? "#9b9a75"
          : stage.terrain === "abyss"
            ? "#496d71"
            : "#81715b",
      roughness: 0.95,
    });
    extras.push(stone);
    for (let i = 0; i < 6; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(obstacle.r * (0.4 + random() * 0.2), 1),
        stone,
      );
      const angle = (i / 6) * Math.PI * 2;
      rock.position.set(
        Math.cos(angle) * obstacle.r * 0.48,
        obstacle.h * 0.2 + random() * obstacle.h * 0.15,
        Math.sin(angle) * obstacle.r * 0.48,
      );
      rock.scale.set(1, (obstacle.h / obstacle.r) * (0.8 + random() * 0.5), 1);
      rock.rotation.y = random() * Math.PI;
      rock.castShadow = rock.receiveShadow = true;
      group.add(rock);
    }
    terrain.add(group);
  }
  let sea;
  if (stage.terrain === "coast") {
    const geometry = new THREE.PlaneGeometry(1000, 360, 60, 24);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, 130);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: "#348fa7",
      roughness: 0.28,
      metalness: 0.5,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    sea = new THREE.Mesh(geometry, waterMaterial);
    sea.position.y = -2;
    sea.receiveShadow = true;
    terrain.add(sea);
    extras.push(waterMaterial);
  }
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
    if (particles.length >= 70) return;
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
            e.x - 500,
            stage.terrain === "abyss" ? -17 : 3,
            e.y - 310,
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
          e.x - 500,
          level(e.domain),
          e.y - 310,
          "#ffae45",
          e.size * 2.7,
          0.6,
          "flash",
        );
        for (let i = 0; i < 5; i++)
          spawn(
            e.x - 500 + (random() - 0.5) * 15,
            level(e.domain),
            e.y - 310 + (random() - 0.5) * 15,
            "#494846",
            e.size * 1.8,
            2.5,
          );
      } else if (e.kind === "shot") {
        const start = { x: e.x - 500, y: level(e.domain), z: e.y - 310 };
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
            { x: e.tx - 500, y: level(e.targetDomain), z: e.ty - 310 },
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
              e.x - (w.mesh.position.x + 500),
              e.y - (w.mesh.position.z + 310),
            ) < 200,
        );
      if (w.life <= 0) {
        scene.remove(w.mesh);
        wrecks.splice(i, 1);
      }
    }
    if (sea) {
      const p = sea.geometry.attributes.position;
      for (let i = 0; i < p.count; i++)
        p.setY(
          i,
          Math.sin(p.getX(i) * 0.027 + battle.time * 0.9) * 1.2 +
            Math.cos(p.getZ(i) * 0.04 + battle.time * 0.7) * 0.8,
        );
      p.needsUpdate = true;
    }
    if (battle.time - lastTrail > 0.28) {
      lastTrail = battle.time;
      for (const e of battle.entities) {
        if (!e.speed || (!e.order && e.team === "blue")) continue;
        if (e.domain === "air")
          spawn(e.x - 500, flightHeight - 1, e.y - 310, "#e0e3df", 8, 1.5);
        else if (e.domain === "sea")
          spawn(e.x - 500, 0, e.y - 310, "#c9f1ec", 12, 1.3);
        else if (e.type === "tank")
          spawn(e.x - 500, 4, e.y - 310, "#b39d80", 9, 0.9);
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
    dispose() {
      for (const wreck of wrecks) scene.remove(wreck.mesh);
      wreckGeometry.dispose();
      wreckMaterial.dispose();
      for (const p of particles) {
        scene.remove(p.sprite);
        p.sprite.material.dispose();
      }
      particles.length = 0;
      for (const material of extras) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
