import {
    buildDistrictAlertRows,
    buildDistrictForecastStatuses,
    buildDistrictRiskTable,
    buildSelectedDistrictForecastRows,
    getDistrictDescendants,
    getDistrictRiskFromRows,
    getZoneDescendants,
    hasRegionalRiskView,
} from './districtForecasts';

const orgUnits = [
    { id: 'country', level: 1 },
    { id: 'north', level: 2, parent: { id: 'country' } },
    { id: 'south', level: 2, parent: { id: 'country' } },
    { id: 'north-district', level: 3, displayName: 'North District', parent: { id: 'north' } },
    { id: 'south-district', level: 3, displayName: 'South District', parent: { id: 'south' } },
    { id: 'health-centre', level: 4, parent: { id: 'north-district' } },
];

const mapping = [{
    displayName: 'Malaria Cases',
    alarmElement: 'alarm',
    threshold: 'threshold',
    predictionLowerBound: 'predictionLower',
    predictionMedian: 'median',
    predictionUpperBound: 'predictionUpper',
}];

describe('getDistrictDescendants', () => {
    it('finds only level-three descendants of a level-one or level-two selection', () => {
        expect(getDistrictDescendants(orgUnits, 'north').map(({ id }) => id)).toEqual(['north-district']);
        expect(getDistrictDescendants(orgUnits, 'country').map(({ id }) => id)).toEqual([
            'north-district',
            'south-district',
        ]);
        expect(getDistrictDescendants(orgUnits, 'north-district')).toEqual([]);
    });
});

describe('getZoneDescendants', () => {
    it('returns only level-two children for a level-one selection', () => {
        expect(getZoneDescendants(orgUnits, 'country').map(({ id }) => id)).toEqual(['north', 'south']);
        expect(getZoneDescendants(orgUnits, 'north')).toEqual([]);
    });
});

describe('hasRegionalRiskView', () => {
    it('holds for the levels the regional view is built from', () => {
        expect(hasRegionalRiskView(orgUnits, 'country')).toBe(true);
        expect(hasRegionalRiskView(orgUnits, 'north')).toBe(true);
    });

    it('does not hold for a district, which has no regions beneath it', () => {
        expect(hasRegionalRiskView(orgUnits, 'north-district')).toBe(false);
        expect(hasRegionalRiskView(orgUnits, 'health-centre')).toBe(false);
    });

    it('holds when the level is not known, rather than hiding on a guess', () => {
        expect(hasRegionalRiskView(orgUnits, 'not-loaded')).toBe(true);
        expect(hasRegionalRiskView([{ id: 'no-level' }], 'no-level')).toBe(true);
        expect(hasRegionalRiskView(orgUnits, undefined)).toBe(true);
    });
});

