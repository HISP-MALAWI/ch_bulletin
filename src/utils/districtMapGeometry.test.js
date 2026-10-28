import {
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

describe('ringsToPath', () => {
    // A flat 100 × 100 projection of a one-degree square: east is +x, north is
    // -y. `createProjection` lived here until the map moved to Web Mercator;
    // the path builder only needs a function of (lon, lat).
    const project = (lon, lat) => [lon * 100, (1 - lat) * 100];

    it('closes a ring that arrived closed without repeating its first vertex', () => {
        const d = ringsToPath([square(0, 1)], project, 0);

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

        expect(commands(ringsToPath([dense], project, 0), 'L')).toBe(5);
        // The nearly-identical pair is within half a unit of each other and one
        // of them goes.
        expect(commands(ringsToPath([dense], project, 0.5), 'L')).toBe(4);
    });

    it('drops a ring that would not survive being drawn', () => {
        expect(ringsToPath([], project)).toBe('');
        expect(ringsToPath([[[0, 0], [1, 1]]], project)).toBe('');
        // Thinned below a triangle there is nothing left to enclose.
        expect(ringsToPath([square(0, 1)], () => [0, 0], 0.5)).toBe('');
    });
});
