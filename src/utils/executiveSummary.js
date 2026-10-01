import { getMonthlyPeriods } from './getDataValues';
import { buildSelectedUnitMalariaData, summariseForecast } from './monthlyMalariaData';

const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const numberFormat = new Intl.NumberFormat('en');

const toMonthLabel = (period) => monthLabel.format(new Date(
    Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1)
));

const round = (value) => numberFormat.format(Math.round(value));

// Each clause is written to follow the month label after a colon, so it starts
// in lower case and the whole sentence reads as one.
const describeMalaria = (row, month) => {
    if (!row || !Number.isFinite(row.predictionMedian)) {
        return '';
    }

    const median = round(row.predictionMedian);

    // A threshold is not always mapped. Saying what the median is beats saying
    // nothing, and it is honest about there being nothing to compare against.
    if (!month) {
        return `the predicted median is ${median} cases`;
    }

    const threshold = round(month.threshold);

    if (month.status === 'alert') {
        return `the predicted median of ${median} cases is above the alert threshold of ${threshold}`;
    }
    if (month.status === 'watch') {
        return `the predicted median of ${median} cases is approaching the alert threshold of ${threshold}`;
    }
    return `the predicted median of ${median} cases stays below the alert threshold of ${threshold}`;
};

const describeClimate = (row) => {
    if (!row) {
        return '';
    }

    const measures = [];
    if (Number.isFinite(row.rainfall)) {
        measures.push(`${row.rainfall.toFixed(1)} mm of rainfall`);
    }
    if (Number.isFinite(row.temperature)) {
        measures.push(`a mean temperature of ${row.temperature.toFixed(1)} °C`);
    }

    return measures.length ? `the outlook is for ${measures.join(' and ')}` : '';
};

/**
 * Drafts one line per forecast month, saying what that month holds.
 *
 * The climate series and the forecast window do not reliably overlap — the
 * seasonal months always run October to April, while the forecast window is
 * four months from the bulletin's period — so a month often has a malaria
 * prediction and no climate reading. Each line is built from the clauses its
 * month actually supports, and a month supporting none is left out rather than
 * padded.
 *
 * These are drafts for an author to edit, so the prose is plain English rather
 * than translated, as `buildHealthGuidance` already is.
 */
export const buildExecutiveSummaryDrafts = ({
    period,
    dataValues = [],
    mapping = [],
    selectedOrgUnit,
    seasonalClimateRows = [],
}) => {
    const periods = getMonthlyPeriods(period, 0, 3);

    if (!periods.length) {
        return [];
    }

    const { rows } = buildSelectedUnitMalariaData({
        dataValues,
        mapping,
        periods,
        selectedOrgUnit,
    });
    const { months } = summariseForecast({ rows });

    const malariaByPeriod = new Map(rows.map((row) => [row.period, row]));
    const monthByPeriod = new Map(months.map((month) => [month.period, month]));
    const climateByPeriod = new Map(seasonalClimateRows.map((row) => [row.period, row]));

    return periods
        .map((forecastPeriod) => {
            const clauses = [
                describeMalaria(malariaByPeriod.get(forecastPeriod), monthByPeriod.get(forecastPeriod)),
                describeClimate(climateByPeriod.get(forecastPeriod)),
            ].filter(Boolean);

            if (!clauses.length) {
                return null;
            }

            return `${toMonthLabel(forecastPeriod)}: ${clauses.join(', and ')}.`;
        })
        .filter(Boolean);
};
