import * as THREE from "three";
export function specialModel(
  g,
  e,
  { box, cylinder, mesh },
  color,
  light,
  dark,
) {
  if (["recon", "drone"].includes(e.type)) {
    const scout = e.type === "recon";
    const body = mesh(
      new THREE.ConeGeometry(scout ? 4 : 3, scout ? 40 : 29, 10),
      color,
      g,
      0,
      0,
      0,
    );
    body.rotation.x = Math.PI / 2;
    box(g, scout ? 62 : 34, 2, 8, color, 0, 0, -1);
    box(g, 17, 2, 6, light, 0, 1, -14);
    box(g, 2, 8, 8, color, 0, 4, -13);
    if (scout) {
      mesh(new THREE.SphereGeometry(4, 8, 6), dark, g, 0, -5, 10);
      const rotor = new THREE.Group();
      rotor.position.z = 22;
      box(rotor, 18, 1, 2, dark, 0, 0, 0);
      g.add(rotor);
      g.userData.rotor = rotor;
      box(g, 2, 11, 2, light, 0, 7, 0);
    } else {
      box(g, 5, 4, 10, "#d8ae6b", 0, -3, 8);
      cylinder(g, 3, 6, dark, 0, 0, -17).rotation.x = Math.PI / 2;
    }
    return true;
  }
  if (!["apc", "artillery"].includes(e.type)) return false;
  box(g, 32, e.type === "apc" ? 20 : 13, 48, color, 0, 16, 0);
  for (const x of [-19, 19])
    for (const z of [-17, -5, 7, 19]) {
      const wheel = cylinder(g, 6, 5, dark, x, 7, z);
      wheel.rotation.z = Math.PI / 2;
    }
  if (e.type === "apc") {
    box(g, 24, 9, 14, color, 0, 25, 15);
    box(g, 23, 5, 1, light, 0, 28, 23);
    box(g, 19, 13, 2, dark, 0, 15, -25);
    for (const x of [-17, 17])
      for (const z of [-12, 0, 12]) box(g, 2, 5, 6, dark, x, 22, z);
    const gun = new THREE.Group();
    gun.position.y = 30;
    cylinder(gun, 6, 5, dark, 0, 0, 0);
    box(gun, 2, 2, 19, light, 0, 3, 12);
    g.add(gun);
    g.userData.weaponPivot = gun;
    if (e.design === "armored")
      for (const x of [-20, 20]) box(g, 3, 14, 40, "#687867", x, 20, -2);
  } else {
    const gun = new THREE.Group();
    gun.position.y = 23;
    box(gun, 24, 12, 24, color, 0, 0, -7);
    const barrel = box(gun, 5, 5, 66, dark, 0, 12, 29);
    barrel.rotation.x = -0.22;
    box(gun, 9, 7, 7, light, 0, 19, 60);
    g.add(gun);
    g.userData.weaponPivot = gun;
    for (const x of [-24, 24]) box(g, 5, 5, 21, dark, x, 5, -20);
  }
  return true;
}
