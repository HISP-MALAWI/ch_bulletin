import {
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
