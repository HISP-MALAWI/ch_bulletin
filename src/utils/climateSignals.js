/**
 * A weather forecast read as one row per day: how much rain fell and how warm
 * the day got.
 *
 * Two shapes arrive here. The MET Norway locationforecast the editor fetches
 * wraps its days in `properties.timeseries` with the figures under
 * `data.instant.details`; the seasonal chart's own rows are already flat. Both
 * are normalised to `{ date, rainfall, temperature }` so the caller does not
 * have to know which it was given.
 *
 * The module used to be `healthGuidance.js`, and to build health advisories and
 * recommendations from these rows as well. Those sections are not part of the
 * bulletin any more, so what is left is the reading itself — the district
 * actions section is what still wants it.
 */

const getForecastEntries = (forecast) => {
    const entries = forecast?.properties?.timeseries ?? forecast?.timeseries ?? forecast;
    return Array.isArray(entries) ? entries : [];
};

export const getClimateSignals = (forecast) => {
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