describe('buildDistrictForecastStatuses', () => {
    it('prioritizes an alarm and flags median values from 75% up to the threshold as Watch', () => {
        const result = buildDistrictForecastStatuses({
            orgUnits,
            selectedOrgUnitId: 'country',
            mapping,
            periods: ['202610', '202611'],
            dataValues: [
                ['alarm', '202610', 'north-district', '1'],
                ['threshold', '202610', 'north-district', '100'],
                ['median', '202610', 'north-district', '90'],
                ['predictionLower', '202610', 'north-district', '60'],
                ['predictionUpper', '202610', 'north-district', '120'],
                ['threshold', '202610', 'south-district', '100'],
                ['median', '202610', 'south-district', '75'],
                ['predictionLower', '202610', 'south-district', ''],
                ['predictionUpper', '202610', 'south-district', '95'],
            ],
        });

        expect(result.alerts).toEqual([{
            id: 'north-district',
            name: 'North District',
            period: '202610',
            predictionMedian: 90,
            threshold: 100,
        }]);
        expect(result.watches).toEqual([{
            id: 'south-district',
            name: 'South District',
            period: '202610',
            predictionMedian: 75,
            threshold: 100,
        }]);
        expect(result.normal).toEqual([]);
        expect(result.forecastRowsByDistrict.get('north-district')).toEqual([
            {
                period: '202610',
                predictionMedian: 90,
                predictionLowerBound: 60,
                predictionUpperBound: 120,
                status: 'alert',
            },
            {
                period: '202611',
                predictionMedian: null,
                predictionLowerBound: null,
                predictionUpperBound: null,
                status: 'unavailable',
            },
        ]);
        // A blank lower bound stays absent rather than becoming zero.
        expect(result.forecastRowsByDistrict.get('south-district')[0]).toEqual({
            period: '202610',
            predictionMedian: 75,
            predictionLowerBound: null,
            predictionUpperBound: 95,
            status: 'watch',
        });
    });

    it('ignores values outside the forecast range and medians below the watch band', () => {
        const result = buildDistrictForecastStatuses({
            orgUnits,
            selectedOrgUnitId: 'north',
            mapping,
            periods: ['202610'],
            dataValues: [
                ['alarm', '202609', 'north-district', '1'],
                ['threshold', '202610', 'north-district', '100'],
                ['median', '202610', 'north-district', '74'],
            ],
        });

        expect(result.alerts).toEqual([]);
        expect(result.watches).toEqual([]);
        expect(result.normal).toEqual([{
            id: 'north-district',
            name: 'North District',
        }]);
    });

    it('returns an empty risk summary when the selected region has no district children', () => {
        expect(buildDistrictForecastStatuses({
            orgUnits: [{ id: 'empty-region', level: 2 }],
            selectedOrgUnitId: 'empty-region',
            mapping,
            periods: ['202610'],
        })).toEqual({
            districts: [],
            alerts: [],
            watches: [],
            normal: [],
            forecastRowsByDistrict: new Map(),
            isConfigured: true,
        });
    });

    it('does not turn a blank median into a zero and a false Watch', () => {
        const result = buildDistrictForecastStatuses({
            orgUnits,
            selectedOrgUnitId: 'north',
            mapping,
            periods: ['202610'],
            dataValues: [
                ['threshold', '202610', 'north-district', '100'],
                ['median', '202610', 'north-district', ''],
                ['alarm', '202610', 'north-district', '0'],
            ],
        });

        expect(result.watches).toEqual([]);
        expect(result.forecastRowsByDistrict.get('north-district')[0]).toEqual({
            period: '202610',
            predictionMedian: null,
            predictionLowerBound: null,
            predictionUpperBound: null,
            status: 'normal',
        });
    });

    it('builds an explicit set for a district selection, which has no descendants', () => {
        const district = orgUnits.find((unit) => unit.id === 'north-district');
        const result = buildDistrictForecastStatuses({
            orgUnits,
            selectedOrgUnitId: 'north-district',
            districts: [district],
            mapping,
            periods: ['202610'],
            dataValues: [
                ['threshold', '202610', 'north-district', '100'],
                ['median', '202610', 'north-district', '90'],
                ['alarm', '202610', 'north-district', '0'],
            ],
        });

        expect(result.districts.map(({ id }) => id)).toEqual(['north-district']);
        expect(result.watches).toHaveLength(1);
        expect(result.forecastRowsByDistrict.get('north-district')[0].status).toBe('watch');
    });

    it('treats an explicit empty set as empty rather than falling back to the selection', () => {
        const result = buildDistrictForecastStatuses({
            orgUnits,
            selectedOrgUnitId: 'country',
            districts: [],
            mapping,
            periods: ['202610'],
            dataValues: [],
        });

        expect(result.districts).toEqual([]);
        expect(result.forecastRowsByDistrict.size).toBe(0);
    });

    describe('buildSelectedDistrictForecastRows', () => {
        it('returns threshold, prediction bounds, alarm and per-month risk category', () => {
            const result = buildSelectedDistrictForecastRows({
                mapping,
                selectedOrgUnitId: 'north-district',
                periods: ['202610', '202611', '202612'],
                dataValues: [
                    ['threshold', '202610', 'north-district', '100'],
                    ['median', '202610', 'north-district', '80'],
                    ['alarm', '202610', 'north-district', '0'],
                    ['predictionLower', '202610', 'north-district', '60'],
                    ['predictionUpper', '202610', 'north-district', '110'],
                    ['threshold', '202611', 'north-district', '100'],
                    ['median', '202611', 'north-district', '70'],
                    ['alarm', '202611', 'north-district', '1'],
                ],
            });

            expect(result.rows).toEqual([
                {
                    period: '202610',
                    threshold: 100,
                    predictionLowerBound: 60,
                    predictionMedian: 80,
                    predictionUpperBound: 110,
                    alarm: 0,
                    status: 'watch',
                },
                {
                    period: '202611',
                    threshold: 100,
                    predictionLowerBound: null,
                    predictionMedian: 70,
                    predictionUpperBound: null,
                    alarm: 1,
                    status: 'alert',
                },
                {
                    period: '202612',
                    threshold: null,
                    predictionLowerBound: null,
                    predictionMedian: null,
                    predictionUpperBound: null,
                    alarm: null,
                    status: 'unavailable',
                },
            ]);
            expect(result.isConfigured).toBe(true);
        });
    });
});

