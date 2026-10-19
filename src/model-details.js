import * as THREE from "three";
export const QUALITY = {
  low: { ratio: 1, shadow: 512, shadows: false },
  medium: { ratio: 1.25, shadow: 1024, shadows: true },
  high: { ratio: 1.8, shadow: 2048, shadows: true },
};
export function resolveQuality(value, touch) {
  return Object.hasOwn(QUALITY, value) ? value : touch ? "low" : "medium";
}
export function detailModel(g, e, { box, cylinder, mesh }) {
  const neutral = e.team === "neutral",
    color = neutral ? "#b3a36a" : e.team === "blue" ? "#677b66" : "#8c7561",
    dark = "#303b40",
    metal = "#94a4a5";
  const extras = new THREE.Group();
  g.add(extras);
  const wheels = [],
    rotors = [];
  let body = null,
    truck = null;
  if (["tank", "convoy"].includes(e.type)) {
    for (const side of [-1, 1])
      for (const z of [-16, -5, 6, 17]) {
        const w = cylinder(
          extras,
          e.type === "tank" ? 4 : 5,
          3,
          dark,
          side * 19,
          6,
          z,
        );
        w.rotation.z = Math.PI / 2;
        wheels.push(w);
      }
    box(extras, 32, 3, 37, color, 0, 14, 0);
    for (const side of [-1, 1]) {
      box(extras, 2, 8, 44, color, side * 24, 10, 0);
      for (const z of [-16, 0, 16])
        box(extras, 1, 2, 5, metal, side * 25.2, 13, z);
    }
    if (e.type === "tank") {
      box(extras, 12, 3, 8, dark, 0, 23, -2);
      box(extras, 7, 2, 4, "#82a5aa", 5, 25, 4);
      cylinder(extras, 1, 20, dark, -11, 30, -10);
      for (const x of [-8, 8])
        cylinder(extras, 3, 6, metal, x, 21, -14).rotation.x = Math.PI / 2;
    }
  }
  if (["fighter", "bomber"].includes(e.type)) {
    const big = e.type === "bomber";
    const shape = new THREE.Shape();
    shape.moveTo(0, 18);
    shape.lineTo(big ? 40 : 29, -10);
    shape.lineTo(big ? 35 : 25, -19);
    shape.lineTo(0, -5);
    shape.lineTo(big ? -35 : -25, -19);
    shape.lineTo(big ? -40 : -29, -10);
    shape.closePath();
    const wing = mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: false }),
      color,
      extras,
      0,
      1,
      0,
    );
    wing.rotation.x = -Math.PI / 2;
    for (const x of [-17, 17]) {
      cylinder(extras, 2, 14, metal, x, -3, -5).rotation.x = Math.PI / 2;
      box(extras, 3, 3, 12, dark, x, -4, 8);
    }
    const gear = new THREE.Group();
    extras.add(gear);
    for (const [x, z] of [
      [-7, -6],
      [7, -6],
      [0, 14],
    ]) {
      cylinder(gear, 1, 7, metal, x, -4, z);
      const w = cylinder(gear, 2.2, 2, dark, x, -8, z);
      w.rotation.z = Math.PI / 2;
    }
    g.userData.landingGear = gear;
  }
  if (["submarine", "destroyer"].includes(e.type)) {
    if (e.type === "destroyer") {
      for (const side of [-1, 1]) {
        box(extras, 1, 1, 65, metal, side * 12, 10, 0);
        for (let z = -28; z <= 28; z += 14)
          box(extras, 1, 5, 1, metal, side * 12, 8, z);
      }
      const radar = box(extras, 16, 2, 3, dark, 0, 43, -9);
      rotors.push(radar);
      for (const x of [-7, 7])
        cylinder(extras, 2, 16, metal, x, 19, 17).rotation.x = Math.PI / 2;
    } else {
      box(extras, 26, 2, 8, color, 0, 1, -27);
      cylinder(extras, 1, 9, metal, 3, 22, 0);
      for (const z of [-18, -8, 8, 18]) box(extras, 3, 1, 4, metal, 0, 9, z);
      const propeller = box(extras, 13, 2, 2, metal, 0, 0, -37);
      rotors.push(propeller);
    }
  }
  if (e.type === "airfield") {
    box(extras, 54, 1, 160, "#3c4244", 30, 1, 0);
    for (let z = -65; z <= 65; z += 20)
      box(extras, 2, 0.4, 10, "#dfd8b6", 30, 1.7, z);
    for (const x of [7, 53])
      for (const z of [-60, -20, 20, 60])
        box(extras, 2, 1, 2, "#86b2cb", x, 2, z);
  }
  if (!e.speed) {
    if (e.type === "hq") {
      body = new THREE.Group();
      for (const child of [...g.children])
        if (child !== extras) body.add(child);
      g.add(body);
      truck = new THREE.Group();
      g.add(truck);
      if (e.domain === "sub") {
        const hull = mesh(
          new THREE.SphereGeometry(1, 18, 12),
          color,
          truck,
          0,
          4,
          0,
        );
        hull.scale.set(22, 14, 53);
        box(truck, 17, 16, 24, dark, 0, 20, -5);
        cylinder(truck, 1.5, 22, metal, 0, 36, -6);
        box(truck, 48, 2, 10, metal, 0, 2, -35);
      } else {
        box(truck, 36, 19, 48, color, 0, 17, -5);
        box(truck, 33, 21, 20, dark, 0, 17, 28);
        box(truck, 28, 8, 2, "#92b3bc", 0, 22, 39);
        for (const x of [-22, 22])
          for (const z of [-19, 9, 28]) {
            const w = cylinder(truck, 7, 5, "#202b31", x, 8, z);
            w.rotation.z = Math.PI / 2;
            wheels.push(w);
          }
        cylinder(truck, 1, 25, metal, -10, 39, -15);
        box(truck, 12, 3, 10, "#426479", 0, 31, -5);
      }
      truck.visible = false;
    }
    for (const side of [-1, 1])
      for (const z of [-18, 18])
        box(extras, 3, 25, 3, metal, side * (e.radius * 0.8), 14, z);
  }
  const smokeMat = new THREE.MeshBasicMaterial({
      color: "#42474a",
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
    fireMat = new THREE.MeshBasicMaterial({
      color: "#ff9b35",
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
  const damage = new THREE.Group();
  g.add(damage);
  const smoke = [];
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 5), smokeMat);
    damage.add(puff);
    smoke.push(puff);
  }
  const fire = new THREE.Mesh(new THREE.ConeGeometry(4, 14, 6), fireMat);
  damage.add(fire);
  let lastX = e.x,
    lastY = e.y,
    lastHeading = e.heading || 0,
    lastTime = 0;
  return {
    update(unit, time, quality) {
      const dt = Math.max(0, Math.min(0.1, time - lastTime));
      lastTime = time;
      const moving = Math.hypot(unit.x - lastX, unit.y - lastY) > 0.02;
      lastX = unit.x;
      lastY = unit.y;
      extras.visible = quality !== "low";
      for (const w of wheels) if (moving) w.rotation.x += dt * 8;
      for (const rotor of rotors) rotor.rotation.y = time * 2;
      if (unit.domain === "air") {
        const angle = unit.heading || lastHeading;
        const turn = Math.atan2(
          Math.sin(angle - lastHeading),
          Math.cos(angle - lastHeading),
        );
        g.rotation.z = THREE.MathUtils.lerp(
          g.rotation.z,
          Math.max(-0.22, Math.min(0.22, -turn * 2)),
          0.12,
        );
        g.rotation.x = Math.sin(time + unit.id) * 0.018;
        lastHeading = angle;
        if (g.userData.landingGear)
          g.userData.landingGear.visible = (unit.flight ?? 1) < 0.5;
      }
      if (body) {
        const mode = unit.hqMode || "deployed";
        const phase =
          mode === "packing"
            ? (unit.hqTimer || 0) / 3
            : mode === "deploying"
              ? 1 - (unit.hqTimer || 0) / 3
              : 1;
        body.visible = mode !== "moving";
        body.scale.set(phase, Math.max(0.15, phase), phase);
        truck.visible = mode !== "deployed";
        extras.visible = mode === "deployed" && quality !== "low";
        if (mode === "moving") g.rotation.y = unit.heading || 0;
        else g.rotation.y = 0;
      }
      const fraction = unit.hp / unit.maxHp;
      damage.visible = fraction < 0.65;
      const n = quality === "low" ? 2 : 4;
      for (let i = 0; i < smoke.length; i++) {
        const p = smoke[i],
          life = (time * 0.6 + i * 0.26) % 1;
        p.visible = i < n;
        p.position.set(
          Math.sin(time + i) * 5,
          (unit.speed ? 18 : 45) + life * 38,
          Math.cos(time + i) * 4,
        );
        p.scale.setScalar(3 + life * (fraction < 0.3 ? 13 : 7));
      }
      fire.visible = fraction < 0.3;
      fire.position.set(0, unit.speed ? 17 : 40, 0);
      fire.scale.y = 0.7 + Math.sin(time * 17) * 0.25;
    },
    dispose() {
      smokeMat.dispose();
      fireMat.dispose();
    },
  };
}
