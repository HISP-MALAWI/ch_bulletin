import React from 'react';
import {
    buildDistrictForecastStatuses,
    buildSelectedDistrictForecastRows,
} from '../utils/districtForecasts';
import { getMonthlyPeriods } from '../utils/getDataValues';

const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

const periodLabel = (period) => {
    const date = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1));
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date);
};

const ForecastValue = ({ value }) => (
    value === null || value === undefined ? '—' : numberFormat.format(value)
);

const SelectedDistrictForecastTable = ({ style, district, rows, isConfigured }) => (
    <section className={`${style.sectionCard} ${style.districtRiskSummary}`}>
        <div className={style.sectionHeader}>
            <h2 className={style.casesChartTitle}>District forecast risk</h2>
        </div>
        <p className={style.casesChartSubtitle}>
            Monthly malaria predictions and risk status for {district.displayName || district.name || district.id}.
        </p>
        {!isConfigured ? (
            <p className={style.districtForecastEmpty}>
                Configure malaria threshold, prediction bounds, median prediction, or alarm indicators to display the forecast.
            </p>
        ) : rows.length > 0 ? (
            <div className={style.districtForecastTableWrap}>
                <table className={style.districtForecastTable}>
                    <thead>
                        <tr>
                            <th>Forecast month</th>
                            <th>Threshold</th>
                            <th>Lower limit</th>
                            <th>Median prediction</th>
                            <th>Upper limit</th>
                            <th>Alarm indication</th>
                            <th>Risk category</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.period}>
                                <td>{periodLabel(row.period)}</td>
                                <td><ForecastValue value={row.threshold} /></td>
                                <td><ForecastValue value={row.predictionLowerBound} /></td>
                                <td><ForecastValue value={row.predictionMedian} /></td>
                                <td><ForecastValue value={row.predictionUpperBound} /></td>
                                <td>
                                    {row.alarm === 1 ? (
                                        <span className={`${style.districtForecastBadge} ${style.districtForecastBadgeAlert}`}>
                                            Alarm
                                        </span>
                                    ) : row.alarm === 0 ? 'No' : '—'}
                                </td>
                                <td>
                                    <span className={`${style.districtForecastBadge} ${style[`districtForecastBadge${row.status[0].toUpperCase()}${row.status.slice(1)}`]}`}>
                                        {row.status === 'unavailable'
                                            ? 'No data'
                                            : `${row.status[0].toUpperCase()}${row.status.slice(1)}`}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <p className={style.districtForecastEmpty}>No forecast months are available for this bulletin period.</p>
        )}
        <p className={style.districtForecastTableNote}>
            Alert is triggered by an alarm indication. Watch means the median prediction is at least 75% of, but below, the threshold.
        </p>
    </section>
);

const DistrictList = ({ style, title, districts, variant, emptyMessage }) => (
    <section className={`${style.districtRiskList} ${variant === 'alert'
        ? style.districtRiskAlert
        : variant === 'watch'
            ? style.districtRiskWatch
            : style.districtRiskNormal}`}>
        <h3>{title} <span>{districts.length}</span></h3>
        {districts.length > 0 ? (
            <ul>
                {districts.map((district) => (
                    <li key={district.id}>
                        <strong>{district.name}</strong>
                        <span>
                            {district.predictionMedian === null
                                ? district.period
                                : `${district.period}: ${numberFormat.format(district.predictionMedian)} / ${numberFormat.format(district.threshold)}`}
                        </span>
                    </li>
                ))}
            </ul>
        ) : (
            <p>{emptyMessage}</p>
        )}
    </section>
);

