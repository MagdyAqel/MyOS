import * as THREE from "three";
import { visionRadius } from "./unit-abilities.js";
export function createFog(scene, stage) {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 248;
  const ctx = canvas.getContext("2d"),
    texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1000, 620), material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = stage.terrain === "abyss" ? -18 : 2.5;
  plane.renderOrder = 3;
  scene.add(plane);
  let last = -1;
  return {
    draw(b) {
      plane.visible = b.fog;
      if (!b.fog || (b.time - last < 0.3 && last >= 0)) return;
      last = b.time;
      ctx.clearRect(0, 0, 400, 248);
      ctx.fillStyle = "#071321dd";
      ctx.fillRect(0, 0, 400, 248);
      ctx.fillStyle = "#27334488";
      for (const i of b.explored) {
        ctx.clearRect((i % 40) * 10, Math.floor(i / 40) * 10, 10, 10);
        ctx.fillRect((i % 40) * 10, Math.floor(i / 40) * 10, 10, 10);
      }
      ctx.globalCompositeOperation = "destination-out";
      for (const e of b.entities.filter((e) => e.team === "blue")) {
        const radius = visionRadius(e) * 0.4;
        if (!radius) continue;
        const gradient = ctx.createRadialGradient(
          e.x * 0.4,
          e.y * 0.4,
          radius * 0.8,
          e.x * 0.4,
          e.y * 0.4,
          radius,
        );
        gradient.addColorStop(0, "#000");
        gradient.addColorStop(1, "#0000");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(e.x * 0.4, e.y * 0.4, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      texture.needsUpdate = true;
    },
    dispose() {
      scene.remove(plane);
      plane.geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
