import { buildSelectedUnitMalariaData, countMappedAlerts, sumMappedPredictionValues } from './monthlyMalariaData';

describe('buildSelectedUnitMalariaData', () => {
    it('filters malaria and chart months for the selected organization unit', () => {
        const result = buildSelectedUnitMalariaData({
            mapping: [
                {
                    displayName: 'Malaria Cases',
                    dataElement: 'malaria',
                    threshold: 'malaria-threshold',
                    predictionLowerBound: 'malaria-lower',
                    predictionMedian: 'malaria-median',
                    predictionUpperBound: 'malaria-upper',
                },
                { displayName: 'Cholera Cases', dataElement: 'cholera' },
            ],
            periods: ['202601', '202602'],
            selectedOrgUnit: 'district',
            dataValues: [
                ['malaria', '202601', 'district', '120'],
                ['malaria-threshold', '202601', 'district', '100'],
                ['malaria-lower', '202601', 'district', '110'],
                ['malaria-median', '202601', 'district', '140'],
                ['malaria-upper', '202601', 'district', '180'],
                ['malaria', '202601', 'another-district', '80'],
                ['malaria', '202602', 'district', '50'],
                ['malaria-threshold', '202602', 'district', '90'],
                ['malaria-lower', '202602', 'district', '40'],
                ['malaria-median', '202602', 'district', '60'],
                ['malaria-upper', '202602', 'district', '80'],
                ['malaria-threshold', '202602', 'another-district', '999'],
                ['malaria', '202512', 'district', '999'],
                ['cholera', '202601', 'district', '300'],
            ],
        });

        expect(result.rows).toEqual([
            {
                period: '202601',
                cases: 120,
                threshold: 100,
                predictionLowerBound: 110,
                predictionMedian: 140,
                predictionUpperBound: 180,
                predictionRange: [110, 180],
            },
            {
                period: '202602',
                cases: 50,
                threshold: 90,
                predictionLowerBound: 40,
                predictionMedian: 60,
                predictionUpperBound: 80,
                predictionRange: [40, 80],
            },
        ]);
    });
});

describe('sumMappedPredictionValues', () => {
    it('sums the requested mapped prediction for the forecast months and selected OU', () => {
        const total = sumMappedPredictionValues({
            mapping: [
                { predictionMedian: 'malaria-median' },
                { predictionMedian: 'cholera-median' },
            ],
            periods: ['202609', '202610', '202611', '202612'],
            selectedOrgUnit: 'malawi',
            predictionField: 'predictionMedian',
            dataValues: [
                ['malaria-median', '202609', 'malawi', '100'],
                ['malaria-median', '202610', 'malawi', '200'],
                ['cholera-median', '202611', 'malawi', '300'],
                ['malaria-median', '202612', 'malawi', '400'],
                ['malaria-median', '202608', 'malawi', '900'],
                ['malaria-median', '202611', 'other-ou', '800'],
            ],
        });

        expect(total).toBe(1000);
    });

    it('returns null when the selected forecast has no mapped values', () => {
        expect(sumMappedPredictionValues({
            mapping: [{ predictionMedian: 'median' }],
            periods: ['202609'],
            selectedOrgUnit: 'malawi',
            predictionField: 'predictionMedian',
            dataValues: [],
        })).toBeNull();
    });
});

describe('countMappedAlerts', () => {
    const input = {
        mapping: [{ alarmElement: 'malaria-alarm' }, { alarmElement: 'cholera-alarm' }],
        periods: ['202609', '202610', '202611', '202612'],
        selectedOrgUnit: 'malawi',
    };

    it('counts exact 1 values and ignores zero, other values, and out-of-scope rows', () => {
        expect(countMappedAlerts({
            ...input,
            dataValues: [
                ['malaria-alarm', '202609', 'malawi', '0'],
                ['malaria-alarm', '202610', 'malawi', '1'],
                ['cholera-alarm', '202611', 'malawi', '1'],
                ['malaria-alarm', '202612', 'malawi', '2'],
                ['malaria-alarm', '202608', 'malawi', '1'],
                ['malaria-alarm', '202611', 'other-ou', '1'],
            ],
        })).toBe(2);
    });

    it('returns zero when alarm data exists but every value is false', () => {
        expect(countMappedAlerts({
            ...input,
            dataValues: [
                ['malaria-alarm', '202609', 'malawi', '0'],
                ['cholera-alarm', '202610', 'malawi', 0],
            ],
        })).toBe(0);
    });
});