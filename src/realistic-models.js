import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Forward is +Z for every model, including barrels, bows and aircraft noses.
// Silhouettes remain in every preset; only the small fittings are optional.
export function buildUnitModel(root, e, { mesh, box, cylinder }) {
  const team = e.team || "neutral",
    paint = `armor-${team}`,
    mark = `team-${team}`;
  const air = `air-${team}`,
    navy = `navy-${team}`;
  const detail = new THREE.Group();
  root.add(detail);
  const wheels = [],
    rotors = [],
    legs = [];
  const details = [detail];
  const group = (parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const fittings = (parent) => {
    const g = group(parent);
    details.push(g);
    return g;
  };
  const round = (p, w, h, d, mat, x = 0, y = h / 2, z = 0, r = 1) =>
    mesh(
      new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 3, h / 3, d / 3)),
      mat,
      p,
      x,
      y,
      z,
    );
  const sphere = (p, rx, ry, rz, mat, x = 0, y = 0, z = 0) => {
    const m = mesh(new THREE.SphereGeometry(1, 16, 10), mat, p, x, y, z);
    m.scale.set(rx, ry, rz);
    return m;
  };
  const pipe = (p, radius, length, mat, x, y, z) => {
    const m = cylinder(p, radius, length, mat, x, y, z);
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const rod = (p, from, to, radius, mat) => {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to);
    const m = cylinder(p, radius, a.distanceTo(b), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.sub(a).normalize(),
    );
    return m;
  };
  const panel = (p, points, thickness, mat, x = 0, y = 0, z = 0) => {
    const shape = new THREE.Shape(
      points.map(([a, b]) => new THREE.Vector2(a, b)),
    );
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
    });
    geo.rotateX(Math.PI / 2);
    return mesh(geo, mat, p, x, y, z);
  };
  function loft(p, sections, mat, sides = 12) {
    // Sections are [Z, half-width, half-height, centre-height].
    const vertices = [],
      uv = [],
      index = [];
    for (let j = 0; j < sections.length; j++) {
      const [z, w, h, y] = sections[j];
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        vertices.push(Math.sin(a) * w, y + Math.cos(a) * h, z);
        uv.push(i / sides, j / (sections.length - 1));
        if (j && i < sides) {
          const k = j * (sides + 1) + i;
          index.push(k, k + 1, k - sides - 1, k + 1, k - sides, k - sides - 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    return mesh(geo, mat, p);
  }
  function wheel(p, x, z, radius = 5.8, y = 6.5) {
    const g = group(p, x, y, z);
    // Rubber shoulder + recessed metal hub in a single draw call.
    const profile = [
      [0, -2.3],
      [radius * 0.58, -2.3],
      [radius * 0.8, -2],
      [radius, -1.4],
      [radius, 1.4],
      [radius * 0.8, 2],
      [radius * 0.58, 2.3],
      [0, 2.3],
    ];
    const geo = new THREE.LatheGeometry(
      profile.map(([r, a]) => new THREE.Vector2(r, a)),
      12,
    );
    const vertices = geo.attributes.position,
      colors = [];
    for (let i = 0; i < vertices.count; i++) {
      const c = new THREE.Color(
        Math.hypot(vertices.getX(i), vertices.getZ(i)) < radius * 0.65
          ? "#72766a"
          : "#252a26",
      );
      if (i % 3 === 0) c.multiplyScalar(0.7);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const w = mesh(geo, "wheel", g);
    w.rotation.z = Math.PI / 2;
    wheels.push(g);
  }
  function tracks(p, length = 48) {
    for (const side of [-1, 1]) {
      round(p, 8, 12, length, "rubber", side * 18.5, 6.5, 0, 3);
      for (const z of [-18, -9, 0, 9, 18]) wheel(p, side * 19.5, z, 4.6, 6.4);
      const d = fittings(p);
      for (let z = -length / 2 + 2; z < length / 2; z += 4) {
        box(d, 8.8, 1.1, 1.8, "tread", side * 18.5, 12.6, z);
        box(d, 8.8, 1.1, 1.8, "tread", side * 18.5, 0.6, z);
      }
      box(p, 4, 5, length - 4, paint, side * 22, 13, 0);
    }
  }
  function vents(p, x, y, z, count = 5, width = 12) {
    for (let i = 0; i < count; i++)
      box(p, width, 0.55, 0.9, "rubber", x, y, z + i * 2);
  }
  function antenna(p, x, y, z, height = 17) {
    cylinder(p, 0.8, 3, "rubber", x, y, z);
    cylinder(p, 0.25, height, "steel", x, y + height / 2, z);
  }
  function lamps(p, width, y, front, rear) {
    for (const side of [-1, 1]) {
      box(p, 3.5, 2, 1, "lamp", side * width, y, front);
      if (rear !== undefined)
        box(p, 2.5, 1.4, 0.7, "red-lamp", side * width, y - 1, rear);
    }
  }
  function turret(p, artillery = false, small = false) {
    const gun = group(
      p,
      0,
      small ? 28 : artillery ? 23 : 19,
      artillery ? -6 : -2,
    );
    cylinder(gun, small ? 5 : 10, 2.6, "steel", 0, 0, 0);
    round(
      gun,
      small ? 11 : 27,
      small ? 6 : 11,
      small ? 12 : 26,
      paint,
      0,
      5,
      -1,
      2,
    );
    const recoil = group(gun, 0, small ? 6 : 7, small ? 7 : 12);
    if (artillery) recoil.rotation.x = -0.14;
    const length = small ? 18 : artillery ? 58 : 38;
    pipe(recoil, small ? 0.8 : 1.7, length, "steel", 0, 0, length / 2);
    pipe(recoil, small ? 1.1 : 2.1, length * 0.33, paint, 0, 0, length * 0.28);
    pipe(recoil, small ? 1.15 : 2.2, 3, "exhaust", 0, 0, length - 1);
    pipe(recoil, small ? 0.65 : 1.3, 0.2, "rubber", 0, 0, length + 0.6);
    const d = fittings(gun);
    cylinder(d, small ? 2 : 4.5, 1.3, "steel", -5, 11, -4);
    round(d, 5, 2.5, 5, "glass", 6, 11, 6, 0.5);
    if (!small) {
      antenna(d, -10, 11, -10);
      for (const side of [-1, 1]) {
        box(d, 1, 3, 17, mark, side * 13.8, 5, -1);
        for (let z = -5; z < 7; z += 4)
          pipe(d, 1.1, 4, "exhaust", side * 12, 5, z);
      }
      for (let x = -6; x <= 6; x += 6) box(d, 4.5, 2.2, 6, paint, x, 11, 3);
      box(d, 16, 6, 5, "canvas", 0, 5, -17);
    }
    root.userData.weaponPivot = gun;
    root.userData.recoil = recoil;
    root.userData.recoilOrigin = recoil.position.z;
  }
  function truck(p, kind) {
    round(p, 28, 5, 54, "steel", 0, 8, 0);
    round(p, 27, 17, 20, paint, 0, 20, 20, 2);
    box(p, 23, 6, 0.7, "glass", 0, 23, 30.2);
    box(p, 1, 7, 1, "steel", 0, 23, 31);
    box(p, 28, 3, 3, "rubber", 0, 10, 32);
    for (const side of [-1, 1]) {
      for (const z of [-18, -4, 22]) wheel(p, side * 16, z);
      box(p, 0.7, 6, 10, "glass", side * 13.7, 23, 19);
      box(detail, 2, 4, 2, "steel", side * 17, 25, 25);
      box(p, 0.8, 3, 13, mark, side * 13.8, 16, 19);
    }
    lamps(p, 10, 15, 30.7, -28);
    box(p, 26, 3, 34, paint, 0, 12, -10);
    if (kind === "repair") {
      for (const side of [-1, 1]) round(p, 7, 9, 25, paint, side * 10, 18, -10);
      cylinder(p, 6, 5, "steel", 0, 17, -12);
      rod(p, [0, 18, -12], [0, 34, -3], 2.5, paint);
      rod(p, [0, 34, -3], [0, 28, 16], 1.6, paint);
      rod(detail, [0, 28, 16], [0, 21, 16], 0.35, "steel");
      box(detail, 5, 3, 5, "lamp", 0, 30, 17);
    } else if (kind === "ammoTruck") {
      round(p, 25, 17, 33, paint, 0, 22, -11);
      for (const side of [-1, 1])
        box(p, 0.6, 3, 28, mark, side * 12.8, 23, -11);
      for (const x of [-8, 0, 8]) {
        box(detail, 6, 5, 10, "canvas", x, 33, -15);
        box(detail, 5, 0.6, 2, "steel", x, 36, -15);
      }
    } else {
      round(p, 26, 19, 34, "canvas", 0, 24, -10, 3);
      for (const z of [-23, -10, 3])
        box(detail, 26.4, 1, 0.9, "steel", 0, 32, z);
    }
  }
  function infantry() {
    const engineer = e.type === "engineer",
      survivor = e.type === "survivor";
    const uniform = survivor ? "canvas" : paint;
    const body = group(root, 0, 0, 0);
    round(body, 7, 8, 5, uniform, 0, 15, 0, 1.5);
    round(body, 6.8, 6, 1.6, "canvas", 0, 15, 3, 0.5);
    round(body, 6.5, 8, 3.5, "canvas", 0, 15, -4, 1);
    for (const side of [-1, 1]) {
      const leg = group(body, side * 2.2, 11, 0);
      round(leg, 3, 8, 3.5, uniform, 0, -4, 0, 0.7);
      round(leg, 3.2, 2.5, 5, "rubber", 0, -9, 1, 0.6);
      legs.push(leg);
      rod(body, [side * 4, 18, 0], [side * 4.8, 13, 2], 1.5, uniform);
      rod(body, [side * 4.8, 13, 2], [side * 2.5, 14, 6], 1.2, "#b59b7d");
      box(detail, 1.7, 2, 1, "canvas", side * 1.8, 14, 4.2);
    }
    sphere(body, 3, 3.5, 2.8, "#b69d80", 0, 22, 0.5);
    sphere(body, 3.5, 2.5, 3.3, engineer ? "#af9657" : uniform, 0, 24, 0);
    box(body, 5.5, 1.3, 0.8, "glass", 0, 22.5, 3);
    box(detail, 1, 2, 3, mark, -4.2, 18, 0);
    if (!engineer && !survivor) {
      box(body, 1.5, 2.3, 9, "steel", 2, 14, 6);
      pipe(body, 0.55, 7, "rubber", 2, 14.5, 13);
      box(body, 1.5, 3, 2, "rubber", 2, 12, 6);
    } else box(body, 5, 5, 4, "steel", 6, 10, 1);
  }
  function aircraft() {
    const bomber = e.type === "bomber",
      scout = e.type === "recon",
      drone = e.type === "drone";
    const length = bomber ? 76 : scout ? 46 : drone ? 33 : 61;
    const half = length / 2,
      radius = bomber ? 5.8 : scout ? 3.5 : drone ? 2.8 : 4.5;
    loft(
      root,
      [
        [-half, radius * 0.5, radius * 0.5, 0],
        [-half * 0.7, radius, radius * 0.8, 0],
        [0, radius, radius, 0],
        [half * 0.6, radius * 0.65, radius * 0.7, 0],
        [half, 0.1, 0.1, 0],
      ],
      air,
      16,
    );
    const span = bomber ? 48 : scout ? 38 : drone ? 21 : 31;
    const wing = scout
      ? [
          [0, 5],
          [span, 0],
          [span, -5],
          [0, -4],
          [-span, -5],
          [-span, 0],
        ]
      : [
          [0, 11],
          [span, -14],
          [span - 2, -21],
          [9, -14],
          [0, -20],
          [-9, -14],
          [-span + 2, -21],
          [-span, -14],
        ];
    panel(root, wing, 1.2, air, 0, 0.8, bomber ? 3 : 0);
    panel(
      root,
      [
        [0, 5],
        [14, -3],
        [14, -7],
        [0, -3],
        [-14, -7],
        [-14, -3],
      ],
      0.7,
      air,
      0,
      1,
      -half + 8,
    );
    for (const side of scout || drone ? [0] : [-1, 1]) {
      const fin = panel(
        root,
        [
          [0, 8],
          [8, -1],
          [8, -8],
          [0, -6],
        ],
        0.8,
        air,
      );
      fin.rotation.z = Math.PI / 2;
      fin.position.set(side * (bomber ? 6 : 5), 2, -half + 8);
      fin.rotation.z += side * 0.2;
    }
    if (!drone && !scout) {
      const canopy = sphere(
        root,
        radius * 0.68,
        3.3,
        bomber ? 7 : 8,
        "glass",
        0,
        radius * 0.75,
        half * 0.43,
      );
      canopy.rotation.x = -0.12;
      for (const side of [-1, 1]) {
        pipe(
          root,
          radius * 0.62,
          16,
          "steel",
          side * (radius + 1),
          -1.2,
          -half + 8,
        );
        pipe(
          root,
          radius * 0.48,
          0.5,
          "rubber",
          side * (radius + 1),
          -1.2,
          -half - 0.3,
        );
        panel(
          root,
          [
            [0, 5],
            [4, 1],
            [4, -7],
            [0, -9],
          ],
          2,
          "deck",
          side * radius,
          -1,
          4,
        );
        for (const x of [span * 0.5, span * 0.77]) {
          box(detail, 1, 3, 4, "steel", side * x, -2, -9);
          pipe(detail, bomber ? 1.4 : 0.9, 11, "#babbb1", side * x, -4, -9);
          panel(
            detail,
            [
              [-2, -2],
              [2, -2],
              [0, 3],
            ],
            0.5,
            "steel",
            side * x,
            -3,
            -13,
          );
        }
      }
    } else if (scout) {
      sphere(root, 3.7, 3.7, 3.7, "steel", 0, -4, 9);
      sphere(root, 2, 2, 1, "glass", 0, -4.5, 12);
      const rotor = group(root, 0, 0, -half - 1);
      box(rotor, 18, 1, 1.3, "rubber", 0, 0, 0);
      cylinder(detail, 0.5, 7, "steel", 0, 6, 0);
      rotors.push({ group: rotor, axis: "z", speed: 36 });
    } else pipe(root, 1.9, 6, "exhaust", 0, 0, -half);
    for (const side of [-1, 1]) {
      box(root, 4, 0.45, 4, mark, side * span * 0.7, 1.5, scout ? -1 : -12);
      sphere(
        detail,
        0.65,
        0.65,
        0.65,
        side < 0 ? "red-lamp" : "lamp",
        side * span,
        1,
        scout ? -1 : -16,
      );
    }
    const gear = group(root);
    for (const [x, z] of [
      [-6, -8],
      [6, -8],
      [0, half * 0.45],
    ]) {
      cylinder(gear, 0.7, 6, "steel", x, -5, z);
      const w = cylinder(gear, 2, 1.8, "rubber", x, -8, z);
      w.rotation.z = Math.PI / 2;
    }
    root.userData.landingGear = gear;
  }
  function ship(sub = false) {
    if (sub) {
      loft(
        root,
        [
          [-40, 0.5, 0.5, 0],
          [-32, 6, 6, 0],
          [-20, 10, 9, 0],
          [20, 10, 9, 0],
          [33, 7.5, 7, 0],
          [39, 0.2, 0.2, 0],
        ],
        "sub-hull",
        20,
      );
      round(root, 7, 13, 17, "sub-hull", 0, 12, 1, 2);
      panel(
        root,
        [
          [-15, -3],
          [15, -3],
          [12, 3],
          [-12, 3],
        ],
        1,
        "sub-hull",
        0,
        5,
        -28,
      );
      box(root, 1.5, 14, 9, "sub-hull", 0, 2, -31);
      box(root, 6, 2, 1, mark, 0, 15, 10);
      for (const [x, z, h] of [
        [-1.5, 3, 9],
        [1.5, -3, 6],
      ]) {
        cylinder(root, 0.7, h, "steel", x, 20 + h / 2, z);
        box(detail, 2.3, 1.5, 1.5, "glass", x, 20 + h, z);
      }
      for (const z of [-16, -6, 13, 22]) {
        cylinder(detail, 2.1, 0.5, "steel", 0, 9, z);
        for (const side of [-1, 1])
          box(detail, 0.6, 1, 3, "rubber", side * 8.7, 4, z);
      }
      const prop = group(root, 0, 0, -41);
      for (let i = 0; i < 5; i++) {
        const blade = box(prop, 1.8, 10, 0.8, "#9a8559", 0, 0, 0);
        blade.rotation.z = (i * Math.PI) / 5;
      }
      rotors.push({ group: prop, axis: "z", speed: 8 });
      return;
    }
    loft(
      root,
      [
        [-48, 8, 4, 1],
        [-43, 13, 6, 0],
        [5, 14, 7, 0],
        [29, 10, 6, 1],
        [48, 0.15, 2, 5],
      ],
      navy,
      8,
    );
    panel(
      root,
      [
        [-11, -44],
        [11, -44],
        [12, 8],
        [8, 30],
        [0, 46],
        [-8, 30],
        [-12, 8],
      ],
      1.3,
      "deck",
      0,
      6.5,
    );
    round(root, 18, 11, 27, navy, 0, 12, -4, 2);
    round(root, 14, 7, 13, navy, 0, 21, 2, 1.5);
    box(root, 13, 2.7, 0.8, "glass", 0, 23, 8.8);
    for (const side of [-1, 1])
      box(root, 0.7, 2.7, 10, "glass", side * 7.1, 23, 2);
    round(root, 8, 10, 10, "steel", 0, 21, -14);
    box(root, 8, 1, 8, "exhaust", 0, 26.5, -14);
    cylinder(root, 1, 26, "steel", 0, 37, -3);
    const radar = group(root, 0, 45, -3);
    box(radar, 11, 3, 1.4, "steel", 0, 0, 0);
    rotors.push({ group: radar, axis: "y", speed: 1.4 });
    const gun = group(root, 0, 8, 28);
    cylinder(gun, 5.5, 3, "steel", 0, 0, 0);
    round(gun, 10, 6, 10, navy, 0, 3, -1);
    const recoil = group(gun, 0, 5, 4);
    pipe(recoil, 1, 17, "steel", 0, 0, 8.5);
    root.userData.weaponPivot = gun;
    root.userData.recoil = recoil;
    root.userData.recoilOrigin = 4;
    for (const side of [-1, 1]) {
      rod(detail, [side * 11, 10, -41], [side * 11, 10, 18], 0.35, "steel");
      for (let z = -40; z <= 16; z += 8)
        cylinder(detail, 0.3, 4, "steel", side * 11, 8, z);
      sphere(detail, 1.5, 1.5, 6, "#a8ada6", side * 9, 14, -14);
      box(root, 0.7, 3, 9, mark, side * 13, 3, -28);
    }
    // Aft helicopter pad, missile cells and mast rigging distinguish the deck.
    box(detail, 10, 0.4, 1, "#c2c4b6", 0, 7, -34);
    for (const x of [-5, 5]) box(detail, 1, 0.4, 8, "#c2c4b6", x, 7, -34);
    for (const x of [-4, 0, 4])
      for (const z of [14, 19]) box(detail, 3, 1.2, 3.5, "steel", x, 8, z);
    rod(detail, [-8, 23, -8], [0, 40, -3], 0.25, "steel");
    rod(detail, [8, 23, -8], [0, 40, -3], 0.25, "steel");
  }
  function building() {
    const r = e.radius;
    const body = group(root);
    round(body, r * 2 + 8, 3, r * 1.8 + 8, "concrete", 0, 1, 0);
    if (e.domain === "sub") {
      cylinder(body, r * 0.8, 13, "steel", 0, 10, 0);
      sphere(body, r * 0.7, 15, r * 0.7, "glass", 0, 20, 0);
      for (const side of [-1, 1])
        pipe(body, 5, r * 1.6, navy, side * r * 0.8, 9, 0);
      box(body, r, 2, 6, mark, 0, 32, 0);
      antenna(body, r * 0.6, 12, 0, 23);
    } else if (e.type === "turret") {
      cylinder(body, 17, 7, "concrete", 0, 6, 0);
      turret(body, false, true);
      root.userData.weaponPivot.position.y = 15;
      for (const side of [-1, 1]) box(body, 4, 9, 12, paint, side * 12, 12, 0);
    } else if (e.type === "airfield") {
      box(body, 48, 1.2, 140, "deck", 18, 3, 0);
      for (let z = -56; z <= 56; z += 18)
        box(body, 1.7, 0.2, 8, "#c9c8b7", 18, 3.8, z);
      for (const x of [-3, 39])
        for (let z = -60; z <= 60; z += 20)
          box(detail, 1.4, 1, 1.4, "lamp", x, 4, z);
      round(body, 24, 17, 32, "steel", -24, 12, -20, 4);
      box(body, 19, 12, 0.7, "rubber", -24, 9, -3.8);
      box(body, 9, 32, 9, "concrete", -26, 20, 23);
      round(body, 17, 6, 14, "glass", -26, 38, 23);
      box(body, 19, 2, 16, "steel", -26, 42, 23);
      antenna(detail, -26, 43, 23, 11);
    } else if (e.type === "harbor") {
      for (const side of [-1, 1]) {
        box(body, 13, 5, 66, "concrete", side * 28, 3, 18);
        for (let z = 0; z <= 45; z += 15)
          cylinder(detail, 1.6, 3, "steel", side * 27, 7, z);
      }
      round(body, 48, 18, 26, "concrete", 0, 13, -19);
      box(body, 46, 2, 27, "steel", 0, 23, -19);
      for (const x of [20, 29]) box(body, 2.8, 41, 3, "steel", x, 26, -13);
      box(body, 38, 3, 4, "#a19561", 12, 47, -13);
      rod(detail, [-5, 47, -13], [-5, 21, -13], 0.4, "steel");
      rod(detail, [29, 47, -13], [-5, 47, -13], 0.6, "steel");
    } else if (e.type === "power") {
      round(body, 23, 18, 31, "concrete", -12, 12, 0);
      for (const z of [-12, 11]) {
        cylinder(body, 8, 19, "steel", 13, 13, z);
        pipe(body, 2, 26, "exhaust", 13, 9, 0);
        vents(detail, 13, 23, z - 5, 5, 9);
      }
      cylinder(body, 3.2, 36, "exhaust", -17, 32, -9);
      box(body, 19, 2, 27, paint, -12, 22, 0);
    } else {
      const factory = e.type === "factory",
        supply = e.type === "supply",
        hq = e.type === "hq";
      const width = r * 1.7,
        depth = r * 1.35,
        height = factory ? 27 : 23;
      round(body, width, height, depth, "concrete", 0, height / 2 + 3, 0, 1.5);
      box(body, width + 3, 2, depth + 3, "steel", 0, height + 4, 0);
      box(body, width + 0.6, 3.5, 1, mark, 0, height - 1, depth / 2 + 0.7);
      if (factory || supply) {
        box(
          body,
          width * 0.6,
          height * 0.7,
          1,
          "deck",
          0,
          height * 0.4 + 3,
          depth / 2 + 0.8,
        );
        for (let y = 6; y < height * 0.75; y += 3)
          box(detail, width * 0.59, 0.5, 0.6, "steel", 0, y, depth / 2 + 1.5);
      } else {
        box(body, 10, 14, 1, "deck", 0, 10, depth / 2 + 1);
        for (const side of [-1, 1]) {
          box(
            body,
            14,
            6,
            1,
            "glass",
            side * width * 0.32,
            17,
            depth / 2 + 0.8,
          );
          box(
            detail,
            0.8,
            6,
            0.5,
            "steel",
            side * width * 0.32,
            17,
            depth / 2 + 1.5,
          );
        }
      }
      round(body, 12, 5, 9, "steel", -width * 0.27, height + 7, -7);
      vents(detail, -width * 0.27, height + 9.7, -10, 4, 9);
      if (hq) {
        const dish = group(body, 12, height + 7, -5);
        cylinder(dish, 1, 9, "steel", 0, 3, 0);
        const bowl = mesh(
          new THREE.SphereGeometry(8, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.4),
          "navy-" + team,
          dish,
          0,
          10,
          0,
        );
        bowl.rotation.x = 0.6;
        rod(dish, [0, 11, 1], [0, 17, 4], 0.35, "steel");
        antenna(body, -width / 2 + 4, height + 4, -depth / 2 + 4, 27);
        box(
          body,
          10,
          6,
          0.5,
          mark,
          -width / 2 + 9,
          height + 25,
          -depth / 2 + 4,
        );
      } else if (factory) {
        for (const x of [-19, 19]) {
          cylinder(body, 3, 23, "steel", x, 38, -15);
          cylinder(detail, 4, 2, "exhaust", x, 50, -15);
        }
      } else if (supply) {
        for (const x of [-18, 0, 18]) {
          round(body, 13, 10, 12, "canvas", x, 8, 28);
          for (const dx of [-4, 4])
            box(detail, 1, 10.5, 12.5, "steel", x + dx, 8, 28);
        }
      } else {
        round(body, 18, 10, 25, "canvas", 0, 8, -32, 3);
      }
    }
    if (e.type === "hq") {
      const mobile = group(root);
      if (e.domain === "sub") {
        loft(
          mobile,
          [
            [-43, 0.1, 0.1, 0],
            [-22, 15, 13, 0],
            [25, 15, 13, 0],
            [43, 0.1, 0.1, 0],
          ],
          "sub-hull",
          16,
        );
        round(mobile, 12, 18, 22, navy, 0, 17, 0);
      } else truck(mobile, "ammoTruck");
      mobile.visible = false;
      root.userData.deployedBody = body;
      root.userData.mobileBody = mobile;
    }
  }
  if (["soldier", "engineer", "survivor"].includes(e.type)) infantry();
  else if (["fighter", "bomber", "recon", "drone"].includes(e.type)) aircraft();
  else if (["destroyer", "submarine"].includes(e.type))
    ship(e.type === "submarine");
  else if (["convoy", "repair", "ammoTruck"].includes(e.type))
    truck(root, e.type);
  else if (["tank", "artillery", "apc"].includes(e.type)) {
    const apc = e.type === "apc",
      artillery = e.type === "artillery";
    if (apc) {
      round(root, 31, 17, 49, paint, 0, 17, 0, 3);
      for (const side of [-1, 1])
        for (const z of [-18, -6, 6, 18]) wheel(root, side * 18, z);
      const nose = box(root, 28, 8, 14, paint, 0, 23, 18);
      nose.rotation.x = -0.35;
      for (const side of [-1, 1]) {
        box(root, 8, 3, 0.7, "glass", side * 6, 26, 22);
        for (const z of [-15, -4, 7])
          box(detail, 0.8, 2, 4, "glass", side * 15.8, 23, z);
        if (e.design === "armored")
          box(root, 2.5, 12, 36, paint, side * 17.5, 23, -2);
      }
      box(root, 18, 13, 1, "steel", 0, 16, -25);
      for (const x of [-6, 6]) cylinder(detail, 3.5, 0.8, "steel", x, 26, -12);
    } else {
      tracks(root, artillery ? 53 : 48);
      round(root, 33, 10, artillery ? 49 : 44, paint, 0, 13, 0, 2.5);
      const slope = box(root, 30, 3, 14, paint, 0, 16, 17);
      slope.rotation.x = -0.23;
      vents(detail, 0, 18.5, -20, 4, 23);
    }
    turret(root, artillery, apc);
    lamps(root, 12, 14, apc ? 25 : 22, -25);
    for (const side of [-1, 1]) {
      box(root, 1, 4, 8, mark, side * (apc ? 16 : 22.5), 14, 0);
      rod(detail, [side * 11, 9, -25], [side * 9, 7, -27], 0.8, "steel");
    }
  } else building();
  root.userData.modelDetails = details;
  root.userData.wheels = wheels;
  root.userData.rotors = rotors;
  root.userData.legs = legs;
  compactModel(root);
}

// A tank's bolts/tracks share a handful of draw calls instead of one per part.
// Animated groups keep their own transform and all references used above.
function compactModel(parent) {
  for (const child of parent.children) if (child.isGroup) compactModel(child);
  const batches = new Map();
  for (const child of parent.children) {
    if (!child.isMesh || Array.isArray(child.material)) continue;
    if (!batches.has(child.material)) batches.set(child.material, []);
    batches.get(child.material).push(child);
  }
  for (const [material, children] of batches) {
    if (children.length < 2) continue;
    const geometries = children.map((m) => {
      m.updateMatrix();
      const geo = m.geometry.index
        ? m.geometry.toNonIndexed()
        : m.geometry.clone();
      geo.applyMatrix4(m.matrix);
      return geo;
    });
    const merged = mergeGeometries(geometries, false);
    for (const geo of geometries) geo.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = mesh.receiveShadow = true;
    for (const child of children) {
      parent.remove(child);
      child.geometry.dispose();
    }
    parent.add(mesh);
  }
}
