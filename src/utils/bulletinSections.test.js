import {
    DEFAULT_SECTIONS,
    groupRows,
    numberSections,
    resolveSections,
    visibleSections,
} from './bulletinSections';

const idsOf = (sections) => sections.map((section) => section.id);
const rowsOf = (sections) => groupRows(sections).map(({ items }) => idsOf(items));

// What the Settings page actually stores: the whole list, in the order shown.
// Moving one section is a splice, which is how the widget writes it back.
const movedToFront = (id) => {
    const moved = DEFAULT_SECTIONS.find((section) => section.id === id);

    return [moved, ...DEFAULT_SECTIONS.filter((section) => section.id !== id)];
};

const withoutSection = (id) => DEFAULT_SECTIONS.filter((section) => section.id !== id);

describe('resolveSections', () => {
    it('falls back to the defaults when nothing is stored', () => {
        expect(resolveSections(undefined)).toEqual(DEFAULT_SECTIONS);
        expect(resolveSections(null)).toEqual(DEFAULT_SECTIONS);
        expect(resolveSections({ id: 'highlights' })).toEqual(DEFAULT_SECTIONS);
    });

    it('keeps a stored order rather than the default one', () => {
        // Recommendations moved to the top, which is the sort of thing the
        // Settings list lets you do. Everything else keeps its own order below.
        const resolved = idsOf(resolveSections(movedToFront('recommendations')));

        expect(resolved[0]).toBe('recommendations');
        expect(resolved[1]).toBe('malariaOverview');
        expect(resolved).toHaveLength(DEFAULT_SECTIONS.length);
    });

    it('keeps a stored visibility, including hidden', () => {
        const resolved = resolveSections([{ id: 'highlights', visible: false }]);
        const highlights = resolved.find((section) => section.id === 'highlights');

        expect(highlights.visible).toBe(false);
    });

    it('drops an id the registry no longer knows', () => {
        const resolved = resolveSections([
            { id: 'highlights', visible: true },
            { id: 'aSectionThatWasRemoved', visible: true },
        ]);

        expect(idsOf(resolved)).not.toContain('aSectionThatWasRemoved');
        expect(idsOf(resolved)).toContain('highlights');
    });

    it('keeps a repeated id at its first position only', () => {
        const resolved = resolveSections([
            { id: 'highlights', visible: false },
            { id: 'highlights', visible: true },
        ]);

        expect(idsOf(resolved).filter((id) => id === 'highlights')).toHaveLength(1);
        expect(resolved.find((section) => section.id === 'highlights').visible).toBe(false);
    });

    it('inserts a section missing from a stored config at its default position', () => {
        // A config saved before `highlights` existed. It belongs fourth, after
        // executiveSummary and before currentMalariaSituation, not appended
        // after whatever the stored config happens to end with.
        const resolved = idsOf(resolveSections(withoutSection('highlights')));

        expect(resolved).toHaveLength(DEFAULT_SECTIONS.length);
        expect(resolved.indexOf('highlights')).toBeGreaterThan(resolved.indexOf('executiveSummary'));
        expect(resolved.indexOf('highlights')).toBeLessThan(
            resolved.indexOf('currentMalariaSituation')
        );
    });

    it('shows a stored entry that has lost its visibility flag', () => {
        const resolved = resolveSections([{ id: 'highlights' }]);

        expect(resolved.find((section) => section.id === 'highlights').visible).toBe(true);
    });

    it('defaults the two sections the document should not carry', () => {
        const hidden = DEFAULT_SECTIONS.filter((section) => !section.visible).map(({ id }) => id);

        expect(hidden).toEqual(['executiveSummary', 'currentMalariaSituation']);
    });
});

describe('visibleSections', () => {
    it('drops the hidden sections and keeps the order', () => {
        const sections = [
            { id: 'highlights', visible: true },
            { id: 'executiveSummary', visible: false },
            { id: 'advisories', visible: true },
        ];

        expect(idsOf(visibleSections(sections))).toEqual(['highlights', 'advisories']);
    });
});

describe('groupRows', () => {
    it('leaves unpaired sections in rows of their own', () => {
        expect(rowsOf([{ id: 'highlights' }, { id: 'districtRisk' }])).toEqual([
            ['highlights'],
            ['districtRisk'],
        ]);
    });

    it('puts the weather forecast and the seasonal climate on one row', () => {
        expect(rowsOf([{ id: 'weatherForecast' }, { id: 'seasonalClimate' }])).toEqual([
            ['weatherForecast', 'seasonalClimate'],
        ]);
    });

    it('gives a half-hidden pair a one-item row, so it is drawn full width', () => {
        expect(rowsOf([{ id: 'weatherForecast' }])).toEqual([['weatherForecast']]);
    });

    it('rejoins a pair that a hand-edited config split apart', () => {
        // Nothing in the settings UI can produce this, but a stored config could
        // be edited by hand. Keeping the row whole is what stops a two-column
        // grid being rendered with a hole in it.
        expect(rowsOf([{ id: 'weatherForecast' }, { id: 'highlights' }, { id: 'seasonalClimate' }])).toEqual([
            ['weatherForecast', 'seasonalClimate'],
            ['highlights'],
        ]);
    });
});

describe('numberSections', () => {
    it('numbers the numbered sections in the order they are rendered', () => {
        const numbers = numberSections(groupRows(DEFAULT_SECTIONS));

        expect(numbers).toEqual({
            highlights: 1,
            malariaForecast: 2,
            weatherForecast: 3,
            advisories: 4,
            recommendations: 5,
        });
    });

    it('follows a reorder rather than the defaults', () => {
        // Advisories moved to the top, so it takes badge 1 and the rest shift
        // down — the badges are the reading order, not the section's identity.
        const rows = groupRows(visibleSections(resolveSections(movedToFront('advisories'))));

        expect(numberSections(rows)).toEqual({
            advisories: 1,
            highlights: 2,
            malariaForecast: 3,
            weatherForecast: 4,
            recommendations: 5,
        });
    });

    it('leaves no gap where a numbered section is hidden', () => {
        const withoutHighlights = DEFAULT_SECTIONS.map((section) =>
            section.id === 'highlights' ? { ...section, visible: false } : section
        );

        const numbers = numberSections(groupRows(visibleSections(withoutHighlights)));

        expect(numbers.malariaForecast).toBe(1);
        expect(numbers).not.toHaveProperty('highlights');
    });

    it('gives an unnumbered section no numeral', () => {
        const numbers = numberSections(groupRows([{ id: 'forecastSummary', visible: true }]));

        expect(numbers).toEqual({});
    });
});
