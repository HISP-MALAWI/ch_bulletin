function getPolygonCentroid(coords) {
  const ring = Array.isArray(coords[0][0]) ? coords[0] : coords;

  const closedRing = ring[0][0] === ring[ring.length - 1][0] &&
                      ring[0][1] === ring[ring.length - 1][1]
    ? ring
    : [...ring, ring[0]];

  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < closedRing.length - 1; i++) {
    const [x0, y0] = closedRing[i];
    const [x1, y1] = closedRing[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  area = area / 2;

  if (area === 0) {
    const lon = closedRing.reduce((sum, [x]) => sum + x, 0) / (closedRing.length - 1);
    const lat = closedRing.reduce((sum, [, y]) => sum + y, 0) / (closedRing.length - 1);
    return { lat, lon };
  }

  cx = cx / (6 * area);
  cy = cy / (6 * area);

  return { lat: cy, lon: cx };
}

function getOrgUnitCentroid(geometry) {
  if (!geometry) return null;

  if (geometry.type === 'Point') {
    const [lon, lat] = geometry.coordinates;
    return { lat, lon };
  }

  if (geometry.type === 'Polygon') {
    return getPolygonCentroid(geometry.coordinates[0]);
  }

  if (geometry.type === 'MultiPolygon') {
    // use the first (typically largest) polygon's outer ring
    return getPolygonCentroid(geometry.coordinates[0][0]);
  }

  console.warn('Unsupported geometry type:', geometry.type);
  return null;
}

export default getOrgUnitCentroid;

