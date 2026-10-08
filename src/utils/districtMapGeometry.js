import getOrgUnitCentroid from './getCentroid';

// The drawing is a portrait of a country, so it is measured in hundreds of
// units rather than thousands: every number in the returned path data is one of
// these, rounded to a tenth.
export const MAP_HEIGHT = 520;
export const MAP_MAX_WIDTH = 320;
export const MAP_PADDING = 10;

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
 * An equirectangular projection over the given bounds, fitted into a box of the
 * given height and no more than the given width.
 *
 * Longitude is compressed by the cosine of the middle latitude, without which
 * Malawi comes out stretched sideways — a degree of longitude is only as long
 * as a degree of latitude at the equator. The box is fit by whichever axis runs
 * out first, so a wide selection is bounded by the width and a tall one by the
 * height, and the bounds come from the geometries actually being drawn: that is
 * what makes the map zoom to a region when one is selected.
 *
 * Returns null rather than a projection that would divide by zero, which is the
 * only way this can produce NaN in the path data.
 */
export const createProjection = (bounds, {
    height = MAP_HEIGHT,
    maxWidth = MAP_MAX_WIDTH,
    padding = MAP_PADDING,
} = {}) => {
    if (!bounds) return null;

    const meanLat = (bounds.latMin + bounds.latMax) / 2;
    const lonScale = Math.cos((meanLat * Math.PI) / 180);
    const spanX = (bounds.lonMax - bounds.lonMin) * lonScale;
    const spanY = bounds.latMax - bounds.latMin;

    if (!Number.isFinite(spanX) || !Number.isFinite(spanY)) return null;
    // Every coordinate is the same point, so there is no scale that would draw
    // it and no reason to try.
    if (spanX <= 0 && spanY <= 0) return null;

    const innerWidth = Math.max(maxWidth - 2 * padding, 1);
    const innerHeight = Math.max(height - 2 * padding, 1);

    const scale = Math.min(
        spanX > 0 ? innerWidth / spanX : Infinity,
        spanY > 0 ? innerHeight / spanY : Infinity
    );
    if (!Number.isFinite(scale) || scale <= 0) return null;

    const project = (lon, lat) => [
        padding + (lon - bounds.lonMin) * lonScale * scale,
        // Latitude grows northwards and SVG y grows downwards, so the axis is
        // flipped by measuring down from the northern edge.
        padding + (bounds.latMax - lat) * scale,
    ];

    const width = spanX * scale + 2 * padding;
    const drawnHeight = spanY * scale + 2 * padding;

    return {
        project,
        viewBox: `0 0 ${round(width)} ${round(drawnHeight)}`,
        width,
        height: drawnHeight,
    };
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

/**
 * Where a district's name goes if it is labelled: its centroid, pushed through
 * the same projection as its outline so the two cannot disagree.
 *
 * A centroid can fall outside a concave polygon, which is tolerable here
 * because the label is a convenience — the table beside the map names every
 * district — and not the only way to read it.
 */
const readAnchor = (geometry, project) => {
    let centroid;

    try {
        centroid = getOrgUnitCentroid(geometry);
    } catch (error) {
        // The centroid reader indexes into the first ring without checking it
        // is there, and a geometry can carry a ring the outline builder skipped
        // as too small to draw. A label is not worth failing the map over.
        return null;
    }

    if (!centroid || !Number.isFinite(centroid.lon) || !Number.isFinite(centroid.lat)) {
        return null;
    }

    const [x, y] = project(centroid.lon, centroid.lat);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    return { x: round(x), y: round(y) };
};

/**
 * Turn the boundary features DHIS2 returns into SVG for the districts being
 * reported on.
 *
 * Features and districts are joined by id, which is the organisation unit uid
 * in both, so a feature for a district outside the selection is ignored and a
 * district with no boundary comes back in `missing` — which the section says
 * out loud rather than quietly drawing one district fewer.
 *
 * `viewBox` is null when nothing can be drawn, which is the signal to fall back
 * to the tile grid.
 *
 * @returns {{
 *   viewBox: string | null,
 *   areas: Array<{ id: string, d: string, anchor: {x: number, y: number} | null }>,
 *   points: Array<{ id: string, x: number, y: number }>,
 *   missing: string[],
 * }}
 */
export const buildDistrictMap = ({
    features = [],
    districts = [],
    height = MAP_HEIGHT,
    maxWidth = MAP_MAX_WIDTH,
    padding = MAP_PADDING,
    tolerance = MAP_TOLERANCE,
} = {}) => {
    const nothingDrawable = {
        viewBox: null,
        areas: [],
        points: [],
        missing: districts.map((district) => district.id),
    };

    const districtIds = new Set(districts.map((district) => district.id));
    const wanted = features.filter((feature) => districtIds.has(feature?.id));

    const projection = createProjection(
        readBounds(wanted.map((feature) => feature.geometry)),
        { height, maxWidth, padding }
    );

    if (!projection) return nothingDrawable;

    const areas = [];
    const points = [];
    const drawn = new Set();

    for (const feature of wanted) {
        const geometry = feature.geometry;
        const parts = readGeometryParts(geometry);
        if (!parts) continue;

        // A hospital is a point on the ground, not an area, and the level that
        // holds Malawi's districts holds five of them.
        if (parts.point) {
            const [x, y] = projection.project(parts.point[0], parts.point[1]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

            points.push({ id: feature.id, x: round(x), y: round(y) });
            drawn.add(feature.id);
            continue;
        }

        const d = ringsToPath(parts.rings, projection.project, tolerance);
        // Belt and braces. A path carrying NaN draws nothing in the browser and
        // takes the rest of the raster down with it in the PDF, so one district
        // is dropped rather than the whole map.
        if (!d || d.includes('NaN')) continue;

        areas.push({
            id: feature.id,
            d,
            anchor: readAnchor(geometry, projection.project),
        });
        drawn.add(feature.id);
    }

    if (areas.length === 0 && points.length === 0) return nothingDrawable;

    return {
        viewBox: projection.viewBox,
        // The drawn size in viewBox units, which the SVG carries as its width
        // and height attributes. Without them the element is sized by
        // percentages, and an SVG that is rasterised as a standalone image — as
        // html2canvas does — has no parent to resolve those against.
        width: round(projection.width),
        height: round(projection.height),
        areas,
        points,
        missing: districts
            .filter((district) => !drawn.has(district.id))
            .map((district) => district.id),
    };
};
