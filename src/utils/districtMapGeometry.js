/**
 * Vertices closer together than this, in viewBox units, land on the same pixel
 * once drawn. DHIS2 sends district boundaries at up to thirteen decimal places
 * — 96,520 vertices for Malawi's 34 level-3 units — and dropping the ones that
 * cannot be told apart keeps about a tenth of them and takes the path data from
 * roughly a megabyte to roughly a hundred kilobytes, which matters because the
 * preview is rasterised whole for the PDF. It is not an optimisation to taste.
 */
export const MAP_TOLERANCE = 0.5;

const round = (value) => Math.round(value * 10) / 10;

const isCoordinatePair = (value) =>
    Array.isArray(value) && Number.isFinite(value[0]) && Number.isFinite(value[1]);

// A polygon is a list of rings and a multipolygon is a list of polygons, so the
// same reader serves both: it takes the list of rings either way.
const readRings = (polygonCoordinates) =>
    (Array.isArray(polygonCoordinates) ? polygonCoordinates : [])
        .map((ring) => (Array.isArray(ring) ? ring.filter(isCoordinatePair) : []))
        // Fewer than three points cannot enclose anything, and passing one on
        // would produce a path that draws nothing.
        .filter((ring) => ring.length >= 3);

/**
 * Normalise a GeoJSON geometry into rings to draw or a single point, and return
 * null for anything this does not draw. A unit whose geometry comes back null
 * is reported as having no boundary rather than being drawn as an empty shape.
 */
export const readGeometryParts = (geometry) => {
    if (!geometry || typeof geometry !== 'object') return null;

    if (geometry.type === 'Point') {
        return isCoordinatePair(geometry.coordinates)
            ? { point: geometry.coordinates }
            : null;
    }

    if (geometry.type === 'MultiPoint') {
        const point = (Array.isArray(geometry.coordinates)
            ? geometry.coordinates
            : []
        ).find(isCoordinatePair);

        return point ? { point } : null;
    }

    if (geometry.type === 'Polygon') {
        const rings = readRings(geometry.coordinates);
        return rings.length > 0 ? { rings } : null;
    }

    if (geometry.type === 'MultiPolygon') {
        const rings = (Array.isArray(geometry.coordinates)
            ? geometry.coordinates
            : []
        ).flatMap(readRings);

        return rings.length > 0 ? { rings } : null;
    }

    return null;
};

/**
 * The smallest box containing every drawable coordinate, or null when there is
 * nothing finite to measure.
 */
export const readBounds = (geometries = []) => {
    let lonMin = Infinity;
    let lonMax = -Infinity;
    let latMin = Infinity;
    let latMax = -Infinity;
    let found = false;

    const visit = (pair) => {
        if (!isCoordinatePair(pair)) return;
        found = true;
        if (pair[0] < lonMin) lonMin = pair[0];
        if (pair[0] > lonMax) lonMax = pair[0];
        if (pair[1] < latMin) latMin = pair[1];
        if (pair[1] > latMax) latMax = pair[1];
    };

    for (const geometry of geometries) {
        const parts = readGeometryParts(geometry);
        if (!parts) continue;

        if (parts.point) visit(parts.point);
        for (const ring of parts.rings || []) {
            for (const pair of ring) visit(pair);
        }
    }

    return found ? { lonMin, lonMax, latMin, latMax } : null;
};

/**
 * The `d` attribute for a set of rings, projected and thinned.
 *
 * Every ring becomes its own subpath and the caller fills the result with
 * `fill-rule="evenodd"`, which is what draws the holes in a polygon and is also
 * correct for the separate islands of a multipolygon.
 *
 * A ring that arrives already closed — every one DHIS2 sent did — would
 * otherwise repeat its first vertex, so that vertex is dropped and `Z` closes
 * the shape.
 */
export const ringsToPath = (rings = [], project, tolerance = MAP_TOLERANCE) => {
    const subpaths = [];

    for (const ring of rings) {
        const points = [];

        for (const pair of ring) {
            const [x, y] = project(pair[0], pair[1]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

            const last = points[points.length - 1];
            if (
                last &&
                tolerance > 0 &&
                Math.abs(x - last[0]) < tolerance &&
                Math.abs(y - last[1]) < tolerance
            ) {
                continue;
            }

            points.push([x, y]);
        }

        const first = points[0];
        const last = points[points.length - 1];
        if (
            points.length > 1 &&
            first[0] === last[0] &&
            first[1] === last[1]
        ) {
            points.pop();
        }

        if (points.length < 3) continue;

        const commands = points
            .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`)
            .join('');

        subpaths.push(`${commands}Z`);
    }

    return subpaths.join('');
};
