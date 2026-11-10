import { districtMapQuery } from '../Pages/services/getDistrictMap';
import {
    clearSessionResourceCache,
    getSessionCachedResource,
} from './sessionResourceCache';

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
const cacheKeys = new Set();
const cacheKeyFor = (uid) => `metadata:district-map:${uid}`;

export const clearDistrictMapCache = () => {
    cacheKeys.forEach((key) => clearSessionResourceCache(key));
    cacheKeys.clear();
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

    if (!engine || typeof engine.query !== 'function') return null;

    const cacheKey = cacheKeyFor(uid);
    cacheKeys.add(cacheKey);

    try {
        const resolved = await getSessionCachedResource(cacheKey, async () => {
            const response = await engine.query(districtMapQuery(uid));
            const map = response?.map;

            // Undefined responses are not cached, so a failed read can retry.
            if (!map?.id) return undefined;

            return {
                id: map.id,
                name: map.displayName || map.name || map.id,
                attribution: basemapAttribution(map.basemap),
            };
        });
        return resolved || null;
    } catch (error) {
        console.error('Failed to read the bulletin DHIS2 map:', error);
        return null;
    }
};
