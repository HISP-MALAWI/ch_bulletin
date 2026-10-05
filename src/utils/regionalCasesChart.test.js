import { buildRegionalMalariaData, buildZoneMalariaData } from './regionalCasesChart';

describe('buildRegionalMalariaData', () => {
    it('filters malaria and chart months for the selected organization unit', () => {
        const result = buildRegionalMalariaData({
            mapping: [
                { displayName: 'Malaria Cases', dataElement: 'malaria' },
                { displayName: 'Cholera Cases', dataElement: 'cholera' },
            ],
            periods: ['202601', '202602'],
            selectedOrgUnit: 'district',
            dataValues: [
                ['malaria', '202601', 'district', '120'],
                ['malaria', '202601', 'another-district', '80'],
                ['malaria', '202602', 'district', '50'],
                ['malaria', '202512', 'district', '999'],
                ['cholera', '202601', 'district', '300'],
            ],
        });

        expect(result.rows).toEqual([
            { period: '202601', cases: 120 },
            { period: '202602', cases: 50 },
        ]);
    });

    it('provides direct recorded cases for the selected unit without including child units', () => {
        const result = buildRegionalMalariaData({
            mapping: [{ displayName: 'Malaria Cases', dataElement: 'malaria' }],
            periods: ['202601'],
            selectedOrgUnit: 'region',
            dataValues: [
                ['malaria', '202601', 'region', '120'],
                ['malaria', '202601', 'district', '80'],
            ],
        });

        expect(result.rows).toEqual([{ period: '202601', cases: 120 }]);
    });
});

describe('buildZoneMalariaData', () => {
    const orgUnits = [
        { id: 'country', level: 1 },
        { id: 'north', level: 2, displayName: 'Northern', parent: { id: 'country' } },
        { id: 'south', level: 2, displayName: 'Southern', parent: { id: 'country' } },
        { id: 'north-district', level: 3, parent: { id: 'north' } },
        { id: 'south-one', level: 3, parent: { id: 'south' } },
        { id: 'south-two', level: 3, parent: { id: 'south' } },
    ];

    it('builds stacked zone totals, using district data when zone aggregates are missing', () => {
        const result = buildZoneMalariaData({
            mapping: [{ displayName: 'Malaria Cases', dataElement: 'malaria' }],
            periods: ['202608'],
            selectedOrgUnit: 'country',
            orgUnits,
            dataValues: [
                ['malaria', '202608', 'north', '100'],
                ['malaria', '202608', 'north-district', '90'],
                ['malaria', '202608', 'south-one', '30'],
                ['malaria', '202608', 'south-two', '20'],
            ],
        });

        expect(result.rows).toEqual([{
            period: '202608',
            total: 150,
            north: 100,
            south: 50,
        }]);
        expect(result.zones.map(({ displayName }) => displayName)).toEqual(['Northern', 'Southern']);
    });

    it('does not build zone series for a non-level-one selection', () => {
        expect(buildZoneMalariaData({
            mapping: [{ displayName: 'Malaria Cases', dataElement: 'malaria' }],
            periods: ['202608'],
            selectedOrgUnit: 'north',
            orgUnits,
            dataValues: [],
        }).rows).toEqual([]);
    });
});
