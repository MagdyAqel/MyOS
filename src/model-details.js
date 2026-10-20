import * as THREE from "three";
export const QUALITY = {
  low: { ratio: 1, shadow: 512, shadows: false, particles: 36, vegetation: 0 },
  medium: {
    ratio: 1.25,
    shadow: 1024,
    shadows: true,
    particles: 70,
    vegetation: 0.55,
  },
  high: {
    ratio: 1.8,
    shadow: 2048,
    shadows: true,
    particles: 110,
    vegetation: 1,
  },
};
export function resolveQuality(value, touch) {
  return Object.hasOwn(QUALITY, value) ? value : touch ? "low" : "medium";
}
export function detailModel(g, e) {
  // Billboard smoke fades at its edges instead of showing opaque spheres.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d"),
    gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, "#ffffffb0");
  gradient.addColorStop(0.5, "#ffffff70");
  gradient.addColorStop(1, "#ffffff00");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const smokeMaterial = new THREE.SpriteMaterial({
    map: texture,
    color: "#424442",
    transparent: true,
    depthWrite: false,
  });
  const fireMaterial = new THREE.SpriteMaterial({
    map: texture,
    color: "#ffab48",
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const damage = new THREE.Group();
  g.add(damage);
  const smoke = Array.from({ length: 4 }, () => {
    const p = new THREE.Sprite(smokeMaterial);
    damage.add(p);
    return p;
  });
  const fire = new THREE.Sprite(fireMaterial);
  damage.add(fire);
  let lastX = e.x,
    lastY = e.y,
    lastHeading = e.heading || 0,
    lastTime = 0;
  return {
    update(unit, time, quality) {
      const dt = Math.max(0, Math.min(0.1, time - lastTime));
      lastTime = time;
      const distance = Math.hypot(unit.x - lastX, unit.y - lastY),
        moving = distance > 0.02;
      lastX = unit.x;
      lastY = unit.y;
      for (const detail of g.userData.modelDetails)
        detail.visible = quality !== "low";
      for (const w of g.userData.wheels)
        if (moving) w.rotation.x += distance / 5.8;
      for (const r of g.userData.rotors)
        r.group.rotation[r.axis] = time * r.speed;
      g.userData.legs.forEach((leg, i) => {
        leg.rotation.x = moving
          ? Math.sin(time * 10 + unit.id + i * Math.PI) * 0.48
          : 0;
      });
      if (unit.domain === "air") {
        const angle = unit.heading ?? lastHeading;
        const turn = Math.atan2(
          Math.sin(angle - lastHeading),
          Math.cos(angle - lastHeading),
        );
        g.rotation.z = THREE.MathUtils.lerp(
          g.rotation.z,
          Math.max(-0.3, Math.min(0.3, -turn * 4)),
          Math.min(1, dt * 6),
        );
        g.rotation.x = Math.sin(time + unit.id) * 0.012;
        lastHeading = angle;
        if (g.userData.landingGear)
          g.userData.landingGear.visible = (unit.flight ?? 1) < 0.5;
      }
      const body = g.userData.deployedBody,
        truck = g.userData.mobileBody;
      if (body) {
        const mode = unit.hqMode || "deployed";
        const phase =
          mode === "packing"
            ? (unit.hqTimer || 0) / 3
            : mode === "deploying"
              ? 1 - (unit.hqTimer || 0) / 3
              : 1;
        body.visible = mode !== "moving";
        body.scale.setScalar(Math.max(0.02, phase));
        truck.visible = mode !== "deployed";
        g.userData.modelDetails[0].visible =
          mode === "deployed" && quality !== "low";
        g.rotation.y = mode === "moving" ? unit.heading || 0 : 0;
      }
      const fraction = unit.hp / unit.maxHp;
      damage.visible = fraction < 0.65;
      for (let i = 0; i < smoke.length; i++) {
        const p = smoke[i],
          life = (time * 0.6 + i * 0.26) % 1;
        p.visible = quality !== "low" || i < 2;
        p.position.set(
          life * 12 + Math.sin(time + i) * 3,
          (unit.speed ? 18 : 35) + life * 33,
          Math.cos(time + i) * 3,
        );
        p.scale.setScalar(5 + life * (fraction < 0.3 ? 22 : 12));
      }
      fire.visible = fraction < 0.3;
      fire.position.set(0, unit.speed ? 17 : 32, 0);
      fire.scale.set(9, 14 + Math.sin(time * 17) * 4, 1);
    },
    dispose() {
      texture.dispose();
      smokeMaterial.dispose();
      fireMaterial.dispose();
    },
  };
}
