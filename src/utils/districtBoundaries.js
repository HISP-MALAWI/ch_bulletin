import { districtBoundariesQuery } from '../Pages/services/getDistrictBoundaries';

/**
 * The boundaries for the session, once they have been fetched.
 *
 * The data engine keeps no response cache, and this response is about 2 MB, so
 * without this every open of a bulletin preview would fetch the lot again. The
 * list is the whole country whichever region is selected, because the drawing
 * filters it by the districts it is given — so one cache entry serves every
 * selection.
 *
 * Only a real answer is stored. A request that fails leaves this null and is
 * tried again next time, rather than being remembered for the rest of the
 * session.
 */
let cached = null;

export const clearDistrictBoundaryCache = () => {
    cached = null;
};

/**
 * The boundaries the districts are already carrying, or null when they are not
 * all there — in which case they have to be fetched.
 *
 * Read during render rather than in an effect, so a page whose units came with
 * their geometry draws its map on the first pass instead of flashing a loading
 * state at a request it never makes. Mixed input counts as absent: half from
 * the caller and half from the server would be two sources of truth in one
 * drawing.
 */
export const readLocalBoundaries = (districts = []) =>
    districts.length > 0 && districts.every((district) => district?.geometry)
        ? districts.map(({ id, geometry }) => ({ id, geometry }))
        : null;

/**
 * The boundary features to draw, as `{ id, geometry }`, or an empty list when
 * none could be had.
 *
 * The editor's organisation unit query already asks for `geometry`, so its
 * districts arrive carrying it and this fetches nothing at all. It is the
 * preview — which loads its units without geometry, and is the page the PDF is
 * exported from — that pays for the request.
 */
export const getDistrictBoundaries = async (districts = [], engine) => {
    const local = readLocalBoundaries(districts);
    if (local) return local;

    if (districts.filter((district) => district?.id).length === 0) return [];

    if (cached) return cached;

    if (!engine || typeof engine.query !== 'function') return [];

    try {
        const response = await engine.query(districtBoundariesQuery);
        const boundaries = response?.boundaries?.organisationUnits;

        // A response without the list is a failure wearing the shape of a
        // success, and is not worth remembering.
        if (!Array.isArray(boundaries)) return [];

        cached = boundaries
            .filter((unit) => unit?.geometry)
            .map(({ id, geometry }) => ({ id, geometry }));

        return cached;
    } catch (error) {
        console.error('Failed to fetch district boundaries:', error);
        return [];
    }
};
