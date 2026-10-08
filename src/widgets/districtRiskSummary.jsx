import React from 'react';
import { useDataEngine } from '@dhis2/app-runtime';
import {
    buildDistrictAlertRows,
    buildDistrictForecastStatuses,
    buildSelectedDistrictForecastRows,
    shortDistrictName,
} from '../utils/districtForecasts';
import { getDistrictBoundaries, readLocalBoundaries } from '../utils/districtBoundaries';
import { buildDistrictMap } from '../utils/districtMapGeometry';
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

const capitalise = (value) => `${value[0].toUpperCase()}${value.slice(1)}`;

const districtName = (district) => district.displayName || district.name || district.id;

/**
 * The districts coloured by forecast risk, drawn from their real boundaries.
 *
 * The boundaries are the organisation units' own geometry, so the editor — whose
 * unit query already asks for `geometry` — draws from what it has and makes no
 * request at all. The preview loads its units without geometry, so it is the
 * preview that fetches, once for the session.
 *
 * Until they arrive the box is already the height the map will be. That is not a
 * style choice: the PDF export measures its page breaks from this layout, so a
 * section that grew when the drawing landed would push every cut below it out of
 * step.
 *
 * A district with no boundary is not quietly dropped — it is counted under the
 * map — and if nothing can be drawn at all the tiles return in its place.
 */
