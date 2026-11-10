/**
 * The saved maps an author can put in a bulletin's district risk section.
 *
 * Only what the picker needs: a uid to embed and a name to choose by. The map
 * itself is deliberately not fetched here — the Maps plugin fetches whichever
 * map it is handed the id of, so fetching it as well would be a second copy of
 * the same object and a second way for the two to disagree.
 *
 * This list answers "what maps exist", not "which can this reader open": DHIS2
 * returns every map in the instance whoever owns it, whatever it is shared
 * with. That second question is asked of the chosen map alone, in
 * `getDistrictMap`.
 */
export const mapsQuery = {
    maps: {
        resource: 'maps',
        params: {
            fields: ['id', 'displayName'],
            paging: false,
        },
    },
};
