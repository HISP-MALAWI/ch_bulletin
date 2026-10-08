import {
    buildDistrictMap,
    createProjection,
    readBounds,
    readGeometryParts,
    ringsToPath,
} from './districtMapGeometry';

// A closed square, one degree on a side, with its north-west corner at the
// given point. Rings run the way DHIS2 sends them: the last pair repeats the
// first.
const square = (lon, lat, size = 1) => [
    [lon, lat],
    [lon + size, lat],
    [lon + size, lat - size],
    [lon, lat - size],
    [lon, lat],
];

const polygon = (rings) => ({ type: 'Polygon', coordinates: rings });

const commands = (d, letter) => (d.match(new RegExp(letter, 'g')) || []).length;

// Every drawing the widget can be handed goes through this: a path carrying NaN
// draws nothing in the browser and takes the rest of the raster down with it in
// the PDF, so it is asserted everywhere rather than in one test.
const expectNoNaN = (map) => {
    expect(map.viewBox ?? '').not.toContain('NaN');
    map.areas.forEach((area) => expect(area.d).not.toContain('NaN'));
    map.points.forEach((point) => {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
    });
    map.areas.forEach((area) => {
        if (area.anchor) {
            expect(Number.isFinite(area.anchor.x)).toBe(true);
            expect(Number.isFinite(area.anchor.y)).toBe(true);
        }
    });
};

describe('readGeometryParts', () => {
    it('reads a polygon as rings and a point as a point', () => {
        expect(readGeometryParts(polygon([square(0, 0)])).rings).toHaveLength(1);
        expect(readGeometryParts({ type: 'Point', coordinates: [1, 2] }).point).toEqual([1, 2]);
    });

    it('flattens a multipolygon into every ring it holds', () => {
        const multi = {
            type: 'MultiPolygon',
            coordinates: [[square(0, 0)], [square(2, 0)]],
        };

        expect(readGeometryParts(multi).rings).toHaveLength(2);
    });

    it('refuses a geometry it cannot draw', () => {
        expect(readGeometryParts(null)).toBeNull();
        expect(readGeometryParts({ type: 'LineString', coordinates: [[0, 0], [1, 1]] })).toBeNull();
        // Two points cannot enclose an area, so the ring is not one.
        expect(readGeometryParts(polygon([[[0, 0], [1, 1]]]))).toBeNull();
    });
});

describe('readBounds', () => {
    it('spans every ring of every geometry, points included', () => {
        expect(readBounds([polygon([square(33, -10)]), { type: 'Point', coordinates: [36, -17] }]))
            .toEqual({ lonMin: 33, lonMax: 36, latMin: -17, latMax: -10 });
    });

    it('returns nothing when there is nothing finite to measure', () => {
        expect(readBounds([])).toBeNull();
        expect(readBounds([{ type: 'Polygon', coordinates: [[['a', 'b']]] }])).toBeNull();
    });
});

describe('createProjection', () => {
    it('compresses longitude by the cosine of the middle latitude', () => {
        // A degree of longitude is half a degree of latitude at 60° north, so a
        // one-degree square there is drawn half as wide as it is tall.
        const projection = createProjection(
            { lonMin: 0, lonMax: 1, latMin: 59.5, latMax: 60.5 },
            { height: 100, maxWidth: 100, padding: 0 }
        );

        expect(projection.width).toBeCloseTo(50, 3);
        expect(projection.height).toBeCloseTo(100, 3);
        expect(projection.width / projection.height).toBeCloseTo(0.5, 3);
    });

    it('puts the north at the top, because SVG y grows downwards', () => {
        const projection = createProjection(
            { lonMin: 0, lonMax: 1, latMin: 0, latMax: 1 },
            { height: 100, maxWidth: 100, padding: 0 }
        );

        const [, north] = projection.project(0, 1);
        const [, south] = projection.project(0, 0);

        expect(north).toBeLessThan(south);
        expect(north).toBe(0);
        expect(south).toBe(100);
    });

    it('fits a wide selection by its width rather than letting it overflow', () => {
        const projection = createProjection(
            { lonMin: 0, lonMax: 10, latMin: 0, latMax: 1 },
            { height: 100, maxWidth: 100, padding: 0 }
        );

        expect(projection.width).toBeCloseTo(100, 3);
        expect(projection.height).toBeCloseTo(10, 3);
    });

    it('gives up rather than dividing by zero', () => {
        // Every coordinate the same point: there is no scale that would draw it.
        expect(createProjection({ lonMin: 5, lonMax: 5, latMin: 5, latMax: 5 })).toBeNull();
        expect(createProjection(null)).toBeNull();
    });
});

