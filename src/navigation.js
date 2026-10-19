import { blocked } from "./maps.js";
const CELL = 25,
  COLS = 40,
  ROWS = 25;
export function walkable(map, unit, x, y) {
  if (x < 15 || x > 985 || y < 15 || y > 605) return false;
  if (unit.domain === "air") return true;
  if (map.stage === 2 && ["sea", "sub"].includes(unit.domain) && y < 285)
    return false;
  return !blocked(map, x, y, unit.radius + 3);
}
// A small deterministic grid route. Aircraft bypass terrain; sea units stay in water.
export function findRoute(map, unit, start, end) {
  if (unit.domain === "air") return [{ ...end }];
  const point = (i) => ({
    x: (i % COLS) * CELL + CELL / 2,
    y: Math.floor(i / COLS) * CELL + CELL / 2,
  });
  const valid = (i) => {
    const p = point(i);
    return walkable(map, unit, p.x, p.y);
  };
  const nearest = (p) => {
    let best = -1,
      d = Infinity;
    for (let i = 0; i < COLS * ROWS; i++)
      if (valid(i)) {
        const q = point(i),
          dist = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
        if (dist < d) {
          d = dist;
          best = i;
        }
      }
    return best;
  };
  const from = nearest(start),
    to = nearest(end);
  if (from < 0 || to < 0) return [];
  const queue = [from],
    parents = new Int32Array(COLS * ROWS).fill(-2);
  parents[from] = -1;
  for (let head = 0; head < queue.length && parents[to] === -2; head++) {
    const current = queue[head],
      x = current % COLS,
      y = Math.floor(current / COLS);
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        next = ny * COLS + nx;
      if (
        nx < 0 ||
        nx >= COLS ||
        ny < 0 ||
        ny >= ROWS ||
        parents[next] !== -2 ||
        !valid(next)
      )
        continue;
      if (dx && dy && (!valid(y * COLS + nx) || !valid(ny * COLS + x)))
        continue;
      parents[next] = current;
      queue.push(next);
    }
  }
  if (parents[to] === -2) return [];
  const route = [];
  for (let i = to; i !== -1; i = parents[i]) route.push(point(i));
  route.reverse();
  if (walkable(map, unit, end.x, end.y)) route.push({ ...end });
  return route;
}
export function moveUnit(unit, point, map, dt) {
  if (
    !unit.route ||
    !unit.routeGoal ||
    Math.hypot(point.x - unit.routeGoal.x, point.y - unit.routeGoal.y) > 35
  ) {
    unit.route = findRoute(map, unit, unit, point);
    unit.routeGoal = { ...point };
  }
  let budget = unit.speed * dt;
  while (unit.route.length && budget > 0) {
    const next = unit.route[0],
      dx = next.x - unit.x,
      dy = next.y - unit.y,
      d = Math.hypot(dx, dy);
    if (d < 1) {
      unit.route.shift();
      continue;
    }
    const step = Math.min(budget, d);
    unit.heading = Math.atan2(dx, dy);
    unit.x += (dx / d) * step;
    unit.y += (dy / d) * step;
    budget -= step;
    if (step === d) unit.route.shift();
  }
  return Math.hypot(point.x - unit.x, point.y - unit.y) < 8;
}
export function clearShot(map, from, to) {
  if (from.domain === "air" || to.domain === "air") return true;
  const dx = to.x - from.x,
    dy = to.y - from.y,
    length = dx * dx + dy * dy;
  if (!length) return true;
  return !map.obstacles.some((o) => {
    const t = Math.max(
      0,
      Math.min(1, ((o.x - from.x) * dx + (o.y - from.y) * dy) / length),
    );
    return (
      Math.hypot(from.x + t * dx - o.x, from.y + t * dy - o.y) < o.r * 0.85
    );
  });
}
