import {
    buildDistrictAlertRows,
    buildDistrictForecastStatuses,
    buildSelectedDistrictForecastRows,
    getDistrictDescendants,
    getZoneDescendants,
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
                ['threshold', '202610', 'south-district', '100'],
                ['median', '202610', 'south-district', '75'],
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
            isConfigured: true,
        });
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
});
