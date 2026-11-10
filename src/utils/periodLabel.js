import { getMonthlyPeriods } from './getDataValues';

const monthYear = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthOnly = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });

const toDate = (period) => new Date(
    Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1)
);

/**
 * A run of months as a reader would say it: "Sep–Dec 2026" when the run stays
 * inside one year, and "Sep 2026–Feb 2027" when it crosses into the next.
 */
export const formatPeriodRange = (periods = []) => {
    if (!periods.length) {
        return '';
    }

    const first = toDate(periods[0]);
    const last = toDate(periods[periods.length - 1]);
    const firstYear = first.getUTCFullYear();
    const lastYear = last.getUTCFullYear();

    return firstYear === lastYear
        ? `${monthOnly.format(first)}–${monthOnly.format(last)} ${firstYear}`
        : `${monthYear.format(first)}–${monthYear.format(last)}`;
};

/**
 * The window a bulletin covers: the month it was written for plus the months its
 * forecast looks ahead to. The scenario cards and the letterhead both report
 * this, so it is described in one place.
 */
export const describeForecastWindow = (period, monthsForward = 3) => {
    const periods = getMonthlyPeriods(period, 0, monthsForward);

    return {
        periods,
        months: periods.length,
        label: formatPeriodRange(periods),
    };
};
