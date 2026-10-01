import { describeForecastWindow, formatPeriodRange } from './periodLabel';

describe('formatPeriodRange', () => {
    it('names the months once when the run stays inside one year', () => {
        expect(formatPeriodRange(['202609', '202610', '202611', '202612'])).toBe('Sep–Dec 2026');
    });

    it('repeats the year when the run crosses into the next', () => {
        expect(formatPeriodRange(['202611', '202612', '202701', '202702'])).toBe('Nov 2026–Feb 2027');
    });

    it('returns nothing for an empty run', () => {
        expect(formatPeriodRange([])).toBe('');
        expect(formatPeriodRange()).toBe('');
    });
});

describe('describeForecastWindow', () => {
    it('covers the selected month plus the three it looks ahead to', () => {
        const window = describeForecastWindow('202609');

        expect(window.months).toBe(4);
        expect(window.label).toBe('Sep–Dec 2026');
        expect(window.periods).toEqual(['202609', '202610', '202611', '202612']);
    });

    it('describes a run that crosses the year boundary', () => {
        expect(describeForecastWindow('202611').label).toBe('Nov 2026–Feb 2027');
    });

    it('reports an empty window for a period it cannot read', () => {
        expect(describeForecastWindow('')).toEqual({ periods: [], months: 0, label: '' });
        expect(describeForecastWindow('202613')).toEqual({ periods: [], months: 0, label: '' });
        expect(describeForecastWindow(undefined)).toEqual({ periods: [], months: 0, label: '' });
    });
});
