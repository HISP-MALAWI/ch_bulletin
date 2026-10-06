import { buildRegionalRisk } from './regionalRisk';

// Two zones, ten districts each, so a share is easy to read off the count.
// `north-1` … `north-10` and `south-1` … `south-10`.
const northDistricts = Array.from({ length: 10 }, (unused, index) => ({
    id: `north-${index + 1}`,
    level: 3,
    parent: { id: 'north' },
}));
const southDistricts = Array.from({ length: 10 }, (unused, index) => ({
    id: `south-${index + 1}`,
    level: 3,
    parent: { id: 'south' },
}));

const orgUnits = [
    { id: 'country', level: 1, displayName: 'Malawi' },
    { id: 'north', level: 2, displayName: 'Northern', parent: { id: 'country' } },
    { id: 'south', level: 2, displayName: 'Southern', parent: { id: 'country' } },
    ...northDistricts,
    ...southDistricts,
];

// One forecast month is enough: a district's status is decided by its alarm
// value for that month, and the district is classified once however many months
// are passed in.
const periods = ['202610'];

const mapping = [{
    displayName: 'Malaria Cases',
    alarmElement: 'alarm',
    threshold: 'threshold',
    predictionMedian: 'median',
}];

// A district on alert is one whose alarm indicator reads 1.
const alarmReadings = (value, districtIds) =>
    districtIds.map((id) => ['alarm', '202610', id, String(value)]);
const withAlerts = (districtIds) => alarmReadings(1, districtIds);

const regionFor = (regions, id) => regions.find((region) => region.id === id);

describe('buildRegionalRisk', () => {
    it('reads the alert share off the districts in each zone', () => {
        // Three of ten northern districts on alert: exactly the High threshold.
        const { regions } = buildRegionalRisk({
            dataValues: withAlerts(['north-1', 'north-2', 'north-3']),
            mapping,
            periods,
            orgUnits,
            selectedOrgUnitId: 'country',
        });

        expect(regionFor(regions, 'north')).toEqual({
            id: 'north',
            name: 'Northern',
            level: 'high',
            alerts: 3,
            watches: 0,
            districts: 10,
            alertShare: 0.3,
            watchShare: 0,
        });
    });

    it('is Low below the alert share, however close', () => {
        const { regions } = buildRegionalRisk({
            dataValues: withAlerts(['north-1', 'north-2']),
            mapping,
            periods,
            orgUnits,
            selectedOrgUnitId: 'country',
        });

        expect(regionFor(regions, 'north').level).toBe('low');
    });

    it('counts alert and watch together for Moderate', () => {
        // Two on alert and three on watch is half the zone, past the Moderate
        // threshold, but only two in ten are on alert, short of High.
        const dataValues = [
            ...withAlerts(['north-1', 'north-2']),
            ...['north-3', 'north-4', 'north-5'].map((id) => ['median', '202610', id, '5']),
            ...['north-3', 'north-4', 'north-5'].map((id) => ['threshold', '202610', id, '6']),
        ];
        const { regions } = buildRegionalRisk({
            dataValues,
            mapping,
            periods,
            orgUnits,
            selectedOrgUnitId: 'country',
        });

        const north = regionFor(regions, 'north');
        expect(north.watches).toBe(3);
        expect(north.level).toBe('moderate');
    });

    it('reports Low, not a level per district, when nothing is alerting', () => {
        // Every district reads, and every reading is clear — as opposed to the
        // next test, where nothing reads at all.
        const { regions, hasDistrictData } = buildRegionalRisk({
            dataValues: alarmReadings(0, orgUnits.filter((unit) => unit.level === 3).map((unit) => unit.id)),
            mapping,
            periods,
            orgUnits,
            selectedOrgUnitId: 'country',
        });

        expect(regions.map((region) => region.level)).toEqual(['low', 'low']);
        expect(hasDistrictData).toBe(true);
    });

    it('withholds the levels when the window holds no district readings', () => {
        // Only a national row, which is what a draft saved before the editor
        // fetched district values carries. The regions still come back, all Low
        // — indistinguishable from a quiet country, which is why the flag is
        // what the caller reads.
        const { regions, isConfigured, hasDistrictData } = buildRegionalRisk({
            dataValues: [['alarm', '202610', 'country', '0']],
            mapping,
            periods,
            orgUnits,
            selectedOrgUnitId: 'country',
        });

        expect(isConfigured).toBe(true);
        expect(hasDistrictData).toBe(false);
        expect(regions.map((region) => region.level)).toEqual(['low', 'low']);
    });

    it('flags an unconfigured mapping, so the levels are not read as good news', () => {
        const { regions, isConfigured } = buildRegionalRisk({
            dataValues: [],
            mapping: [{ displayName: 'Malaria Cases' }],
            periods,
            orgUnits,
            selectedOrgUnitId: 'country',
        });

        expect(isConfigured).toBe(false);
        // The regions still come back — it is the caller's job not to show them.
        expect(regions).toHaveLength(2);
    });

    it('covers only the selected zone when a zone is selected', () => {
        const { regions } = buildRegionalRisk({
            dataValues: withAlerts(['north-1', 'north-2', 'north-3']),
            mapping,
            periods,
            orgUnits,
            selectedOrgUnitId: 'north',
        });

        expect(regions.map((region) => region.id)).toEqual(['north']);
        expect(regions[0].level).toBe('high');
    });

    it('has no regions below a zone', () => {
        const { regions } = buildRegionalRisk({
            dataValues: withAlerts(['north-1']),
            mapping,
            periods,
            orgUnits,
            selectedOrgUnitId: 'north-1',
        });

        expect(regions).toEqual([]);
    });

    it('leaves a zone with no districts at all without a level', () => {
        const { regions } = buildRegionalRisk({
            dataValues: [],
            mapping,
            periods,
            orgUnits: [
                { id: 'country', level: 1, displayName: 'Malawi' },
                { id: 'empty', level: 2, displayName: 'Empty', parent: { id: 'country' } },
            ],
            selectedOrgUnitId: 'country',
        });

        expect(regions[0].level).toBeNull();
        expect(regions[0].districts).toBe(0);
    });
});