describe('buildDistrictAlertRows', () => {
    const alertOrgUnits = [
        { id: 'country', level: 1 },
        { id: 'north', level: 2, displayName: 'Northern Region', parent: { id: 'country' } },
        { id: 'centre', level: 2, displayName: 'Central Region', parent: { id: 'country' } },
        { id: 'a-district', level: 3, displayName: 'Alpha', parent: { id: 'north' } },
        { id: 'b-district', level: 3, displayName: 'Bravo', parent: { id: 'centre' } },
        { id: 'c-district', level: 3, displayName: 'Charlie', parent: { id: 'centre' } },
    ];
    const periods = ['202610', '202611', '202612'];

    const dataValues = [
        ['threshold', '202610', 'a-district', '100'],
        ['median', '202610', 'a-district', '90'],
        ['threshold', '202611', 'a-district', '100'],
        ['median', '202611', 'a-district', '150'],
        ['threshold', '202612', 'a-district', '100'],
        ['median', '202612', 'a-district', '120'],
        ['alarm', '202612', 'a-district', '1'],

        ['threshold', '202610', 'b-district', '200'],
        ['median', '202610', 'b-district', '250'],
        ['alarm', '202610', 'b-district', '1'],

        // Watch, not alert: its median never reaches the threshold and no alarm
        // is raised, so it belongs on the map but not in this table.
        ['threshold', '202610', 'c-district', '100'],
        ['median', '202610', 'c-district', '80'],
        ['alarm', '202610', 'c-district', '0'],
    ];

    it('describes each alerted district at its peak month, ranked by excess', () => {
        const rows = buildDistrictAlertRows({
            orgUnits: alertOrgUnits,
            selectedOrgUnitId: 'country',
            mapping,
            periods,
            dataValues,
        });

        expect(rows).toEqual([
            {
                id: 'a-district',
                name: 'Alpha',
                region: 'Northern Region',
                peakPeriod: '202611',
                peakMedian: 150,
                peakThreshold: 100,
                excess: 50,
                monthsAbove: 2,
                monthsTotal: 3,
            },
            {
                id: 'b-district',
                name: 'Bravo',
                region: 'Central Region',
                peakPeriod: '202610',
                peakMedian: 250,
                peakThreshold: 200,
                excess: 25,
                monthsAbove: 1,
                monthsTotal: 3,
            },
        ]);
    });

    it('lists exactly the districts the risk map puts on alert', () => {
        const status = buildDistrictForecastStatuses({
            orgUnits: alertOrgUnits,
            selectedOrgUnitId: 'country',
            mapping,
            periods,
            dataValues,
        });
        const rows = buildDistrictAlertRows({
            orgUnits: alertOrgUnits,
            selectedOrgUnitId: 'country',
            mapping,
            periods,
            dataValues,
        });

        expect(rows.map(({ id }) => id).sort()).toEqual(status.alerts.map(({ id }) => id).sort());
    });

    it('keeps an alerted district whose peak month has no threshold, ranked by name, last', () => {
        const rows = buildDistrictAlertRows({
            orgUnits: alertOrgUnits,
            selectedOrgUnitId: 'country',
            mapping,
            periods,
            dataValues: [
                ['alarm', '202610', 'b-district', '1'],
                ['median', '202612', 'b-district', '300'],
                ['alarm', '202610', 'a-district', '1'],
                ['median', '202611', 'a-district', '200'],
            ],
        });

        expect(rows.map(({ id }) => id)).toEqual(['a-district', 'b-district']);
        expect(rows.map(({ excess }) => excess)).toEqual([null, null]);
        expect(rows[1]).toMatchObject({ peakPeriod: '202612', peakMedian: 300, peakThreshold: null });
    });

    it('leaves the monthly district table to the district selection', () => {
        expect(buildDistrictAlertRows({
            orgUnits: alertOrgUnits,
            selectedOrgUnitId: 'a-district',
            mapping,
            periods,
            dataValues,
        })).toEqual([]);
    });

    it('returns no rows when malaria is not mapped', () => {
        expect(buildDistrictAlertRows({
            orgUnits: alertOrgUnits,
            selectedOrgUnitId: 'country',
            mapping: [],
            periods,
            dataValues: [['alarm', '202610', 'a-district', '1']],
        })).toEqual([]);
    });

    it('builds an explicit set from a district selection', () => {
        const district = alertOrgUnits.find((unit) => unit.id === 'a-district');
        const rows = buildDistrictAlertRows({
            orgUnits: alertOrgUnits,
            selectedOrgUnitId: 'a-district',
            districts: [district],
            mapping,
            periods,
            dataValues: [
                ['alarm', '202610', 'a-district', '1'],
                ['threshold', '202610', 'a-district', '100'],
                ['median', '202610', 'a-district', '120'],
            ],
        });

        expect(rows.map(({ id }) => id)).toEqual(['a-district']);
    });

    it('ranks an explicit set that spans zones', () => {
        const rows = buildDistrictAlertRows({
            orgUnits: alertOrgUnits,
            selectedOrgUnitId: 'country',
            districts: [
                alertOrgUnits.find((unit) => unit.id === 'a-district'),
                alertOrgUnits.find((unit) => unit.id === 'b-district'),
            ],
            mapping,
            periods,
            dataValues: [
                ['alarm', '202610', 'a-district', '1'],
                ['threshold', '202610', 'a-district', '100'],
                ['median', '202610', 'a-district', '150'],
                ['alarm', '202610', 'b-district', '1'],
                ['threshold', '202610', 'b-district', '100'],
                ['median', '202610', 'b-district', '120'],
            ],
        });

        expect(rows.map(({ id }) => id)).toEqual(['a-district', 'b-district']);
        expect(rows.map(({ excess }) => excess)).toEqual([50, 20]);
    });
});

