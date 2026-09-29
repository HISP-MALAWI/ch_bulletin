import React from 'react';
import { getMonthlyPeriods } from '../utils/getDataValues';
import { countMappedAlerts, sumMappedPredictionValues } from '../utils/monthlyMalariaData';

const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const monthFormat = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });

const getForecastPeriodLabel = (periods) => {
    if (periods.length === 0) return 'Forecast period unavailable';

    const firstDate = new Date(Date.UTC(Number(periods[0].slice(0, 4)), Number(periods[0].slice(4, 6)) - 1, 1));
    const lastDate = new Date(Date.UTC(Number(periods.at(-1).slice(0, 4)), Number(periods.at(-1).slice(4, 6)) - 1, 1));
    const firstYear = firstDate.getUTCFullYear();
    const lastYear = lastDate.getUTCFullYear();
    const firstMonth = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(firstDate);
    const lastMonth = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(lastDate);

    return firstYear === lastYear
        ? `${firstMonth}–${lastMonth} ${firstYear}`
        : `${monthFormat.format(firstDate)}–${monthFormat.format(lastDate)}`;
};

const ForecastSummaryWidget = ({ style, dataValues = [], mapping = [], period, organisationUnit, orgUnits = [] }) => {
    const forecastPeriods = period ? getMonthlyPeriods(period, 0, 3) : [];
    const selectedOrgUnitName = orgUnits.find((unit) => unit.id === organisationUnit)?.displayName || 'Selected area';
    const detail = `${selectedOrgUnitName} · ${getForecastPeriodLabel(forecastPeriods)} · ${forecastPeriods.length} months`;
    const alertCount = countMappedAlerts({ dataValues, mapping, periods: forecastPeriods, selectedOrgUnit: organisationUnit });
    const scenarios = [
        {
            label: 'Expected scenario (median)',
            value: sumMappedPredictionValues({ dataValues, mapping, periods: forecastPeriods, selectedOrgUnit: organisationUnit, predictionField: 'predictionMedian' }),
            detail,
        },
        {
            label: 'Worst case (upper bound, Q90)',
            value: sumMappedPredictionValues({ dataValues, mapping, periods: forecastPeriods, selectedOrgUnit: organisationUnit, predictionField: 'predictionUpperBound' }),
            detail,
        },
        {
            label: 'Best case (lower bound, Q10)',
            value: sumMappedPredictionValues({ dataValues, mapping, periods: forecastPeriods, selectedOrgUnit: organisationUnit, predictionField: 'predictionLowerBound' }),
            detail,
        },
        {
            label: 'Alerts in forecast period',
            value: alertCount,
            detail: alertCount === null
                ? 'No alarm data available'
                : alertCount > 0
                    ? 'Forecast months above threshold'
                    : 'No threshold alerts forecast',
            alert: alertCount > 0,
        },
    ];

    return (
        <div className={style.forecastSummary} aria-label="Forecast scenario summary">
            {scenarios.map(({ label, value, detail: scenarioDetail, alert }) => (
                <article
                    className={`${style.forecastSummaryCard} ${alert ? style.forecastSummaryAlert : ''}`}
                    key={label}
                >
                    <h2 className={style.forecastSummaryLabel}>{label}</h2>
                    <p className={style.forecastSummaryValue}>
                        {typeof value === 'number' ? numberFormat.format(value) : value ?? '—'}
                    </p>
                    <p className={style.forecastSummaryDetail}>{scenarioDetail}</p>
                </article>
            ))}
        </div>
    );
};

export default ForecastSummaryWidget;