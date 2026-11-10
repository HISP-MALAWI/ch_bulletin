import {
    MAP_TOLERANCE,
    readBounds,
    readGeometryParts,
    ringsToPath,
} from './districtMapGeometry';

export const TILE_SIZE = 256;
export const MAP_PADDING = 18;
export const MIN_MAP_ZOOM = -3;
export const MAX_MAP_ZOOM = 5;

export const OSM_TILE_URL = (zoom, tileX, tileY) =>
    `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

const round = (value) => Math.round(value * 10) / 10;

/**
 * A longitude/latitude pair as a pixel in the zoom-0 Web Mercator world.
 *
 * The bounds are the standard Web Mercator ones: the projection runs to
 * infinity at the poles, so a coordinate is clamped to the square the tile
 * scheme actually covers. Longitude is clamped too, so a malformed geometry
 * cannot push a path or a tile index off the world.
 */
export const projectToWorld = (longitude, latitude) => {
    const clampedLongitude = Math.max(-180, Math.min(180, Number(longitude)));
    const clampedLatitude = Math.max(
        -85.05112878,
        Math.min(85.05112878, Number(latitude))
    );
    const sinLatitude = Math.sin((clampedLatitude * Math.PI) / 180);

    return [
        ((clampedLongitude + 180) / 360) * TILE_SIZE,
        (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * TILE_SIZE,
    ];
};

const tileRange = (start, end, limit) => {
    const first = Math.max(0, Math.floor(start));
    const last = Math.min(limit, Math.floor(end));

    return first <= last ? [first, last] : null;
};

/**
 * The boundary features fitted into a viewport, as SVG paths, point markers and
 * the OpenStreetMap tiles behind them.
 *
 * The projection is Web Mercator because the tiles are: a district's outline
 * and the coastline under it have to come from the same projection or the two
 * drift apart as you zoom. The fit is computed from the features actually
 * being drawn, and `zoomLevel` is a power-of-two multiplier on that fit, so
 * zoom 0 is always "the whole selection in the box".
 *
 * Tile zoom is chosen independently of that multiplier — whichever integer
 * level keeps a tile between 256 and 512 screen pixels — so the map requests a
 * handful of tiles rather than hundreds of tiny ones at high zoom.
 *
 * Returns `null` when there is nothing that can be drawn: no geometry, a
 * single point with no extent, or a viewport too small to fit inside its own
 * padding. The caller shows an empty state rather than an SVG full of NaN.
 */
export const buildMapLayout = (
    features = [],
    {
        width = 360,
        height = 460,
        padding = MAP_PADDING,
        zoomLevel = 0,
        tolerance = MAP_TOLERANCE,
    } = {}
) => {
    if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        !Number.isFinite(padding) ||
        width <= 0 ||
        height <= 0 ||
        padding < 0
    ) {
        return null;
    }

    const drawable = features.filter((feature) => feature?.geometry);
    if (drawable.length === 0) return null;

    const bounds = readBounds(drawable.map((feature) => feature.geometry));
    if (!bounds) return null;

    // Mercator is monotonic across both axes, so the two corners are enough.
    const [minX, minY] = projectToWorld(bounds.lonMin, bounds.latMax);
    const [maxX, maxY] = projectToWorld(bounds.lonMax, bounds.latMin);
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    if (!(rangeX > 0) || !(rangeY > 0)) return null;

    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;
    if (!(innerWidth > 0) || !(innerHeight > 0)) return null;

    const fitScale = Math.min(innerWidth / rangeX, innerHeight / rangeY);
    const scale = fitScale * 2 ** zoomLevel;
    if (!(scale > 0) || !Number.isFinite(scale)) return null;

    const zoom = Math.max(0, Math.min(19, Math.floor(Math.log2(scale))));
    const tileScale = scale / 2 ** zoom;
    const tileSize = TILE_SIZE * tileScale;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const offsetX = width / 2 - centerX * scale;
    const offsetY = height / 2 - centerY * scale;

    const project = (longitude, latitude) => {
        const [worldX, worldY] = projectToWorld(longitude, latitude);
        return [worldX * scale + offsetX, worldY * scale + offsetY];
    };

    const lastTileIndex = 2 ** zoom - 1;
    const xRange = tileRange(-offsetX / tileSize, (width - offsetX) / tileSize, lastTileIndex);
    const yRange = tileRange(-offsetY / tileSize, (height - offsetY) / tileSize, lastTileIndex);
    const tiles = [];

    if (xRange && yRange) {
        for (let tileX = xRange[0]; tileX <= xRange[1]; tileX += 1) {
            for (let tileY = yRange[0]; tileY <= yRange[1]; tileY += 1) {
                tiles.push({
                    key: `${zoom}/${tileX}/${tileY}`,
                    href: OSM_TILE_URL(zoom, tileX, tileY),
                    x: round(tileX * tileSize + offsetX),
                    y: round(tileY * tileSize + offsetY),
                    size: round(tileSize),
                });
            }
        }
    }

    const areas = [];
    const points = [];

    drawable.forEach((feature) => {
        const parts = readGeometryParts(feature.geometry);
        if (!parts) return;

        if (parts.point) {
            const [x, y] = project(parts.point[0], parts.point[1]);
            if (Number.isFinite(x) && Number.isFinite(y)) {
                points.push({ id: feature.id, x: round(x), y: round(y) });
            }
            return;
        }

        const d = ringsToPath(parts.rings, project, tolerance);
        // A path carrying NaN draws nothing in the browser and takes the rest
        // of the raster down with it in the PDF, so one district is dropped
        // rather than the whole map.
        if (!d || d.includes('NaN')) return;

        areas.push({ id: feature.id, d });
    });

    if (areas.length === 0 && points.length === 0) return null;

    return {
        viewBox: `0 0 ${round(width)} ${round(height)}`,
        width: round(width),
        height: round(height),
        areas,
        points,
        tiles,
    };
};