describe('buildDistrictRiskTable', () => {
    const riskUnits = [
        { id: 'country', level: 1 },
        { id: 'north', level: 2, displayName: 'Northern', parent: { id: 'country' } },
        { id: 'centre', level: 2, displayName: 'Central', parent: { id: 'country' } },
        { id: 'a-district', level: 3, displayName: 'Alpha', parent: { id: 'north' } },
        { id: 'b-district', level: 3, displayName: 'Bravo', parent: { id: 'centre' } },
        { id: 'c-district', level: 3, displayName: 'Charlie', parent: { id: 'centre' } },
    ];
    const riskPeriods = ['202610', '202611', '202612'];
    const base = {
        orgUnits: riskUnits,
        selectedOrgUnitId: 'country',
        mapping,
        periods: riskPeriods,
    };

    it('shows the alerts when there are any, matching the alert rows', () => {
        const dataValues = [
            ['alarm', '202610', 'a-district', '1'],
            ['threshold', '202610', 'a-district', '100'],
            ['median', '202610', 'a-district', '150'],
        ];
        const result = buildDistrictRiskTable({ ...base, dataValues });

        expect(result.mode).toBe('alert');
        expect(result.rows).toEqual(buildDistrictAlertRows({ ...base, dataValues }));
    });

    it('falls back to watches, ranked by how close they run to threshold', () => {
        const dataValues = [
            ['threshold', '202610', 'a-district', '100'],
            ['median', '202610', 'a-district', '90'],
            ['alarm', '202610', 'a-district', '0'],
            ['threshold', '202610', 'b-district', '100'],
            ['median', '202610', 'b-district', '80'],
            ['alarm', '202610', 'b-district', '0'],
        ];
        const result = buildDistrictRiskTable({ ...base, dataValues });

        expect(result.mode).toBe('watch');
        expect(result.rows.map(({ id }) => id)).toEqual(['a-district', 'b-district']);
        expect(result.rows.map(({ excess }) => excess)).toEqual([-10, -20]);
        expect(result.rows.map(({ peakPeriod }) => peakPeriod)).toEqual(['202610', '202610']);
    });

    it('uses the watch month closest to threshold rather than the highest median', () => {
        const dataValues = [
            ['median', '202610', 'a-district', '99'],
            ['threshold', '202610', 'a-district', '100'],
            ['alarm', '202610', 'a-district', '0'],
            ['median', '202611', 'a-district', '150'],
            ['threshold', '202611', 'a-district', '100'],
            ['alarm', '202611', 'a-district', '0'],
        ];
        const result = buildDistrictRiskTable({ ...base, dataValues });

        expect(result.mode).toBe('watch');
        expect(result.rows[0]).toMatchObject({
            id: 'a-district',
            peakPeriod: '202610',
            peakMedian: 99,
            peakThreshold: 100,
            excess: -1,
        });
    });

    it('falls back to the highest forecast medians when there is no alert or watch', () => {
        const dataValues = [
            ['threshold', '202610', 'a-district', '100'],
            ['median', '202610', 'a-district', '50'],
            ['alarm', '202610', 'a-district', '0'],
            ['threshold', '202610', 'b-district', '100'],
            ['median', '202610', 'b-district', '150'],
            ['alarm', '202610', 'b-district', '0'],
            ['threshold', '202610', 'c-district', '100'],
            ['median', '202610', 'c-district', '60'],
            ['alarm', '202610', 'c-district', '0'],
        ];
        const result = buildDistrictRiskTable({ ...base, dataValues });

        expect(result.mode).toBe('top');
        expect(result.rows.map(({ id }) => id)).toEqual([
            'b-district',
            'c-district',
            'a-district',
        ]);
        expect(result.rows.map(({ peakMedian }) => peakMedian)).toEqual([150, 60, 50]);
    });

    it('caps the fallback at the requested number of districts', () => {
        const dataValues = [
            ['median', '202610', 'a-district', '50'],
            ['median', '202610', 'b-district', '150'],
            ['median', '202610', 'c-district', '60'],
        ];
        const result = buildDistrictRiskTable({ ...base, dataValues, limit: 2 });

        expect(result.mode).toBe('top');
        expect(result.rows.map(({ id }) => id)).toEqual(['b-district', 'c-district']);
    });

    it('is empty when no district has a forecast median', () => {
        const result = buildDistrictRiskTable({
            ...base,
            dataValues: [
                ['threshold', '202610', 'a-district', '100'],
                ['alarm', '202610', 'a-district', '0'],
            ],
        });

        expect(result).toEqual({ mode: 'empty', rows: [] });
    });

    it('is empty when malaria is not mapped', () => {
        expect(buildDistrictRiskTable({ ...base, mapping: [], dataValues: [] }))
            .toEqual({ mode: 'empty', rows: [] });
    });

    it('builds a fallback from an explicit district set', () => {
        const district = riskUnits.find((unit) => unit.id === 'a-district');
        const result = buildDistrictRiskTable({
            orgUnits: riskUnits,
            selectedOrgUnitId: 'a-district',
            districts: [district],
            mapping,
            periods: riskPeriods,
            dataValues: [
                ['median', '202610', 'a-district', '50'],
                ['threshold', '202610', 'a-district', '100'],
                ['alarm', '202610', 'a-district', '0'],
            ],
        });

        expect(result.mode).toBe('top');
        expect(result.rows.map(({ id }) => id)).toEqual(['a-district']);
    });
});

describe('getDistrictRiskFromRows', () => {
    const row = (status) => ({ period: '202610', status });

    it('takes the most severe month in the window', () => {
        expect(getDistrictRiskFromRows([row('normal'), row('watch')])).toBe('watch');
        expect(getDistrictRiskFromRows([row('watch'), row('alert')])).toBe('alert');
        expect(getDistrictRiskFromRows([row('normal')])).toBe('normal');
    });

    it('has no risk when every month is unavailable', () => {
        expect(getDistrictRiskFromRows([row('unavailable'), row('unavailable')])).toBeNull();
        expect(getDistrictRiskFromRows([])).toBeNull();
        expect(getDistrictRiskFromRows()).toBeNull();
    });
});
