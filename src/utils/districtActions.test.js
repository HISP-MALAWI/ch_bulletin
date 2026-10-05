import { buildDistrictActions } from './districtActions';

describe('buildDistrictActions', () => {
    const orgUnits = [
        { id: 'country', level: 1 },
        { id: 'region', level: 2, parent: { id: 'country' } },
        { id: 'alert-district', level: 3, displayName: 'Alert District', parent: { id: 'region' } },
        { id: 'watch-district', level: 3, displayName: 'Watch District', parent: { id: 'region' } },
    ];
    const mapping = [{
        displayName: 'Malaria Cases',
        alarmElement: 'alarm',
        predictionMedian: 'median',
        threshold: 'threshold',
    }];

    it('generates recommendations from malaria, seasonal and 10-day forecast values without listing districts', () => {
        const result = buildDistrictActions({
            forecast: {
                properties: {
                    timeseries: [{
                        time: '2026-10-09T12:00:00Z',
                        data: {
                            instant: { details: { air_temperature: 31 } },
                            next_1_hours: { details: { precipitation_amount: 18.5 } },
                        },
                    }],
                },
            },
            seasonalClimateRows: [
                { period: '202610', rainfall: 42, temperature: 25 },
                { period: '202611', rainfall: 90, temperature: 26 },
            ],
            dataValues: [
                ['alarm', '202610', 'alert-district', '1'],
                ['median', '202610', 'alert-district', '120'],
                ['threshold', '202610', 'alert-district', '100'],
                ['median', '202610', 'watch-district', '80'],
                ['threshold', '202610', 'watch-district', '100'],
                ['median', '202611', 'alert-district', '120'],
                ['median', '202611', 'watch-district', '100'],
            ],
            mapping,
            period: '202610',
            selectedOrgUnitId: 'country',
            orgUnits,
        });
        const actionText = result.flatMap((group) => group.actions).join(' ');

        expect(actionText).toContain('forecast alarm signals');
        expect(actionText).toContain('median malaria forecasts');
        expect(actionText).toContain('220 cases in November 2026');
        expect(actionText).toContain('November 2026 (90.0 mm)');
        expect(actionText).toContain('coordinate community clean-up of standing water');
        expect(actionText).toContain('2026-10-09 (18.5 mm)');
        expect(actionText).toContain('scheduled outreach remains accessible');
        expect(actionText).toContain('2026-10-09 (31.0 °C)');
        expect(actionText).toContain('November 2026 (26.0 °C)');
        expect(actionText).toContain('both peak in November 2026');
        expect(actionText).toContain('Review weekly case trends and reporting completeness');
        expect(actionText).toContain('Apply local outbreak-response protocols');
        expect(actionText).not.toContain('Alert District');
        expect(actionText).not.toContain('Watch District');
    });

    it('does not fabricate weather or case outcomes when forecasts are unavailable', () => {
        const result = buildDistrictActions({
            dataValues: [],
            mapping,
            period: '202610',
            selectedOrgUnitId: 'country',
            orgUnits,
        });
        const actionText = result.flatMap((group) => group.actions).join(' ');

        expect(actionText).toContain('A malaria median case peak is not available');
        expect(actionText).toContain('No district alarm signals are active');
        expect(actionText).toContain('No district median forecasts are currently within 25%');
        expect(actionText).toContain('No malaria or weather forecast values are available');
    });

    it('generates forecast-specific recommendations for a selected level-three district', () => {
        const result = buildDistrictActions({
            forecast: {
                properties: {
                    timeseries: [{
                        time: '2026-10-09T12:00:00Z',
                        data: {
                            instant: { details: { air_temperature: 31 } },
                            next_1_hours: { details: { precipitation_amount: 18.5 } },
                        },
                    }],
                },
            },
            seasonalClimateRows: [
                { period: '202610', rainfall: 42, temperature: 25 },
                { period: '202611', rainfall: 90, temperature: 26 },
            ],
            dataValues: [
                ['alarm', '202610', 'watch-district', '0'],
                ['threshold', '202610', 'watch-district', '100'],
                ['median', '202610', 'watch-district', '80'],
            ],
            mapping,
            period: '202610',
            selectedOrgUnitId: 'watch-district',
            orgUnits,
        });

        expect(result[0].actions.join(' ')).toContain('No alarm indication is recorded for Watch District');
        expect(result[1].actions.join(' ')).toContain('Watch District is at Watch in October 2026');
        expect(result[1].actions.join(' ')).toContain('80 of 100 cases (80% of threshold)');
        expect(result[2].actions.join(' ')).toContain('Watch District median forecast peaks at 80 cases in October 2026');
        expect(result[2].actions.join(' ')).toContain('coordinate community clean-up');
        expect(result[2].actions.join(' ')).toContain('check access to scheduled outreach');
        expect(result.flatMap((group) => group.actions).join(' ')).not.toContain('only when a level 1 or 2');
    });

    it('prioritizes an alarm over Watch for a selected district', () => {
        const result = buildDistrictActions({
            dataValues: [
                ['alarm', '202610', 'alert-district', '1'],
                ['threshold', '202610', 'alert-district', '100'],
                ['median', '202610', 'alert-district', '90'],
            ],
            mapping,
            period: '202610',
            selectedOrgUnitId: 'alert-district',
            orgUnits,
        });

        expect(result[0].actions.join(' ')).toContain('Alert District has an alarm indication');
        expect(result[1].actions.join(' ')).toContain('alarm status takes priority over Watch');
    });
});
