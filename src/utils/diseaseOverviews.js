// Hand-written context for a disease: one sentence on when it climbs and where
// in the country it bites hardest, which is how the reference bulletin opens
// each hazard.
//
// This is authored copy and there is nowhere in DHIS2 to keep it. The settings
// store holds data-element references and numbers only, and the rest of the
// prose in `src/utils` — districtActions, for one — is generated from climate
// and forecast signals rather than written about a disease. So it lives here, in
// one place, to be edited deliberately.
//
// Deliberately not routed through i18n, matching the generated prose elsewhere.
// If the bulletin is ever translated, this is the file that has to change.

const OVERVIEWS = [
    {
        match: /malaria/i,
        description:
            'Transmission rises with the first rains and peaks from January to April. ' +
            'The lakeshore and lower Shire valley are warm and low-lying, so risk there is highest.',
    },
];

/**
 * The copy for a mapped disease, matched on the mapping's display name the same
 * way every other malaria lookup is. Returns null when there is nothing written
 * for that name, and the section is left out rather than shown empty.
 */
export const getDiseaseOverview = (displayName) =>
    OVERVIEWS.find((overview) => overview.match.test(String(displayName || ''))) || null;
