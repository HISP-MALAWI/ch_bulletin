import { districtBoundariesQuery } from '../Pages/services/getDistrictBoundaries';

/**
 * The national level-3 boundaries for the session, once they have been fetched.
 *
 * The data engine keeps no response cache, and this response is about 2 MB, so
 * without this every open of a bulletin preview would fetch the lot again. The
 * list is the whole country whichever region is selected; the map colours the
 * districts in the selection and greys the rest, so one cache entry serves
 * every selection.
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
 * The boundaries the caller's organisation units already carry, or null when
 * they are not all there — in which case they have to be fetched.
 *
 * The editor's organisation-unit query asks for `geometry`, so its level-3
 * units arrive carrying it and its map makes no request at all. The preview
 * loads its units without geometry, so it is the preview that pays for the
 * request. Mixed input counts as absent: half from the caller and half from the
 * server would be two sources of truth in one drawing.
 */
export const readNationalBoundaries = (orgUnits = []) => {
    const level3 = orgUnits.filter((unit) => Number(unit?.level) === 3 && unit?.id);

    if (level3.length === 0) return null;

    return level3.every((unit) => unit.geometry)
        ? level3.map(({ id, geometry, displayName }) => ({ id, geometry, displayName }))
        : null;
};

/**
 * The national level-3 boundaries, from the cache or DHIS2.
 *
 * Returns `{ boundaries, error }` rather than throwing so the map can say that
 * the request failed rather than showing a placeholder for ever. A response
 * without the list is a failure wearing the shape of a success and is not
 * cached; an empty list is a real answer and is.
 */
export const getNationalDistrictBoundaries = async (engine) => {
    if (cached) return { boundaries: cached, error: null };

    if (!engine || typeof engine.query !== 'function') {
        return { boundaries: [], error: null };
    }

    try {
        const response = await engine.query(districtBoundariesQuery);
        const boundaries = response?.boundaries?.organisationUnits;

        if (!Array.isArray(boundaries)) {
            return {
                boundaries: [],
                error: new Error('DHIS2 returned no district boundary list.'),
            };
        }

        cached = boundaries
            .filter((unit) => unit?.geometry)
            .map(({ id, geometry, displayName }) => ({ id, geometry, displayName }));

        return { boundaries: cached, error: null };
    } catch (error) {
        console.error('Failed to fetch district boundaries:', error);
        return { boundaries: [], error };
    }
};
