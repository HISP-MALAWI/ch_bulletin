import {
    MAX_MAP_ZOOM,
    MIN_MAP_ZOOM,
    buildMapLayout,
    projectToWorld,
} from './districtMapTiles';

const square = (lon, lat, size = 1) => [
    [lon, lat],
    [lon + size, lat],
    [lon + size, lat - size],
    [lon, lat - size],
    [lon, lat],
];

const polygon = (rings) => ({ type: 'Polygon', coordinates: rings });

const features = [
    { id: 'north', geometry: polygon([square(33, -10)]) },
    { id: 'south', geometry: polygon([square(33, -11)]) },
];

const commands = (d, letter) => (d.match(new RegExp(letter, 'g')) || []).length;

const covers = (tile, x, y) =>
    x >= tile.x && x <= tile.x + tile.size && y >= tile.y && y <= tile.y + tile.size;

describe('projectToWorld', () => {
    it('puts the equator and prime meridian at the centre of the zoom-0 world', () => {
        expect(projectToWorld(0, 0)).toEqual([128, 128]);
    });

    it('increases y southwards, as SVG does', () => {
        expect(projectToWorld(0, 10)[1]).toBeLessThan(projectToWorld(0, 0)[1]);
        expect(projectToWorld(0, -10)[1]).toBeGreaterThan(projectToWorld(0, 0)[1]);
    });

    it('clamps coordinates to the square the tile scheme covers', () => {
        expect(projectToWorld(0, 90)[1]).toBeCloseTo(0, 6);
        expect(projectToWorld(0, -90)[1]).toBeCloseTo(256, 6);
        expect(projectToWorld(400, 0)[0]).toBe(256);
        expect(projectToWorld(-400, 0)[0]).toBe(0);
    });
});

describe('buildMapLayout', () => {
    it('needs a drawable feature and a usable viewport', () => {
        expect(buildMapLayout([])).toBeNull();
        expect(buildMapLayout(features, { width: 0 })).toBeNull();
        expect(buildMapLayout(features, { height: -1 })).toBeNull();
        expect(buildMapLayout(features, { padding: -1 })).toBeNull();
        // padding wider than the box
        expect(buildMapLayout(features, { width: 20, height: 20, padding: 18 })).toBeNull();
    });

    it('returns null for a single point, which has no extent to fit', () => {
        expect(buildMapLayout([
            { id: 'hospital', geometry: { type: 'Point', coordinates: [33.5, -10.5] } },
        ])).toBeNull();
    });

    it('fits every feature into the viewport and draws one path each', () => {
        const layout = buildMapLayout(features, { width: 360, height: 460 });

        expect(layout.viewBox).toBe('0 0 360 460');
        expect(layout.width).toBe(360);
        expect(layout.height).toBe(460);
        expect(layout.areas.map(({ id }) => id).sort()).toEqual(['north', 'south']);
        layout.areas.forEach(({ d }) => {
            expect(d).toContain('M');
            expect(d).toContain('Z');
            expect(d).not.toContain('NaN');
        });
    });

    it('keeps polygons and hospitals apart, and drops a geometry it cannot draw', () => {
        const layout = buildMapLayout([
            ...features,
            { id: 'hospital', geometry: { type: 'Point', coordinates: [33.5, -10.5] } },
            { id: 'line', geometry: { type: 'LineString', coordinates: [[33, -10], [34, -11]] } },
        ], { width: 360, height: 460 });

        expect(layout.areas).toHaveLength(2);
        expect(layout.points).toEqual([
            expect.objectContaining({ id: 'hospital' }),
        ]);
        expect(Number.isFinite(layout.points[0].x)).toBe(true);
        expect(Number.isFinite(layout.points[0].y)).toBe(true);
    });

    it('thins vertices that would land on the same pixel', () => {
        const dense = [];
        for (let index = 0; index <= 200; index += 1) {
            dense.push([33 + index * 0.0001, -10]);
        }
        dense.push([34, -10], [34, -11], [33, -11], [33, -10]);

        const layout = buildMapLayout(
            [{ id: 'dense', geometry: polygon([dense]) }],
            { width: 360, height: 460 }
        );

        // The 200 points cover a fifth of a degree, so most land within half a
        // pixel of their neighbour and are dropped.
        expect(commands(layout.areas[0].d, 'L')).toBeLessThan(50);
    });

    it('requests a small, bounded grid of OSM tiles that covers the viewport', () => {
        const layout = buildMapLayout(features, { width: 360, height: 460 });

        expect(layout.tiles.length).toBeGreaterThan(0);
        expect(layout.tiles.length).toBeLessThanOrEqual(16);

        layout.tiles.forEach((tile) => {
            expect(tile.href).toMatch(
                /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/
            );
            const [zoom, x, y] = tile.key.split('/').map(Number);
            expect(Number.isInteger(zoom)).toBe(true);
            expect(zoom).toBeGreaterThanOrEqual(0);
            expect(zoom).toBeLessThanOrEqual(19);
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThan(2 ** zoom);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThan(2 ** zoom);
            expect(tile.size).toBeGreaterThanOrEqual(256);
            expect(tile.size).toBeLessThanOrEqual(512);
        });

        expect(layout.tiles.some((tile) => covers(tile, 0, 0))).toBe(true);
        expect(layout.tiles.some((tile) => covers(tile, 360, 460))).toBe(true);
    });

    it('keeps the viewBox fixed while zoom changes the drawing and the tiles', () => {
        const fit = buildMapLayout(features, { width: 360, height: 460 });
        const zoomed = buildMapLayout(features, {
            width: 360,
            height: 460,
            zoomLevel: 2,
        });

        expect(zoomed.viewBox).toBe(fit.viewBox);
        expect(zoomed.areas[0].d).not.toBe(fit.areas[0].d);
        expect(zoomed.tiles).not.toEqual(fit.tiles);
    });

    it('documents the zoom range the widget clamps to', () => {
        expect(MIN_MAP_ZOOM).toBeLessThan(0);
        expect(MAX_MAP_ZOOM).toBeGreaterThan(0);
    });
});
