import React from 'react';
import {
    buildDistrictAlertRows,
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

// The peak column is one month inside a window of four, so the year is written
// short rather than dropped: a window that crosses a year boundary would
// otherwise name a month the reader has to place themselves.
const peakLabel = (period) => {
    const date = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1));
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        year: '2-digit',
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

/**
 * The alerted districts in full, under the map: which month each one is
 * expected to peak in, that month's prediction beside its threshold, how far
 * above it runs, and over how many of the forecast months. The map says how
 * many districts are on alert; this says which and by how much.
 */
const AlertDistrictTable = ({ style, rows }) => {
    if (rows.length === 0) return null;

    return (
        <section className={style.districtAlertTable} aria-label="Districts on alert">
            <h3>
                Districts on alert <span>({rows.length})</span>
            </h3>
            <p className={style.districtAlertTableNote}>
                Ranked by forecast cases above threshold.
            </p>
            <div className={style.districtForecastTableWrap}>
                <table className={style.districtForecastTable}>
                    <thead>
                        <tr>
                            <th>District</th>
                            <th>Region</th>
                            <th>Peak</th>
                            <th>Median</th>
                            <th>Threshold</th>
                            <th>Excess</th>
                            <th>Months</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id}>
                                <td>{row.name}</td>
                                <td>{row.region || '—'}</td>
                                <td>{row.peakPeriod ? peakLabel(row.peakPeriod) : '—'}</td>
                                <td><ForecastValue value={row.peakMedian} /></td>
                                <td><ForecastValue value={row.peakThreshold} /></td>
                                <td>
                                    {row.excess === null
                                        ? '—'
                                        : `${row.excess > 0 ? '+' : ''}${row.excess}%`}
                                </td>
                                <td>{row.monthsAbove}/{row.monthsTotal}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
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

    const alertRows = React.useMemo(
        () => buildDistrictAlertRows({
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

    return (
        <section className={`${style.sectionCard} ${style.districtRiskSummary}`}>
            <div className={style.sectionHeader}>
                <h2 className={style.casesChartTitle}>District forecast risk</h2>
            </div>
            <p className={style.casesChartSubtitle}>
                Alerts are based on configured alarm indicators. Watch districts have a predicted median at least 75% of, but below, the configured threshold.
            </p>
            <DistrictRiskMap
                style={style}
                districts={status.districts}
                alerts={status.alerts}
                watches={status.watches}
            />
            <AlertDistrictTable style={style} rows={alertRows} />
        </section>
    );
};

export default DistrictRiskSummary;
