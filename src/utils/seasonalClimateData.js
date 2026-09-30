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
    if (!engine || typeof engine.query !== 'function' || !selectedOrgUnit) return [];

    const requests = dataElements.filter(Boolean).flatMap((dataElement) =>
        periods.map(async (period) => {
            try {
                const response = await engine.query({
                    dataValue: {
                        resource: 'dataValues',
                        params: { de: dataElement, pe: period, ou: selectedOrgUnit },
                    },
                });
                const result = response?.dataValue;
                const dataValue = Array.isArray(result)
                    ? result[0]
                    : result?.dataValues?.[0] || result?.dataValue || result;
                const value = dataValue && typeof dataValue === 'object'
                    ? dataValue.value
                    : dataValue;

                if (value === undefined || value === null || value === '') return null;
                return [
                    dataValue?.dataElement || dataElement,
                    dataValue?.period || period,
                    dataValue?.orgUnit || selectedOrgUnit,
                    value,
                ];
            } catch {
                return null;
            }
        })
    );

    return (await Promise.all(requests)).filter(Boolean);
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