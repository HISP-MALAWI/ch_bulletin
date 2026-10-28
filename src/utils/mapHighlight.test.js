import {
    DEFAULT_MAP_HIGHLIGHT,
    canonicalHighlightMode,
    findLevelThreeAncestor,
    getSameZoneDistricts,
    normaliseMapHighlight,
    resolveHighlightedDistricts,
} from './mapHighlight';

const orgUnits = [
    { id: 'country', level: 1 },
    { id: 'north', level: 2, displayName: 'Northern', parent: { id: 'country' } },
    { id: 'central', level: 2, displayName: 'Central', parent: { id: 'country' } },
    { id: 'north-a', level: 3, displayName: 'North A', parent: { id: 'north' } },
    { id: 'north-b', level: 3, displayName: 'North B', parent: { id: 'north' } },
    { id: 'central-a', level: 3, displayName: 'Central A', parent: { id: 'central' } },
    { id: 'hospital', level: 3, displayName: 'Hospital', parent: { id: 'north' } },
    { id: 'facility', level: 4, parent: { id: 'north-a' } },
];

const ids = (districts) => districts.map((district) => district.id).sort();

const resolve = (mode, selectedOrgUnitId, districtIds = []) =>
    ids(resolveHighlightedDistricts({
        orgUnits,
        selectedOrgUnitId,
        highlight: { mode, districtIds },
    }));

describe('normaliseMapHighlight', () => {
    it('defaults an unknown mode to own and keeps string ids once', () => {
        expect(normaliseMapHighlight({ mode: 'nonsense', districtIds: ['a', 'a', 3, ''] }))
            .toEqual({ mode: 'own', districtIds: ['a'] });
        expect(normaliseMapHighlight(undefined)).toEqual(DEFAULT_MAP_HIGHLIGHT);
    });
});

describe('canonicalHighlightMode', () => {
    it('shows a mode the level actually offers', () => {
        expect(canonicalHighlightMode('neighbours', 3)).toBe('neighbours');
        expect(canonicalHighlightMode('neighbours', 2)).toBe('own');
        expect(canonicalHighlightMode('neighbours', 1)).toBe('own');
        expect(canonicalHighlightMode('all', 1)).toBe('own');
        expect(canonicalHighlightMode('all', 2)).toBe('all');
        expect(canonicalHighlightMode('manual', 1)).toBe('manual');
    });
});

describe('getSameZoneDistricts', () => {
    it('returns the level-3 units sharing a parent, including the district itself', () => {
        expect(ids(getSameZoneDistricts(orgUnits, 'north-a')))
            .toEqual(['hospital', 'north-a', 'north-b']);
    });

    it('returns the district alone when it has no parent, not every parentless unit', () => {
        const parentless = [
            { id: 'a', level: 3 },
            { id: 'b', level: 3 },
        ];

        expect(ids(getSameZoneDistricts(parentless, 'a'))).toEqual(['a']);
    });
});

describe('findLevelThreeAncestor', () => {
    it('walks up to the district a deeper unit belongs to', () => {
        expect(findLevelThreeAncestor(orgUnits, 'facility')?.id).toBe('north-a');
        expect(findLevelThreeAncestor(orgUnits, 'country')).toBeNull();
    });
});

describe('resolveHighlightedDistricts', () => {
    it('own follows the level: country, zone, district, and a deeper ancestor', () => {
        expect(resolve('own', 'country')).toEqual([
            'central-a', 'hospital', 'north-a', 'north-b',
        ]);
        expect(resolve('own', 'north')).toEqual(['hospital', 'north-a', 'north-b']);
        expect(resolve('own', 'north-a')).toEqual(['north-a']);
        expect(resolve('own', 'facility')).toEqual(['north-a']);
    });

    it('neighbours is the same zone for a district, and own elsewhere', () => {
        expect(resolve('neighbours', 'north-a')).toEqual(['hospital', 'north-a', 'north-b']);
        expect(resolve('neighbours', 'facility')).toEqual(['hospital', 'north-a', 'north-b']);
        expect(resolve('neighbours', 'north')).toEqual(['hospital', 'north-a', 'north-b']);
        expect(resolve('neighbours', 'country')).toEqual([
            'central-a', 'hospital', 'north-a', 'north-b',
        ]);
    });

    it('all is every district, whatever the selection', () => {
        expect(resolve('all', 'north-a')).toEqual([
            'central-a', 'hospital', 'north-a', 'north-b',
        ]);
    });

    it('manual uses exactly the chosen visible districts', () => {
        expect(resolve('manual', 'north-a', ['north-b', 'central-a']))
            .toEqual(['central-a', 'north-b']);
        expect(resolve('manual', 'north-a', ['hospital'])).toEqual(['hospital']);
    });

    it('falls back to own when manual is empty or only stale ids', () => {
        expect(resolve('manual', 'north-a')).toEqual(['north-a']);
        expect(resolve('manual', 'north-a', ['deleted-district'])).toEqual(['north-a']);
    });

    it('is empty for a selection that is not in the list', () => {
        expect(resolve('own', 'missing')).toEqual([]);
    });
});
