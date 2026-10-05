export const getSeasonalForecastPeriods = (period) => {
    if (!/^\d{6}$/.test(period || '')) return [];

    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(4, 6));
    if (month < 1 || month > 12 || (month > 4 && month < 8)) return [];

    const startYear = month >= 8 ? year : year - 1;
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(Date.UTC(startYear, 9 + index, 1));
        return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    });
};

export const fetchSeasonalClimateDataValues = async ({
    dataElements = [],
    periods = [],
    selectedOrgUnit,
    engine,
}) => {
    const elements = [...new Set(dataElements.filter(Boolean))];
    const uniquePeriods = [...new Set(periods)];
    if (!engine || typeof engine.query !== 'function') {
        throw new Error('Seasonal climate data requires a valid DHIS2 data engine.');
    }
    if (!selectedOrgUnit || !elements.length || !uniquePeriods.length) return [];

    const response = await engine.query({
        analytics: {
            resource: 'analytics',
            params: {
                dimension: [
                    `dx:${elements.join(';')}`,
                    `pe:${uniquePeriods.join(';')}`,
                    `ou:${selectedOrgUnit}`,
                ],
            },
        },
    });
    const rows = response?.analytics?.rows;
    if (!Array.isArray(rows)) {
        throw new Error('DHIS2 analytics returned no seasonal climate rows.');
    }
    return rows;
};

export const buildSeasonalClimateRows = ({
    dataValues = [],
    periods = [],
    rainfallDataElement,
    temperatureDataElement,
    selectedOrgUnit,
}) => {
    const rowsByPeriod = new Map(periods.map((period) => [
        period,
        { period, rainfall: null, temperature: null },
    ]));

    dataValues.forEach((row) => {
        const [dataElement, period, orgUnit, rawValue] = row;
        const chartRow = rowsByPeriod.get(period);
        if (!chartRow || orgUnit !== selectedOrgUnit || rawValue === '') return;

        const value = Number(rawValue);
        if (!Number.isFinite(value)) return;

        if (dataElement === rainfallDataElement) chartRow.rainfall = value;
        if (dataElement === temperatureDataElement) chartRow.temperature = value;
    });

    return Array.from(rowsByPeriod.values());
};