export const getMonthlyPeriods = (period, monthsBack = 11, monthsForward = 3) => {
    if (!/^\d{6}$/.test(period || '') || !Number.isInteger(monthsBack) || !Number.isInteger(monthsForward)) {
        return [];
    }

    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(4, 6));
    if (month < 1 || month > 12 || monthsBack < 0 || monthsForward < 0) {
        return [];
    }

    const monthCount = monthsBack + monthsForward + 1;
    return Array.from({ length: monthCount }, (_, index) => {
        const date = new Date(Date.UTC(year, month - 1 - monthsBack + index, 1));
        return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    });
};

const getDataValues = async (data, periods, organisationUnits, engine) => {
    if (!engine || typeof engine.query !== 'function') {
        console.error('getDataValues requires a valid DHIS2 engine with query().');
        return [];
    }

    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    const dxValues = data.flatMap((item) => {
        console.log('Processing item:', item);
        if (typeof item === 'string') {
            return [item];
        }

        return [item.dataElement, item.alarmElement,item.predictionLowerBound,item.threshold,item.predictionMedian,item.predictionUpperBound].filter(Boolean);
    });

    console.log('Unique dxValues:', dxValues);
    const uniqueDxValues = Array.from(new Set(dxValues));

    const monthPeriods = Array.isArray(periods) ? [...new Set(periods)] : [periods];
    const orgUnitIds = Array.isArray(organisationUnits)
        ? [...new Set(organisationUnits)]
        : [organisationUnits];
    if (
        uniqueDxValues.length === 0 ||
        monthPeriods.length === 0 ||
        monthPeriods.some((month) => !/^\d{6}$/.test(month || '')) ||
        orgUnitIds.length === 0 ||
        orgUnitIds.some((id) => !id)
    ) {
        return [];
    }

    const dataValuesQuery = {
        analytics: {
        resource: 'analytics',
        params: {
            dimension: [
                `dx:${uniqueDxValues.join(';')}`,
                `pe:${monthPeriods.join(';')}`,
                `ou:${orgUnitIds.join(';')}`,
            ],
        },
    }
    };

    try {
        const response = await engine.query(dataValuesQuery);
        return response.analytics.rows;
    } catch (error) {
        console.error('Failed to fetch data values:', error);
        return [];
    }
};

export default getDataValues;