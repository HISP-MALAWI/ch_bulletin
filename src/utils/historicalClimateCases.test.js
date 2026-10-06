import {
    buildHistoricalClimateCaseRows,
    getRainfallCasePeakInsight,
    getRainfallCasePeaks,
} from './historicalClimateCases';

describe('buildHistoricalClimateCaseRows', () => {
    const orgUnits = [
        { id: 'country', level: 1 },
        { id: 'region', level: 2, parent: { id: 'country' } },
        { id: 'district', level: 3, parent: { id: 'region' } },
    ];
    const mapping = [{
        displayName: 'Malaria Cases',
        dataElement: 'confirmed',
    }];

    it('combines historical climate with selected-unit case values', () => {
        const rows = buildHistoricalClimateCaseRows({
            climateDataValues: [
                ['rain', '202601', 'region', '120'],
                ['temperature', '202601', 'region', '27'],
            ],
            caseDataValues: [
                ['confirmed', '202601', 'region', '80'],
                ['confirmed', '202601', 'district', '60'],
            ],
            mapping,
            periods: ['202601'],
            rainfallDataElement: 'rain',
            temperatureDataElement: 'temperature',
            selectedOrgUnit: 'region',
            orgUnits,
        });

        expect(rows).toEqual([{
            period: '202601',
            rainfall: 120,
            temperature: 27,
            cases: 80,
        }]);
    });

    it('uses district totals when the selected unit has no direct malaria aggregate', () => {
        const rows = buildHistoricalClimateCaseRows({
            caseDataValues: [
                ['confirmed', '202601', 'district', '60'],
            ],
            mapping,
            periods: ['202601'],
            selectedOrgUnit: 'country',
            orgUnits,
        });

        expect(rows[0].cases).toBe(60);
    });

    it('uses zone totals before district totals for a level-one selection', () => {
        const rows = buildHistoricalClimateCaseRows({
            caseDataValues: [
                ['confirmed', '202601', 'region', '80'],
                ['confirmed', '202601', 'district', '60'],
            ],
            mapping,
            periods: ['202601'],
            selectedOrgUnit: 'country',
            orgUnits,
        });

        expect(rows[0].cases).toBe(80);
    });

    it('describes the observed timing between rainfall and cases peaks', () => {
        expect(getRainfallCasePeakInsight([
            { period: '202601', rainfall: 120, cases: 20 },
            { period: '202602', rainfall: 40, cases: 60 },
            { period: '202603', rainfall: 10, cases: 100 },
        ])).toContain('precedes the confirmed-case peak by 2 months');
    });
});

describe('getRainfallCasePeaks', () => {
    const rows = [
        { period: '202601', rainfall: 120, cases: 20 },
        { period: '202602', rainfall: 40, cases: 60 },
        { period: '202603', rainfall: 10, cases: 100 },
    ];

    it('names the two peak months and the gap between them', () => {
        expect(getRainfallCasePeaks(rows)).toEqual({
            rainfallPeriod: '202601',
            casePeriod: '202603',
            rainfallIndex: 0,
            casesIndex: 2,
            leadMonths: 2,
        });
    });

    it('reports a negative lead when the cases peak comes first', () => {
        const reversed = [
            { period: '202601', rainfall: 10, cases: 100 },
            { period: '202602', rainfall: 120, cases: 20 },
        ];

        expect(getRainfallCasePeaks(reversed).leadMonths).toBe(-1);
    });

    it('reports no lead when both peak in the same month', () => {
        const together = [
            { period: '202601', rainfall: 120, cases: 100 },
            { period: '202602', rainfall: 10, cases: 20 },
        ];

        expect(getRainfallCasePeaks(together).leadMonths).toBe(0);
    });

    it('returns nothing without both peaks to compare', () => {
        expect(getRainfallCasePeaks([])).toBeNull();
        expect(getRainfallCasePeaks([
            { period: '202601', rainfall: 120, cases: null },
        ])).toBeNull();
        expect(getRainfallCasePeaks([
            { period: '202601', rainfall: null, cases: 100 },
        ])).toBeNull();
    });

    it('ignores a month that carries only one of the two series', () => {
        // The gap is counted in months of the chart, not in months that happen
        // to carry both numbers, so a missing case month still takes up a step.
        const gapped = [
            { period: '202601', rainfall: 120, cases: 20 },
            { period: '202602', rainfall: 30, cases: null },
            { period: '202603', rainfall: 10, cases: 100 },
        ];

        expect(getRainfallCasePeaks(gapped).leadMonths).toBe(2);
    });
});
