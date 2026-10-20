// Legacy maps retain their original coordinates and save format.
export function mapSize(map) {
  return { width: map?.width || 1000, height: map?.height || 620 };
}
export const mapX = (map, x) => (x * mapSize(map).width) / 1000;
export const mapY = (map, y) => (y * mapSize(map).height) / 620;
export const mapPoint = (map, x, y) => ({
  x: mapX(map, x),
  y: mapY(map, y),
});
export function mapGrid(map) {
  const { width, height } = mapSize(map);
  return { cols: Math.ceil(width / 25), rows: Math.ceil(height / 25) };
}