const DistrictRiskMap = ({ style, districts, alerts, watches }) => {
    const engine = useDataEngine();

    // Districts the editor already has geometry for are drawn from it on the
    // first render, so no loading state is shown where none is needed.
    const localBoundaries = React.useMemo(() => readLocalBoundaries(districts), [districts]);
    const [fetchedBoundaries, setFetchedBoundaries] = React.useState(null);

    React.useEffect(() => {
        if (localBoundaries) return undefined;

        let cancelled = false;

        getDistrictBoundaries(districts, engine).then((boundaries) => {
            if (!cancelled) setFetchedBoundaries(boundaries);
        });

        return () => {
            cancelled = true;
        };
    }, [districts, engine, localBoundaries]);

    // Null until the boundaries have been resolved one way or the other, which
    // is what tells the loading box from the fallback.
    const boundaries = localBoundaries || fetchedBoundaries;

    const riskByDistrict = React.useMemo(
        () => new Map([
            ...alerts.map((district) => [district.id, 'alert']),
            ...watches.map((district) => [district.id, 'watch']),
        ]),
        [alerts, watches]
    );

    const namesById = React.useMemo(
        () => new Map(districts.map((district) => [district.id, districtName(district)])),
        [districts]
    );

    const map = React.useMemo(
        () => buildDistrictMap({ features: boundaries || [], districts }),
        [boundaries, districts]
    );

    const riskOf = (id) => riskByDistrict.get(id) || 'normal';
    const riskClass = (id) => style[`districtRiskMap${capitalise(riskOf(id))}`];
    const nameOf = (id) => namesById.get(id) || id;

    // Every district that was drawn is named on the map, not only the ones on
    // alert: a map that has to be read against the table beside it to be
    // understood is half a map. The names are the short form — the "-DHO" every
    // unit carries is on twenty-nine labels and says nothing — and the alerts
    // keep a larger, heavier one, so the eye still lands on them first in a
    // drawing this crowded. The full name stays in the hover title above.
    const labelled = map.areas.filter((area) => area.anchor);

    // No count beside "hospitals": a zone can hold exactly one and "the 1
    // hospitals" is worse than saying nothing. Which ones they are is in the
    // hover title on the marker.
    const caption = map.viewBox
        ? [
            'District boundaries from the DHIS2 registry, coloured by forecast risk.',
            map.points.length > 0
                ? 'Hospitals are drawn as points rather than areas.'
                : null,
        ].filter(Boolean).join(' ')
        : `Schematic representation of the ${districts.length} monitored districts coloured by forecast risk.`;

    const renderTiles = () => (
        <div className={style.districtRiskTiles}>
            {districts.map((district) => {
                const risk = riskOf(district.id);
                const name = nameOf(district.id);
                return (
                    <span
                        key={district.id}
                        className={`${style.districtRiskTile} ${style[`districtRiskTile${capitalise(risk)}`]}`}
                        title={`${name}: ${risk}`}
                        aria-label={`${name}: ${risk}`}
                    >
                        {name}
                    </span>
                );
            })}
        </div>
    );

    return (
        <section className={style.districtRiskMap} aria-label="District alert risk map">
            <h3>Districts on alert — risk map</h3>
            <div className={style.districtRiskLegend} aria-label="Risk categories">
                <span><i className={style.districtRiskLegendAlert} />Alert</span>
                <span><i className={style.districtRiskLegendWatch} />Watch</span>
                <span><i className={style.districtRiskLegendNormal} />Normal</span>
            </div>
            {districts.length === 0 ? (
                <p className={style.districtRiskMapEmpty}>
                    No district-level units are available under this selection.
                </p>
            ) : boundaries === null ? (
                // The same height as the map below it, so the section does not
                // move when the boundaries arrive. `data-pdf-pending` holds a
                // download back until they have.
                <div className={style.districtRiskMapViewport} data-pdf-pending>
                    <p className={style.districtRiskMapEmpty}>Loading district boundaries…</p>
                </div>
            ) : map.viewBox ? (
                <div className={style.districtRiskMapViewport}>
                    <svg
                        className={style.districtRiskMapSvg}
                        viewBox={map.viewBox}
                        width={map.width}
                        height={map.height}
                        preserveAspectRatio="xMidYMid meet"
                        role="img"
                        aria-label={`Map of ${districts.length} monitored districts coloured by forecast risk`}
                    >
                        {map.areas.map((area) => (
                            <path
                                key={area.id}
                                className={`${style.districtRiskMapArea} ${riskClass(area.id)}`}
                                d={area.d}
                                fillRule="evenodd"
                            >
                                <title>{`${nameOf(area.id)}: ${riskOf(area.id)}`}</title>
                            </path>
                        ))}
                        {map.points.map((point) => (
                            <circle
                                key={point.id}
                                className={`${style.districtRiskMapPoint} ${riskClass(point.id)}`}
                                cx={point.x}
                                cy={point.y}
                                r={3.5}
                            >
                                <title>{`${nameOf(point.id)}: ${riskOf(point.id)}`}</title>
                            </circle>
                        ))}
                        {labelled.map((area) => (
                            <text
                                key={area.id}
                                className={`${style.districtRiskMapLabel} ${
                                    riskByDistrict.get(area.id) === 'alert'
                                        ? style.districtRiskMapLabelAlert
                                        : ''
                                }`}
                                x={area.anchor.x}
                                y={area.anchor.y}
                                textAnchor="middle"
                                dy="0.32em"
                            >
                                {shortDistrictName(nameOf(area.id))}
                            </text>
                        ))}
                    </svg>
                </div>
            ) : (
                renderTiles()
            )}
            <p className={style.districtRiskMapCaption}>{caption}</p>
            {/* Only beside a drawing: when nothing could be drawn the tiles and
                the caption above already say so, and naming the count twice
                reads as two different problems. */}
            {map.viewBox && map.missing.length > 0 ? (
                <p className={style.districtRiskMapEmpty}>
                    No boundary is available for {map.missing.length}{' '}
                    {map.missing.length === 1 ? 'district' : 'districts'} under this selection.
                </p>
            ) : null}
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
            {/* With no alerts there is no table to sit beside, so the map takes
                the whole width rather than leaving two thirds of the row empty. */}
            <div className={`${style.districtRiskRow} ${alertRows.length === 0 ? style.districtRiskRowWide : ''}`}>
                <DistrictRiskMap
                    style={style}
                    districts={status.districts}
                    alerts={status.alerts}
                    watches={status.watches}
                />
                <AlertDistrictTable style={style} rows={alertRows} />
            </div>
        </section>
    );
};

export default DistrictRiskSummary;
