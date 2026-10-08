import { districtMapQuery } from '../Pages/services/getDistrictMap';

/**
 * The saved DHIS2 maps the session has already read, keyed by uid.
 *
 * Keyed rather than single-valued because the editor and the preview ask for
 * the same map separately, and because the editor holds one bulletin's choice
 * while the author switches between maps to compare them.
 *
 * Only a real answer is stored. A map that cannot be read — no access, deleted
 * between choosing it and opening the bulletin, a network blip — is not
 * remembered as absent, so the next bulletin, or the next render, asks again.
 */
const cached = new Map();

export const clearDistrictMapCache = () => {
    cached.clear();
};

const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

/**
 * Credit for a basemap, or null when we cannot say who to credit.
 *
 * The screen credit comes from the plugin's own attribution control, which is
 * inside the iframe and does not survive into the PDF (§ `districtMapCanvas`) —
 * so the document has to carry it in the caption instead, and a published map
 * with no credit is a licensing problem rather than a missing nicety.
 *
 * Only the app's built-in basemaps are recognised. An instance basemap served
 * from `externalMapLayers` carries terms this app has no way to read, so it gets
 * no guess.
 */
export const basemapAttribution = (basemap) =>
    typeof basemap === 'string' && /^osm/i.test(basemap.trim()) ? OSM_ATTRIBUTION : null;

/**
 * The chosen map as `{ id, name, attribution }`, or null when there is nothing
 * to embed.
 *
 * Null is the section's signal to fall back to the drawing it computes itself,
 * which is why a failed read is not an error the caller has to handle: the map
 * the plugin would have spun on for ever is simply not put in the document.
 */
export const getDistrictMap = async (uid, engine) => {
    if (!uid) return null;

    if (cached.has(uid)) return cached.get(uid);

    if (!engine || typeof engine.query !== 'function') return null;

    try {
        const response = await engine.query(districtMapQuery(uid));
        const map = response?.map;

        // A response with no map in it is a failure wearing the shape of a
        // success, and is not worth remembering.
        if (!map?.id) return null;

        const resolved = {
            id: map.id,
            name: map.displayName || map.name || map.id,
            attribution: basemapAttribution(map.basemap),
        };

        cached.set(uid, resolved);

        return resolved;
    } catch (error) {
        console.error('Failed to read the bulletin DHIS2 map:', error);
        return null;
    }
};
