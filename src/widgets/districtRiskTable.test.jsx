import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DistrictRiskTable } from './districtRiskSummary';

// The widget receives the CSS-module object from its caller; the test only
// needs the class names to survive, not the styles.
const style = new Proxy({}, { get: (target, key) => String(key) });

const row = (overrides = {}) => ({
    id: 'a',
    name: 'Alpha-DHO',
    region: 'Northern',
    peakPeriod: '202610',
    peakMedian: 150,
    peakThreshold: 100,
    excess: 50,
    monthsAbove: 1,
    monthsTotal: 4,
    ...overrides,
});

const render = (props) => renderToStaticMarkup(
    <DistrictRiskTable style={style} isConfigured {...props} />
);

describe('DistrictRiskTable', () => {
    it('renders the alert rows with the existing columns', () => {
        const html = render({ mode: 'alert', rows: [row()] });

        expect(html).toContain('Districts on alert');
        expect(html).toContain('(1)');
        expect(html).toContain('Alpha-DHO');
        expect(html).toContain('+50%');
        ['District', 'Region', 'Peak', 'Median', 'Threshold', 'Excess', 'Months']
            .forEach((header) => expect(html).toContain(`>${header}<`));
    });

    it('renders the watch and top titles too', () => {
        expect(render({ mode: 'watch', rows: [row({ excess: -8 })] }))
            .toContain('Districts on watch');
        expect(render({ mode: 'top', rows: [row({ excess: null, peakThreshold: null })] }))
            .toContain('Top districts by forecast cases');
    });

    it('always renders the card, even with no rows', () => {
        const html = render({ mode: 'empty', rows: [] });

        expect(html).toContain('District forecast table');
        expect(html).toContain('No district-level forecast values are available');
        expect(html).not.toContain('<table');
    });
});
