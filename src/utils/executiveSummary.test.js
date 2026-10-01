import { buildExecutiveSummaryDrafts } from './executiveSummary';

const fullMapping = [{
    displayName: 'Malaria Cases',
    dataElement: 'cases',
    threshold: 'threshold',
    predictionMedian: 'median',
}];

const drafts = (overrides = {}) => buildExecutiveSummaryDrafts({
    period: '202609',
    dataValues: [],
    mapping: fullMapping,
    selectedOrgUnit: 'ou',
    seasonalClimateRows: [],
    ...overrides,
});

const malariaRow = (period, median, threshold) => [
    ['median', period, 'ou', String(median)],
    ['threshold', period, 'ou', String(threshold)],
];

describe('buildExecutiveSummaryDrafts', () => {
    it('says both things when a month has a prediction and a climate reading', () => {
        expect(drafts({
            dataValues: malariaRow('202609', 120, 100),
            seasonalClimateRows: [{ period: '202609', rainfall: 12.3, temperature: 24.2 }],
        })).toEqual([
            'September 2026: the predicted median of 120 cases is above the alert threshold of 100, and the outlook is for 12.3 mm of rainfall and a mean temperature of 24.2 °C.',
        ]);
    });

    it('says only what it can when a month has no climate reading', () => {
        // The seasonal series runs October to April, so a September bulletin
        // has no climate row for its first forecast month.
        expect(drafts({ dataValues: malariaRow('202609', 120, 100) })).toEqual([
            'September 2026: the predicted median of 120 cases is above the alert threshold of 100.',
        ]);
    });

    it('says only what it can when a month has no prediction', () => {
        expect(drafts({
            seasonalClimateRows: [{ period: '202609', rainfall: 5, temperature: 20 }],
        })).toEqual([
            'September 2026: the outlook is for 5.0 mm of rainfall and a mean temperature of 20.0 °C.',
        ]);
    });

    it('names only the measures a climate row actually carries', () => {
        expect(drafts({
            seasonalClimateRows: [{ period: '202609', rainfall: 5, temperature: null }],
        })).toEqual([
            'September 2026: the outlook is for 5.0 mm of rainfall.',
        ]);
    });

    it('leaves a month out entirely rather than padding it', () => {
        expect(drafts()).toEqual([]);
    });

    it('walks the four forecast months in order', () => {
        const draftsForFourMonths = drafts({
            dataValues: [
                ...malariaRow('202609', 120, 100),
                ...malariaRow('202610', 95, 100),
                ...malariaRow('202611', 50, 100),
            ],
        });

        expect(draftsForFourMonths).toEqual([
            'September 2026: the predicted median of 120 cases is above the alert threshold of 100.',
            'October 2026: the predicted median of 95 cases is approaching the alert threshold of 100.',
            'November 2026: the predicted median of 50 cases stays below the alert threshold of 100.',
        ]);
    });

    it('reports the median alone when no threshold is mapped', () => {
        expect(drafts({
            mapping: [{ displayName: 'Malaria Cases', dataElement: 'cases', predictionMedian: 'median' }],
            dataValues: [['median', '202609', 'ou', '120']],
        })).toEqual([
            'September 2026: the predicted median is 120 cases.',
        ]);
    });

    it('returns nothing for a period it cannot read', () => {
        expect(drafts({ period: '' })).toEqual([]);
        expect(drafts({ period: '202613' })).toEqual([]);
    });

    it('ignores rows belonging to another organisation unit', () => {
        expect(drafts({
            dataValues: [['median', '202609', 'elsewhere', '120'], ['threshold', '202609', 'elsewhere', '100']],
        })).toEqual([]);
    });
});
