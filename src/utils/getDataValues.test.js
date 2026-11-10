import getDataValues, { getMonthlyPeriods, mergeDataValues } from './getDataValues';

describe('getMonthlyPeriods', () => {
    it('includes 12 preceding months, the selected month, and 3 following months', () => {
        expect(getMonthlyPeriods('202609')).toEqual([
            '202509', '202510', '202511', '202512',
            '202601', '202602', '202603', '202604',
            '202605', '202606', '202607', '202608',
            '202609', '202610', '202611', '202612',
        ]);
    });

    it('returns no periods for an invalid monthly period', () => {
        expect(getMonthlyPeriods('202613')).toEqual([]);
    });
});

describe('mergeDataValues', () => {
    it('keeps one row per data element, period and unit', () => {
        expect(mergeDataValues(
            [['dx', '202610', 'ou', '1'], ['dx', '202611', 'ou', '2']],
            [['dx', '202610', 'ou', '1'], ['dx', '202612', 'ou', '3']]
        )).toEqual([
            ['dx', '202610', 'ou', '1'],
            ['dx', '202611', 'ou', '2'],
            ['dx', '202612', 'ou', '3'],
        ]);
    });

    it('prefers a real value over a blank from the other fetch', () => {
        expect(mergeDataValues(
            [['dx', '202610', 'ou', '']],
            [['dx', '202610', 'ou', '7']]
        )).toEqual([['dx', '202610', 'ou', '7']]);

        expect(mergeDataValues(
            [['dx', '202610', 'ou', '7']],
            [['dx', '202610', 'ou', '']]
        )).toEqual([['dx', '202610', 'ou', '7']]);
    });

    it('lets a later non-empty value win', () => {
        expect(mergeDataValues(
            [['dx', '202610', 'ou', '1']],
            [['dx', '202610', 'ou', '2']]
        )).toEqual([['dx', '202610', 'ou', '2']]);
    });

    it('ignores malformed lists and rows', () => {
        expect(mergeDataValues(
            undefined,
            [null, 'x'],
            [['dx', '202610', 'ou', '5']]
        )).toEqual([['dx', '202610', 'ou', '5']]);
    });
});

describe('getDataValues', () => {
    it('passes all requested months to the analytics period dimension', async () => {
        const rows = [['data-element', '202609', 'org-unit', '42']];
        const engine = {
            query: jest.fn().mockResolvedValue({ analytics: { rows } }),
        };
        const periods = ['202608', '202609', '202610'];

        await expect(getDataValues(['data-element'], periods, 'org-unit', engine)).resolves.toBe(rows);
        expect(engine.query).toHaveBeenCalledWith({
            analytics: {
                resource: 'analytics',
                params: {
                    dimension: ['dx:data-element', 'pe:202608;202609;202610', 'ou:org-unit'],
                },
            },
        });
    });

    // The one place a new mapping field fails silently: it stays in the row and
    // is simply never requested. Everything else in the chain reads whatever
    // came back, so nothing downstream would notice.
    it('requests every mapped prediction field as a data element', async () => {
        const engine = {
            query: jest.fn().mockResolvedValue({ analytics: { rows: [] } }),
        };

        await getDataValues([
            {
                displayName: 'Malaria Cases',
                dataElement: 'cases',
                alarmElement: 'alarm',
                threshold: 'threshold',
                predictionLowerBound: 'lower',
                predictionMedian: 'median',
                predictionUpperBound: 'upper',
                predictionQuartileLow: 'q1',
                predictionQuartileHigh: 'q3',
                iconURL: 'https://example.test/icon.png',
            },
        ], ['202609'], 'org-unit', engine);

        const { dimension } = engine.query.mock.calls[0][0].analytics.params;

        expect(dimension[0]).toBe('dx:cases;alarm;lower;median;upper;q1;q3;threshold');
        // The icon is a URL, not a data element, so it must not be requested.
        expect(dimension[0]).not.toContain('example.test');
    });

    it('requests the selected unit and its district units in one analytics query', async () => {
        const engine = {
            query: jest.fn().mockResolvedValue({ analytics: { rows: [] } }),
        };

        await getDataValues(
            ['data-element'],
            ['202610', '202611'],
            ['selected-unit', 'district-one', 'district-two'],
            engine
        );

        expect(engine.query).toHaveBeenCalledWith({
            analytics: {
                resource: 'analytics',
                params: {
                    dimension: [
                        'dx:data-element',
                        'pe:202610;202611',
                        'ou:selected-unit;district-one;district-two',
                    ],
                },
            },
        });
    });
});