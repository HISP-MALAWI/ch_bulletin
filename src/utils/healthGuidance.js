const formatMonth = (period) => {
    const date = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1));
    return new Intl.DateTimeFormat('en', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date);
};

const formatDate = (date) => {
    const dateValue = new Date(`${date}T00:00:00Z`);
    const day = new Intl.DateTimeFormat('en', { day: 'numeric', timeZone: 'UTC' }).format(dateValue);
    const month = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(dateValue);
    const year = dateValue.getUTCFullYear();
    return `${day} ${month} ${year}`;
};

const getForecastEntries = (forecast) => {
    const entries = forecast?.properties?.timeseries ?? forecast?.timeseries ?? forecast;
    return Array.isArray(entries) ? entries : [];
};

const getClimateSignals = (forecast) => {
    const daily = new Map();
    getForecastEntries(forecast).forEach((entry) => {
        const details = entry?.data?.instant?.details ?? entry;
        const date = entry?.time?.slice(0, 10) ?? entry?.date;
        if (!date) return;

        const rainfall = entry?.data?.next_1_hours?.details?.precipitation_amount ??
            entry?.data?.next_6_hours?.details?.precipitation_amount ??
            entry?.precip;
        const temperature = details?.air_temperature ?? entry?.tMax ?? entry?.temperature;
        if (!daily.has(date)) daily.set(date, { date, rainfall: 0, temperature: null });
        const day = daily.get(date);
        if (Number.isFinite(Number(rainfall))) day.rainfall += Number(rainfall);
        if (Number.isFinite(Number(temperature))) {
            day.temperature = day.temperature === null
                ? Number(temperature)
                : Math.max(day.temperature, Number(temperature));
        }
    });

    return Array.from(daily.values());
};

const getMalariaPeak = ({ dataValues, mapping, period, selectedOrgUnit }) => {
    const malariaMapping = mapping.find((item) => /malaria/i.test(item?.displayName || ''));
    if (!malariaMapping?.predictionMedian) return null;

    const predictions = dataValues.flatMap((row) => {
        const [dataElement, dataPeriod, orgUnit] = row;
        const value = Number(row.at(-1));
        if (
            dataElement !== malariaMapping.predictionMedian ||
            orgUnit !== selectedOrgUnit ||
            (period && dataPeriod <= period) ||
            !Number.isFinite(value)
        ) return [];
        return [{ period: dataPeriod, value }];
    });

    return predictions.sort((a, b) => b.value - a.value)[0] || null;
};

const getActiveAlarmMonths = ({ dataValues, mapping, period, selectedOrgUnit }) => {
    const alarmElements = new Map(
        mapping
            .filter((item) => item?.alarmElement)
            .map((item) => [item.alarmElement, item.displayName || 'Health'])
    );
    const alarmsByPeriod = new Map();

    dataValues.forEach((row) => {
        const [dataElement, dataPeriod, orgUnit] = row;
        const value = Number(row.at(-1));
        if (
            !alarmElements.has(dataElement) ||
            orgUnit !== selectedOrgUnit ||
            !/^\d{6}$/.test(dataPeriod || '') ||
            (period && dataPeriod < period) ||
            value !== 1
        ) return;

        if (!alarmsByPeriod.has(dataPeriod)) alarmsByPeriod.set(dataPeriod, new Set());
        alarmsByPeriod.get(dataPeriod).add(alarmElements.get(dataElement));
    });

    return Array.from(alarmsByPeriod.entries())
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([month, conditions]) => ({ month, conditions: Array.from(conditions) }));
};

export const buildHealthGuidance = ({
    seasonalClimateRows = [],
    forecast,
    dataValues = [],
    mapping = [],
    period,
    selectedOrgUnit,
}) => {
    const seasonalRows = seasonalClimateRows.filter((row) =>
        Number.isFinite(row.rainfall) || Number.isFinite(row.temperature)
    );
    const climateSource = seasonalRows.length ? 'seasonal' : '10-day';
    const climateRows = seasonalRows.length ? seasonalRows : getClimateSignals(forecast);
    const advisories = [];
    const recommendations = [];

    const rainiestMonth = climateRows
        .filter((row) => Number.isFinite(row.rainfall))
        .sort((a, b) => b.rainfall - a.rainfall)[0];
    if (rainiestMonth && rainiestMonth.rainfall > 0) {
        const label = rainiestMonth.period
            ? formatMonth(rainiestMonth.period)
            : formatDate(rainiestMonth.date);
        advisories.push(
            `${climateSource === 'seasonal' ? 'Seasonal outlook' : '10-day forecast'} indicates the highest rainfall in ${label} (${rainiestMonth.rainfall.toFixed(1)} mm).`
        );
        recommendations.push(
            `Plan malaria prevention outreach ahead of ${label}; promote removal of standing water and consistent use of insecticide-treated nets.`
        );
    }

    const warmestPeriod = climateRows
        .filter((row) => Number.isFinite(row.temperature))
        .sort((a, b) => b.temperature - a.temperature)[0];
    if (warmestPeriod) {
        const label = warmestPeriod.period ? formatMonth(warmestPeriod.period) : formatDate(warmestPeriod.date);
        advisories.push(
            `${climateSource === 'seasonal' ? 'Seasonal outlook' : '10-day forecast'} indicates the highest temperature in ${label} (${warmestPeriod.temperature.toFixed(1)} °C).`
        );
        recommendations.push(
            `Align malaria surveillance and prevention messaging with the forecast warm period in ${label}.`
        );
    }

    const malariaPeak = getMalariaPeak({ dataValues, mapping, period, selectedOrgUnit });
    if (malariaPeak) {
        const month = formatMonth(malariaPeak.period);
        advisories.push(`The malaria median prediction peaks at ${Math.round(malariaPeak.value)} cases in ${month}.`);
        recommendations.push(
            `Review diagnostic supplies, antimalarial stock, staffing, and case reporting ahead of the predicted peak in ${month}.`
        );
    }

    const activeAlarmMonths = getActiveAlarmMonths({ dataValues, mapping, period, selectedOrgUnit });
    if (activeAlarmMonths.length > 0) {
        const alarmDetails = activeAlarmMonths
            .map(({ month, conditions }) => `${formatMonth(month)} (${conditions.join(', ')})`)
            .join('; ');
        const monthLabels = activeAlarmMonths.map(({ month }) => formatMonth(month));
        advisories.push(`Configured alarm indicators are active in ${alarmDetails}.`);
        recommendations.push(
            `Prioritize surveillance and response readiness during alarm months: ${monthLabels.join(', ')}.`
        );
    }

    return { climateSource, advisories, recommendations };
};
