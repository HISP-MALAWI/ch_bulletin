import getDataValues, { getMonthlyPeriods } from './getDataValues';

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