const DistrictRiskMap = ({ style, districts, alerts, watches }) => {
    const riskByDistrict = new Map([
        ...alerts.map((district) => [district.id, 'alert']),
        ...watches.map((district) => [district.id, 'watch']),
    ]);

    return (
        <section className={style.districtRiskMap} aria-label="District alert risk map">
            <h3>Districts on alert — risk map</h3>
            <div className={style.districtRiskLegend} aria-label="Risk categories">
                <span><i className={style.districtRiskLegendAlert} />Alert</span>
                <span><i className={style.districtRiskLegendWatch} />Watch</span>
                <span><i className={style.districtRiskLegendNormal} />Normal</span>
            </div>
            {districts.length > 0 ? (
                <div className={style.districtRiskTiles}>
                    {districts.map((district) => {
                        const risk = riskByDistrict.get(district.id) || 'normal';
                        const name = district.displayName || district.name || district.id;
                        return (
                            <span
                                key={district.id}
                                className={`${style.districtRiskTile} ${style[`districtRiskTile${risk[0].toUpperCase()}${risk.slice(1)}`]}`}
                                title={`${name}: ${risk}`}
                                aria-label={`${name}: ${risk}`}
                            >
                                {name}
                            </span>
                        );
                    })}
                </div>
            ) : (
                <p className={style.districtRiskMapEmpty}>
                    No district-level units are available under this selection.
                </p>
            )}
            <p className={style.districtRiskMapCaption}>
                Schematic representation of the {districts.length} monitored districts coloured by forecast risk.
            </p>
        </section>
    );
};

const DistrictRiskSummary = ({
    style,
    dataValues = [],
    mapping = [],
    period,
    orgUnits = [],
    selectedOrgUnitId,
}) => {
    const forecastPeriods = React.useMemo(
        () => period ? getMonthlyPeriods(period, 0, 3) : [],
        [period]
    );
    const status = React.useMemo(
        () => buildDistrictForecastStatuses({
            dataValues,
            mapping,
            periods: forecastPeriods,
            orgUnits,
            selectedOrgUnitId,
        }),
        [dataValues, forecastPeriods, mapping, orgUnits, selectedOrgUnitId]
    );

    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnitId);
    const selectedDistrictForecast = React.useMemo(
        () => buildSelectedDistrictForecastRows({
            dataValues,
            mapping,
            periods: forecastPeriods,
            selectedOrgUnitId,
        }),
        [dataValues, forecastPeriods, mapping, selectedOrgUnitId]
    );

    if (Number(selectedUnit?.level) === 3) {
        return (
            <SelectedDistrictForecastTable
                style={style}
                district={selectedUnit}
                rows={selectedDistrictForecast.rows}
                isConfigured={selectedDistrictForecast.isConfigured}
            />
        );
    }

    if (!status) return null;

    const noForecastData = status.alerts.length === 0 && status.watches.length === 0;
    let emptyMessage = 'No districts in this category.';
    if (!status.isConfigured) {
        emptyMessage = 'Configure malaria alarm indicators and, for Watch status, threshold and median prediction indicators.';
    } else if (status.districts.length === 0) {
        emptyMessage = 'No district-level units are available under this selection.';
    } else if (noForecastData) {
        emptyMessage = 'No alert or watch districts were identified from available forecast data.';
    }

    return (
        <section className={`${style.sectionCard} ${style.districtRiskSummary}`}>
            <div className={style.sectionHeader}>
                <h2 className={style.casesChartTitle}>District forecast risk</h2>
            </div>
            <p className={style.casesChartSubtitle}>
                Alerts are based on configured alarm indicators. Watch districts have a predicted median at least 75% of, but below, the configured threshold.
            </p>
            <div className={style.districtForecastLayout}>
                <DistrictRiskMap
                    style={style}
                    districts={status.districts}
                    alerts={status.alerts}
                    watches={status.watches}
                />
                <div className={style.districtRiskGrid}>
                    <DistrictList
                        style={style}
                        title="Alert districts"
                        districts={status.alerts}
                        variant="alert"
                        emptyMessage={emptyMessage}
                    />
                    <DistrictList
                        style={style}
                        title="Watch districts"
                        districts={status.watches}
                        variant="watch"
                        emptyMessage={emptyMessage}
                    />
                    <DistrictList
                        style={style}
                        title="Normal districts"
                        districts={status.normal}
                        variant="normal"
                        emptyMessage="No districts are classified as Normal."
                    />
                </div>
                </div>
        </section>
    );
};

export default DistrictRiskSummary;
