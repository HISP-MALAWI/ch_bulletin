import { buildSelectedUnitMalariaData, countMappedAlerts, sumMappedPredictionValues, summariseForecast } from './monthlyMalariaData';

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
                    predictionQuartileLow: 'malaria-q1',
                    predictionQuartileHigh: 'malaria-q3',
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
                ['malaria-q1', '202601', 'district', '125'],
                ['malaria-q3', '202601', 'district', '160'],
                ['malaria', '202601', 'another-district', '80'],
                ['malaria', '202602', 'district', '50'],
                ['malaria-threshold', '202602', 'district', '90'],
                ['malaria-lower', '202602', 'district', '40'],
                ['malaria-median', '202602', 'district', '60'],
                ['malaria-upper', '202602', 'district', '80'],
                ['malaria-q1', '202602', 'district', '50'],
                ['malaria-q3', '202602', 'district', '70'],
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
                predictionQuartileLow: 125,
                predictionQuartileHigh: 160,
                predictionRange: [110, 180],
                quartileRange: [125, 160],
            },
            {
                period: '202602',
                cases: 50,
                threshold: 90,
                predictionLowerBound: 40,
                predictionMedian: 60,
                predictionUpperBound: 80,
                predictionQuartileLow: 50,
                predictionQuartileHigh: 70,
                predictionRange: [40, 80],
                quartileRange: [50, 70],
            },
        ]);
    });

    it('draws no band when only one of a pair is present', () => {
        const { rows } = buildSelectedUnitMalariaData({
            mapping: [{
                displayName: 'Malaria Cases',
                dataElement: 'malaria',
                predictionQuartileLow: 'malaria-q1',
                predictionQuartileHigh: 'malaria-q3',
            }],
            periods: ['202601'],
            selectedOrgUnit: 'district',
            dataValues: [
                // The upper quartile is missing, so there is no range to draw.
                ['malaria-q1', '202601', 'district', '125'],
            ],
        });

        expect(rows[0].predictionQuartileLow).toBe(125);
        expect(rows[0].quartileRange).toBeUndefined();
    });
});

describe('summariseForecast', () => {
    const row = (period, median, threshold) => ({
        period,
        predictionMedian: median,
        threshold,
    });

    it('marks a month above its threshold as an alert', () => {
        const summary = summariseForecast({
            rows: [row('202601', 120, 100)],
        });

        expect(summary.months).toEqual([
            { period: '202601', median: 120, threshold: 100, status: 'alert' },
        ]);
        expect(summary.monthsAboveThreshold).toBe(1);
    });

    it('marks a month within a tenth of its threshold as a watch', () => {
        const summary = summariseForecast({
            rows: [row('202601', 95, 100), row('202602', 89, 100)],
        });

        // 95 is within 10% of 100; 89 is not.
        expect(summary.months.map((month) => month.status)).toEqual(['watch', 'normal']);
        expect(summary.monthsAboveThreshold).toBe(0);
    });

    it('reports the peak month and the sentence inputs when nothing exceeds', () => {
        const summary = summariseForecast({
            rows: [row('202601', 60, 100), row('202602', 80, 100), row('202603', 70, 100)],
        });

        expect(summary.peak).toEqual({ period: '202602', median: 80, threshold: 100, status: 'normal' });
        expect(summary.monthsAboveThreshold).toBe(0);
        expect(summary.months).toHaveLength(3);
    });

    it('leaves out months with no threshold rather than guessing', () => {
        const summary = summariseForecast({
            rows: [row('202601', 120, null), row('202602', 130, 100), row('202603', 90, 0)],
        });

        expect(summary.months).toEqual([
            { period: '202602', median: 130, threshold: 100, status: 'alert' },
        ]);
        expect(summary.peak.period).toBe('202602');
    });

    it('starts the forecast where the predictions do, threshold or not', () => {
        const summary = summariseForecast({
            rows: [row('202601', null, 100), row('202602', 130, null)],
        });

        expect(summary.forecastStartsAt).toBe('202602');
    });

    it('returns nothing usable for an empty forecast', () => {
        const summary = summariseForecast({ rows: [] });

        expect(summary.months).toEqual([]);
        expect(summary.peak).toBeNull();
        expect(summary.forecastStartsAt).toBeNull();
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
