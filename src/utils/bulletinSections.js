/**
 * The order the document's sections are rendered in, and which of them are
 * shown at all.
 *
 * This module is the whole model and nothing else: no labels, no JSX, no
 * i18n. The labels are literals at the call site in
 * `widgets/sectionsConfigWidget.jsx`, because the catalogue scanner cannot
 * follow an `i18n.t` through a variable, and keeping them here would mean
 * either a module-scope translation call — which the rest of the app never
 * does — or a label the scanner silently drops.
 *
 * What is stored is only ids and booleans, so a stored config can never
 * contradict this file about what a section is.
 */

// `row` marks sections that share a line of the document. The only pair today is
// the weather forecast beside the seasonal climate chart, which is a single
// `.bulletinTwoColumnGrid` wrapper with two children rather than anything the
// data knows about — so the grouping has to be stated here.
//
// Order here is the document's default order, and is what a fresh install and an
// unsaved Settings page both produce.
//
// `highlights` is the document's executive summary. The two used to be separate
// sections — a rich-text one the author wrote and a list of drafted lines — and
// they read as the same thing twice, so the drafted one was folded into this
// one. The id is kept because it is what stored configs already carry, and it is
// the visible one of the pair: reusing `executiveSummary` would hand every
// install that has ever saved Settings a section its stored entry marks hidden.
const SECTION_DEFS = [
    { id: 'malariaOverview' },
    { id: 'forecastSummary' },
    { id: 'highlights' },
    { id: 'currentMalariaSituation', visible: false },
    { id: 'malariaForecast' },
    { id: 'historicalClimate' },
    { id: 'weatherForecast', row: 'weather' },
    { id: 'seasonalClimate', row: 'weather' },
    { id: 'districtRisk' },
    { id: 'districtActions' },
];

const defById = new Map(SECTION_DEFS.map((def) => [def.id, def]));

export const sectionDef = (id) => defById.get(id) || null;

export const DEFAULT_SECTIONS = SECTION_DEFS.map(({ id, visible }) => ({
    id,
    visible: visible !== false,
}));

/**
 * Merges a stored section list with the registry.
 *
 * There is no versioning anywhere in this settings object, and the key is
 * absent on every install until Settings is saved once, so this function is the
 * entire migration story:
 *
 * - an id the registry no longer knows is dropped, so a section removed in a
 *   later release cannot resurrect an empty block;
 * - a registry id the stored config predates is inserted at the position it was
 *   designed to sit in, not appended after whatever the config ends with;
 * - a repeated id keeps its first position only.
 *
 * Anything that is not an array — including the absent key — gives the defaults.
 */
export const resolveSections = (stored) => {
    if (!Array.isArray(stored)) {
        return DEFAULT_SECTIONS;
    }

    const resolved = [];
    const seen = new Set();

    stored.forEach((entry) => {
        const id = entry?.id;

        if (!defById.has(id) || seen.has(id)) {
            return;
        }

        seen.add(id);
        // Anything present is visible unless it says otherwise, so a stored
        // entry missing the flag shows rather than vanishing.
        resolved.push({ id, visible: entry.visible !== false });
    });

    SECTION_DEFS.forEach((def, index) => {
        if (seen.has(def.id)) {
            return;
        }

        // Slot the section in beside its default neighbours: immediately after
        // the default that precedes it, which is always in place by now, or at
        // the front when it has none. A section added in a later release
        // therefore lands where it was designed to sit rather than at the end
        // of the document.
        //
        // The app writes the whole list on every save, so in the field the
        // stored config is missing at most the sections added since it was
        // written, and this puts each of those back in its own place.
        const previous = index > 0 ? SECTION_DEFS[index - 1] : null;
        const at = previous
            ? resolved.findIndex((entry) => entry.id === previous.id) + 1
            : 0;

        resolved.splice(at, 0, { id: def.id, visible: def.visible !== false });
        seen.add(def.id);
    });

    return resolved;
};

export const visibleSections = (sections = []) => sections.filter((section) => section.visible);

/**
 * Collapses the ordered sections into the rows the document actually lays out:
 * sections sharing a `row` become one entry holding both.
 *
 * A shared row is merged even when its members are not adjacent, which can only
 * happen if a stored config was edited by hand. Keeping the row whole is the
 * stronger guarantee — it means a two-column grid is never left with one child
 * and a hole beside it.
 *
 * A row whose other half is hidden keeps the one member it has, and the renderer
 * draws that full width rather than in a half-empty grid.
 */
export const groupRows = (sections = []) => {
    const rows = [];
    const rowByKey = new Map();

    sections.forEach((section) => {
        const { row } = sectionDef(section.id) || {};

        if (row && rowByKey.has(row)) {
            rowByKey.get(row).items.push(section);
            return;
        }

        const entry = { row, items: [section] };
        rows.push(entry);

        if (row) {
            rowByKey.set(row, entry);
        }
    });

    return rows;
};