describe('ringsToPath', () => {
    const projection = createProjection(
        { lonMin: 0, lonMax: 1, latMin: 0, latMax: 1 },
        { height: 100, maxWidth: 100, padding: 0 }
    );

    it('closes a ring that arrived closed without repeating its first vertex', () => {
        const d = ringsToPath([square(0, 1)], projection.project, 0);

        // Four corners, so three line commands after the move, and no fourth.
        expect(commands(d, 'M')).toBe(1);
        expect(commands(d, 'L')).toBe(3);
        expect(d.endsWith('Z')).toBe(true);
    });

    it('drops vertices that land on the same spot once drawn', () => {
        const dense = [
            [0, 1],
            [0, 0.999999],
            [0, 0.5],
            [1, 0.5],
            [1, 0],
            [0, 0],
            [0, 1],
        ];

        expect(commands(ringsToPath([dense], projection.project, 0), 'L')).toBe(5);
        // The nearly-identical pair is within half a unit of each other and one
        // of them goes.
        expect(commands(ringsToPath([dense], projection.project, 0.5), 'L')).toBe(4);
    });

    it('drops a ring that would not survive being drawn', () => {
        expect(ringsToPath([], projection.project)).toBe('');
        expect(ringsToPath([[[0, 0], [1, 1]]], projection.project)).toBe('');
        // Thinned below a triangle there is nothing left to enclose.
        expect(ringsToPath([square(0, 1)], () => [0, 0], 0.5)).toBe('');
    });
});

