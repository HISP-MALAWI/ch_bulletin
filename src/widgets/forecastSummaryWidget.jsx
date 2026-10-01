import React from 'react';
import { countMappedAlerts, sumMappedPredictionValues } from '../utils/monthlyMalariaData';
import { describeForecastWindow } from '../utils/periodLabel';

const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

const ForecastSummaryWidget = ({ style, dataValues = [], mapping = [], period, organisationUnit, orgUnits = [] }) => {
    const forecastWindow = describeForecastWindow(period);
    const forecastPeriods = forecastWindow.periods;
    const selectedOrgUnitName = orgUnits.find((unit) => unit.id === organisationUnit)?.displayName || 'Selected area';
    const detail = `${selectedOrgUnitName} · ${forecastWindow.label || 'Forecast period unavailable'} · ${forecastPeriods.length} months`;
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