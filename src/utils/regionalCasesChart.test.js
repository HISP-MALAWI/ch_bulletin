import { buildRegionalMalariaData } from './regionalCasesChart';

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
});