describe('buildDistrictMap', () => {
    const districts = [{ id: 'a' }, { id: 'b' }];
    const feature = (id, geometry) => ({ id, geometry });

    it('draws every district it was given a boundary for', () => {
        const map = buildDistrictMap({
            features: [feature('a', polygon([square(0, 0)]))],
            districts,
            height: 100,
            maxWidth: 100,
            padding: 0,
        });

        expect(map.areas.map(({ id }) => id)).toEqual(['a']);
        expect(map.missing).toEqual(['b']);
        expect(map.viewBox).not.toBeNull();
        expectNoNaN(map);
    });

    it('ignores a feature for a district that is not being reported on', () => {
        const map = buildDistrictMap({
            features: [
                feature('a', polygon([square(0, 0)])),
                feature('elsewhere', polygon([square(20, 20)])),
            ],
            districts: [{ id: 'a' }],
            height: 100,
            maxWidth: 100,
            padding: 0,
        });

        expect(map.areas.map(({ id }) => id)).toEqual(['a']);
        // The far-away district is not in the drawing, so it cannot stretch it:
        // district 'a' still fills the box.
        expect(map.width).toBe(100);
        expect(map.height).toBe(100);
    });

    it('fits the drawing to the districts it is actually given', () => {
        const near = feature('a', polygon([square(0, 0)]));
        const far = feature('b', polygon([square(0, 8)]));

        const options = { districts, height: 100, maxWidth: 100, padding: 0 };
        const one = buildDistrictMap({ features: [near], ...options });
        const both = buildDistrictMap({ features: [near, far], ...options });

        // On its own the square spans the box.
        expect(one.width).toBe(100);
        expect(one.height).toBe(100);

        // Nine degrees of latitude have to fit the same height once the northern
        // district joins it, so the square is drawn a ninth of the width. This
        // is what makes the map zoom when a region is selected.
        expect(both.height).toBe(100);
        expect(both.width).toBe(11.1);
    });

    it('carries the drawn size for the SVG to be given as its width and height', () => {
        const map = buildDistrictMap({
            features: [feature('a', polygon([square(0, 0)]))],
            districts: [{ id: 'a' }],
            height: 100,
            maxWidth: 100,
            padding: 0,
        });

        expect(map.width).toBe(100);
        expect(map.height).toBe(100);
        expect(map.viewBox).toBe('0 0 100 100');
    });

    it('emits every ring of a polygon with a hole, and every island of a multipolygon', () => {
        const holed = buildDistrictMap({
            features: [feature('a', polygon([square(0, 0, 2), square(0.5, 0.5, 1)]))],
            districts: [{ id: 'a' }],
            height: 100,
            maxWidth: 100,
            padding: 0,
        });

        expect(commands(holed.areas[0].d, 'M')).toBe(2);

        const islands = buildDistrictMap({
            features: [feature('a', { type: 'MultiPolygon', coordinates: [[square(0, 0)], [square(2, 0)]] })],
            districts: [{ id: 'a' }],
            height: 100,
            maxWidth: 100,
            padding: 0,
        });

        expect(commands(islands.areas[0].d, 'M')).toBe(2);
        expect(islands.points).toEqual([]);
    });

    it('draws a point as a marker rather than an area', () => {
        const map = buildDistrictMap({
            features: [
                feature('a', polygon([square(0, 0)])),
                feature('b', { type: 'Point', coordinates: [0.5, 0.5] }),
            ],
            districts,
            height: 100,
            maxWidth: 100,
            padding: 0,
        });

        expect(map.areas.map(({ id }) => id)).toEqual(['a']);
        expect(map.points.map(({ id }) => id)).toEqual(['b']);
        expect(map.missing).toEqual([]);
        expectNoNaN(map);
    });

    it('gives an area an anchor to label it by, or none at all', () => {
        const map = buildDistrictMap({
            features: [feature('a', polygon([square(0, 0)]))],
            districts: [{ id: 'a' }],
            height: 100,
            maxWidth: 100,
            padding: 0,
        });

        const { anchor } = map.areas[0];
        expect(anchor.x).toBeGreaterThan(0);
        expect(anchor.x).toBeLessThan(100);
        expect(anchor.y).toBeGreaterThan(0);
        expect(anchor.y).toBeLessThan(100);
    });

    it('falls back to the tiles when there is nothing it can draw', () => {
        const empty = buildDistrictMap({ features: [], districts });

        expect(empty.viewBox).toBeNull();
        expect(empty.areas).toEqual([]);
        expect(empty.points).toEqual([]);
        expect(empty.missing).toEqual(['a', 'b']);
    });

    it('never produces NaN, whatever it is handed', () => {
        const awkward = [
            buildDistrictMap({}),
            buildDistrictMap({ features: [], districts }),
            // Every vertex the same point.
            buildDistrictMap({
                features: [feature('a', polygon([[[1, 1], [1, 1], [1, 1], [1, 1]]]))],
                districts: [{ id: 'a' }],
            }),
            // Coordinates that are not numbers.
            buildDistrictMap({
                features: [feature('a', polygon([[[0, 0], [null, 1], [1, 'x'], [1, 0], [0, 1]]]))],
                districts: [{ id: 'a' }],
            }),
            // A point with nothing to measure against.
            buildDistrictMap({
                features: [feature('a', { type: 'Point', coordinates: [34, -13] })],
                districts: [{ id: 'a' }],
            }),
            // A geometry type this does not know.
            buildDistrictMap({
                features: [feature('a', { type: 'GeometryCollection', geometries: [] })],
                districts: [{ id: 'a' }],
            }),
        ];

        awkward.forEach(expectNoNaN);
    });

    it('treats a selection with no extent to draw in as nothing drawable', () => {
        // One unit whose geometry is a single point and nothing else: there is
        // no box to fit it into, so the section falls back to the tiles rather
        // than inventing a scale. Unreachable today — a lone level-3 unit gets
        // the forecast table instead of the map — but the fallback is the point.
        const map = buildDistrictMap({
            features: [feature('a', { type: 'Point', coordinates: [34, -13] })],
            districts: [{ id: 'a' }],
        });

        expect(map.viewBox).toBeNull();
        expect(map.points).toEqual([]);
        expect(map.missing).toEqual(['a']);
    });
});
