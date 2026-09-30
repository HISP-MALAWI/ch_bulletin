import {
    buildSeasonalClimateRows,
    fetchSeasonalClimateDataValues,
    getSeasonalForecastPeriods,
} from './seasonalClimateData';

describe('getSeasonalForecastPeriods', () => {
    it('returns October through April for any period from August through April', () => {
        const periods = ['202608', '202609', '202610', '202612', '202701', '202704'].map((period) =>
            getSeasonalForecastPeriods(period)
        );
        const expected = [
            '202610', '202611', '202612', '202701', '202702', '202703', '202704',
        ];

        periods.forEach((season) => expect(season).toEqual(expected));
    });

    it('returns no season from May through July or for invalid periods', () => {
        expect(getSeasonalForecastPeriods('202705')).toEqual([]);
        expect(getSeasonalForecastPeriods('202706')).toEqual([]);
        expect(getSeasonalForecastPeriods('202707')).toEqual([]);
        expect(getSeasonalForecastPeriods('202713')).toEqual([]);
        expect(getSeasonalForecastPeriods('invalid')).toEqual([]);
    });
});

describe('buildSeasonalClimateRows', () => {
    it('maps rainfall and temperature values to the seasonal months', () => {
        const periods = getSeasonalForecastPeriods('202610');
        const rows = buildSeasonalClimateRows({
            periods,
            rainfallDataElement: 'rain',
            temperatureDataElement: 'temp',
            selectedOrgUnit: 'district',
            dataValues: [
                ['rain', '202610', 'district', '42.5'],
                ['temp', '202610', 'district', '26.3'],
                ['rain', '202611', 'another-district', '100'],
                ['temp', '202704', 'district', '30'],
                ['temp', '202705', 'district', '31'],
            ],
        });

        expect(rows).toHaveLength(7);
        expect(rows[0]).toEqual({
            period: '202610',
            rainfall: 42.5,
            temperature: 26.3,
        });
        expect(rows[1]).toEqual({
            period: '202611',
            rainfall: null,
            temperature: null,
        });
        expect(rows.at(-1).period).toBe('202704');
    });
});

describe('fetchSeasonalClimateDataValues', () => {
    it('queries the dataValues resource once per element and period', async () => {
        const engine = {
            query: jest.fn().mockImplementation(({ dataValue }) => Promise.resolve({
                dataValue: {
                    dataElement: dataValue.params.de,
                    period: dataValue.params.pe,
                    orgUnit: dataValue.params.ou,
                    value: '12.5',
                },
            })),
        };

        const rows = await fetchSeasonalClimateDataValues({
            dataElements: ['rain'],
            periods: ['202610', '202611'],
            selectedOrgUnit: 'district',
            engine,
        });

        expect(engine.query).toHaveBeenCalledTimes(2);
        expect(engine.query).toHaveBeenCalledWith({
            dataValue: {
                resource: 'dataValues',
                params: { de: 'rain', pe: '202610', ou: 'district' },
            },
        });
        expect(rows).toEqual([
            ['rain', '202610', 'district', '12.5'],
            ['rain', '202611', 'district', '12.5'],
        ]);
    });

    it('maps a one-value array response using the requested dimensions', async () => {
        const engine = {
            query: jest.fn().mockResolvedValue({
                dataValue: ['24.013564452528954'],
            }),
        };

        const rows = await fetchSeasonalClimateDataValues({
            dataElements: ['rain'],
            periods: ['202610'],
            selectedOrgUnit: 'district',
            engine,
        });

        expect(rows).toEqual([
            ['rain', '202610', 'district', '24.013564452528954'],
        ]);
        expect(buildSeasonalClimateRows({
            dataValues: rows,
            periods: ['202610'],
            rainfallDataElement: 'rain',
            temperatureDataElement: 'temp',
            selectedOrgUnit: 'district',
        })[0].rainfall).toBeCloseTo(24.013564452528954);
    });
});