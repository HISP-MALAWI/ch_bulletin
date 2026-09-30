import { buildHealthGuidance } from './healthGuidance';

describe('buildHealthGuidance', () => {
    it('uses seasonal rainfall and malaria median predictions when available', () => {
        const result = buildHealthGuidance({
            seasonalClimateRows: [
                { period: '202610', rainfall: 42, temperature: 25 },
                { period: '202611', rainfall: 90, temperature: 26 },
            ],
            forecast: { properties: { timeseries: [] } },
            dataValues: [
                ['prediction', '202611', 'district', '12'],
                ['prediction', '202612', 'district', '28'],
                ['prediction', '202612', 'another-district', '100'],
                ['alarm', '202609', 'district', '1'],
                ['alarm', '202611', 'district', '1'],
                ['alarm', '202612', 'district', '1'],
                ['alarm', '202612', 'another-district', '1'],
            ],
            mapping: [{
                displayName: 'Malaria cases',
                predictionMedian: 'prediction',
                alarmElement: 'alarm',
            }],
            period: '202610',
            selectedOrgUnit: 'district',
        });

        expect(result.climateSource).toBe('seasonal');
        expect(result.advisories).toEqual([
            'Seasonal outlook indicates the highest rainfall in November 2026 (90.0 mm).',
            'Seasonal outlook indicates the highest temperature in November 2026 (26.0 °C).',
            'The malaria median prediction peaks at 28 cases in December 2026.',
            'Configured alarm indicators are active in November 2026 (Malaria cases); December 2026 (Malaria cases).',
        ]);
        expect(result.recommendations).toHaveLength(4);
        expect(result.recommendations.at(-1)).toContain('November 2026, December 2026');
    });

    it('falls back to the 10-day forecast when seasonal values are unavailable', () => {
        const result = buildHealthGuidance({
            forecast: {
                properties: {
                    timeseries: [{
                        time: '2026-09-30T12:00:00Z',
                        data: {
                            instant: { details: { air_temperature: 29 } },
                            next_1_hours: { details: { precipitation_amount: 8.5 } },
                        },
                    }],
                },
            },
        });

        expect(result.climateSource).toBe('10-day');
        expect(result.advisories[0]).toContain('30 Sep 2026 (8.5 mm)');
        expect(result.recommendations[0]).toContain('30 Sep 2026');
        expect(result.advisories[1]).toContain('29.0 °C');
    });
});
