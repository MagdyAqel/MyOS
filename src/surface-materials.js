import * as THREE from "three";
import { seededRandom } from "./maps.js";

// Small, repeatable local textures keep the entire renderer available offline.
export function createSurfaceLibrary(renderer, terrain) {
  const materials = new Map(),
    textures = new Set();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  function texture(kind, colors, seed = 23) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d"),
      random = seededRandom(seed);
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, 256, 256);
    if (kind === "camo") {
      for (let i = 0; i < 28; i++) {
        ctx.fillStyle = colors[1 + (i % (colors.length - 1))];
        const x = random() * 256,
          y = random() * 256;
        const w = 15 + random() * 50,
          h = 8 + random() * 28;
        // Wrap the paint at tile edges, so a hull never has a visible seam.
        for (const dx of [-256, 0, 256])
          for (const dy of [-256, 0, 256]) {
            ctx.beginPath();
            ctx.ellipse(x + dx, y + dy, w, h, i * 0.73, 0, Math.PI * 2);
            ctx.fill();
          }
      }
    }
    const data = ctx.getImageData(0, 0, 256, 256);
    for (let i = 0; i < data.data.length; i += 4) {
      const noise = (random() - 0.5) * (kind === "concrete" ? 32 : 17);
      for (let k = 0; k < 3; k++) data.data[i + k] += noise;
    }
    ctx.putImageData(data, 0, 0);
    if (kind === "steel" || kind === "camo") {
      ctx.strokeStyle = "#161b1c35";
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 252, 252);
      ctx.strokeStyle = "#d4d7c22a";
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 60; i++) {
        const x = random() * 256,
          y = random() * 256;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 2 + random() * 12, y + random() * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "#252b29b0";
      for (const x of [8, 248])
        for (const y of [8, 248]) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = anisotropy;
    textures.add(t);
    return t;
  }
  const sand = terrain === "desert" || terrain === "coast";
  const armor = {
    blue: sand
      ? ["#a19a77", "#73745c", "#bcb08c"]
      : ["#63725b", "#424e43", "#899176"],
    red: sand
      ? ["#a38b6d", "#6e6655", "#b6a486"]
      : ["#7c7560", "#4d5548", "#9b987d"],
    neutral: ["#9b937b", "#777562", "#b6a786"],
  };
  function add(key, config) {
    materials.set(key, new THREE.MeshStandardMaterial(config));
  }
  for (const team of ["blue", "red", "neutral"]) {
    const map = texture("camo", armor[team], team === "red" ? 41 : 23);
    add(`armor-${team}`, {
      map,
      roughness: 0.84,
      metalness: 0.24,
      bumpMap: map,
      bumpScale: 0.13,
    });
    add(`team-${team}`, {
      color: { blue: "#4f9cb2", red: "#b35942", neutral: "#bfa773" }[team],
      roughness: 0.65,
      metalness: 0.25,
    });
    add(`air-${team}`, {
      map: texture("steel", [team === "red" ? "#858477" : "#849394"]),
      roughness: 0.62,
      metalness: 0.38,
    });
    add(`navy-${team}`, {
      map: texture("steel", [team === "red" ? "#85877e" : "#8a9c9e"]),
      roughness: 0.73,
      metalness: 0.32,
    });
  }
  const concrete = texture("concrete", ["#8e9285"]);
  add("concrete", {
    map: concrete,
    bumpMap: concrete,
    bumpScale: 0.35,
    roughness: 0.96,
  });
  const steel = texture("steel", ["#535c5a"]);
  add("steel", {
    map: steel,
    roughness: 0.48,
    metalness: 0.72,
    bumpMap: steel,
    bumpScale: 0.08,
  });
  add("rubber", { color: "#252a29", roughness: 0.98 });
  add("tread", { color: "#3c4038", roughness: 0.9, metalness: 0.4 });
  add("glass", {
    color: "#264751",
    roughness: 0.17,
    metalness: 0.65,
    envMapIntensity: 1.2,
  });
  add("deck", { color: "#505957", roughness: 0.98, metalness: 0.15 });
  add("sub-hull", {
    map: texture("steel", ["#374947"]),
    roughness: 0.65,
    metalness: 0.45,
  });
  add("lamp", {
    color: "#e2cf97",
    emissive: "#d8af57",
    emissiveIntensity: 0.7,
    roughness: 0.3,
  });
  add("red-lamp", {
    color: "#a83f27",
    emissive: "#c43820",
    emissiveIntensity: 0.6,
  });
  add("canvas", { map: texture("concrete", ["#777862"]), roughness: 1 });
  add("exhaust", { color: "#443d33", roughness: 0.8, metalness: 0.6 });
  add("wheel", { vertexColors: true, roughness: 0.87, metalness: 0.2 });
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext("2d"),
    shadowGradient = shadowContext.createRadialGradient(32, 32, 5, 32, 32, 32);
  shadowGradient.addColorStop(0, "#00000070");
  shadowGradient.addColorStop(0.5, "#00000038");
  shadowGradient.addColorStop(1, "#00000000");
  shadowContext.fillStyle = shadowGradient;
  shadowContext.fillRect(0, 0, 64, 64);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  textures.add(shadowTexture);
  materials.set(
    "contact-shadow",
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  return {
    get(key, metalness = 0.15, roughness = 0.7) {
      if (materials.has(key)) return materials.get(key);
      const id = `${key}:${metalness}:${roughness}`;
      if (!materials.has(id)) add(id, { color: key, metalness, roughness });
      return materials.get(id);
    },
    owns(material) {
      return [...materials.values()].includes(material);
    },
    setQuality(quality) {
      for (const material of materials.values()) {
        if (!material.isMeshStandardMaterial) continue;
        material.userData.relief ??= material.bumpMap;
        const map = quality === "low" ? null : material.userData.relief;
        if (material.bumpMap !== map) {
          material.bumpMap = map;
          material.needsUpdate = true;
        }
      }
    },
    dispose() {
      for (const m of materials.values()) m.dispose();
      for (const t of textures) t.dispose();
      materials.clear();
      textures.clear();
    },
  };
}
