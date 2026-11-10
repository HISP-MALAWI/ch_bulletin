/**
 * Level-3 organisation units with their boundaries, for the district risk map.
 *
 * Level 3 is where Malawi's districts live and is the level the district risk
 * section reports on. `geometry` is about 2 MB across the 34 units, which is
 * why this is its own query rather than another field on `homeDataQuery`: the
 * Home page, the editor and the preview load the organisation-unit hierarchy
 * without geometry, and the map requests these boundaries only when needed.
 *
 * The five level-3 units whose geometry is a Point are hospitals, not
 * districts. They are drawn as markers rather than areas by
 * `buildMapLayout`, so they are deliberately not filtered out here — the
 * counts around them have always included them.
 */
export const districtBoundariesQuery = {
    boundaries: {
        resource: 'organisationUnits',
        params: {
            filter: ['level:eq:3'],
            fields: ['id,displayName,geometry'],
            paging: false,
        },
    },
};
