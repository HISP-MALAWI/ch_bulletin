import React from 'react';
import i18n from '@dhis2/d2-i18n';
import { useDataEngine } from '@dhis2/app-runtime';
import {
    buildDistrictForecastStatuses,
    buildDistrictRiskTable,
    buildSelectedDistrictForecastRows,
    getDistrictRiskFromRows,
} from '../utils/districtForecasts';
import {
    getNationalDistrictBoundaries,
    readNationalBoundaries,
} from '../utils/districtBoundaries';
import {
    MAX_MAP_ZOOM,
    MIN_MAP_ZOOM,
    buildMapLayout,
} from '../utils/districtMapTiles';
import { getMonthlyPeriods } from '../utils/getDataValues';
import { resolveHighlightedDistricts } from '../utils/mapHighlight';
import MapHighlightControl from './mapHighlightControl';

const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

const TOOLTIP_WIDTH = 190;
const TOOLTIP_HEIGHT = 120;
const TOOLTIP_MARGIN = 8;

// The same three colours the CSS publishes as `--risk-*`, repeated as SVG
// presentation attributes: html2canvas clones SVG nodes into the PDF, and the
// attributes make the export independent of whether the cloned styles survived.
const RISK_COLOURS = {
    alert: '#c51627',
    watch: '#e3a400',
    normal: '#27813c',
    outside: '#cbd5e1',
};

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

const SelectedDistrictForecastTable = ({ style, district, rows, isConfigured }) => {
    const name = district.displayName || district.name || district.id;

    return (
        <section className={style.districtAlertTable} aria-label={`Monthly forecast for ${name}`}>
            <h3>Monthly forecast — {name}</h3>
            <p className={style.districtAlertTableNote}>
                Monthly malaria predictions and risk status for this district.
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
};

const capitalise = (value) => `${value[0].toUpperCase()}${value.slice(1)}`;

const riskLabel = (risk) =>
    risk === 'outside' ? 'Not highlighted / unavailable' : capitalise(risk);

/**
 * The whole country's districts, coloured by the forecast risk of the selection
 * and greyed everywhere else, on top of OpenStreetMap tiles.
 *
 * The editor's organisation-unit query already asks for `geometry`, so its map
 * draws on the first pass and makes no request. The preview loads its units
 * without geometry, so the widget fetches the national level-3 list once for
 * the session; `getNationalDistrictBoundaries` caches it.
 *
 * The box keeps the height the map will have before the boundaries arrive. That
 * is not a style choice: the PDF export measures its page breaks from this
 * layout, so a section that grew when the map landed would push every cut below
 * it out of step. For the same reason the SVG is only rendered once the
 * viewport has been measured — the export inlines the tile elements, and React
 * must not replace them afterwards.
 */
const DistrictRiskMap = ({
    style,
    orgUnits,
    districts,
    forecastRowsByDistrict,
    isConfigured,
}) => {
    const engine = useDataEngine();
    const viewportRef = React.useRef(null);
    const tooltipId = React.useId();
    // A unique, CSS-safe id for the clip path that keeps the basemap inside
    // Malawi. `useId` can contain colons, which are awkward in `url(#…)`.
    const mapClipId = `district-map-clip-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const [viewportSize, setViewportSize] = React.useState(null);
    const [zoomLevel, setZoomLevel] = React.useState(0);
    const [hovered, setHovered] = React.useState(null);
    const [fetched, setFetched] = React.useState(null);

    const localBoundaries = React.useMemo(
        () => readNationalBoundaries(orgUnits),
        [orgUnits]
    );

    React.useEffect(() => {
        if (localBoundaries) return undefined;
        // The header query may still be in flight; fetching before it answers
        // would pull the whole 2 MB list for an editor that already has it.
        if (orgUnits.length === 0) return undefined;

        let cancelled = false;

        getNationalDistrictBoundaries(engine).then((result) => {
            if (!cancelled) setFetched(result);
        });

        return () => {
            cancelled = true;
        };
    }, [localBoundaries, orgUnits.length, engine]);

    const boundaries = localBoundaries || fetched?.boundaries || null;
    const boundaryError = fetched?.error || null;

    React.useLayoutEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return undefined;

        const measure = () => {
            const rect = viewport.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setViewportSize({ width: rect.width, height: rect.height });
            }
        };

        measure();

        if (typeof ResizeObserver === 'undefined') return undefined;

        const observer = new ResizeObserver(measure);
        observer.observe(viewport);
        return () => observer.disconnect();
    }, []);

    const mapLayout = React.useMemo(
        () => (boundaries && viewportSize
            ? buildMapLayout(boundaries, {
                width: viewportSize.width,
                height: viewportSize.height,
                zoomLevel,
            })
            : null),
        [boundaries, viewportSize, zoomLevel]
    );

    const selectedIds = React.useMemo(
        () => new Set(districts.map((district) => district.id)),
        [districts]
    );
    const namesById = React.useMemo(
        () => new Map((boundaries || []).map((feature) => [
            feature.id,
            feature.displayName || feature.id,
        ])),
        [boundaries]
    );
    const featureIds = React.useMemo(
        () => new Set((boundaries || []).map((feature) => feature.id)),
        [boundaries]
    );
    const unmappedUnits = React.useMemo(
        () => districts.filter((district) => !featureIds.has(district.id)),
        [districts, featureIds]
    );

    const nameOf = (id) => namesById.get(id) || id;
    const riskOf = (id) => {
        if (!isConfigured || !selectedIds.has(id)) return 'outside';
        return getDistrictRiskFromRows(forecastRowsByDistrict?.get(id)) || 'outside';
    };

    const changeZoom = (delta) => {
        setZoomLevel((current) => Math.max(
            MIN_MAP_ZOOM,
            Math.min(MAX_MAP_ZOOM, current + delta)
        ));
        setHovered(null);
    };

    // React registers `wheel` passively at the root, so `onWheel` cannot stop
    // the page scrolling while the map zooms. A native listener can.
    React.useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return undefined;

        let frame = null;
        const onWheel = (event) => {
            if (!mapLayout) return;
            event.preventDefault();
            if (frame !== null) return;
            frame = requestAnimationFrame(() => {
                frame = null;
                changeZoom(event.deltaY < 0 ? 1 : -1);
            });
        };

        viewport.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            viewport.removeEventListener('wheel', onWheel);
            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, [mapLayout]);

    const placeTooltip = (id, point) => {
        const viewport = viewportRef.current?.getBoundingClientRect();
        if (!viewport) return;

        const maxX = Math.max(TOOLTIP_MARGIN, viewport.width - TOOLTIP_WIDTH - TOOLTIP_MARGIN);
        const maxY = Math.max(TOOLTIP_MARGIN, viewport.height - TOOLTIP_HEIGHT - TOOLTIP_MARGIN);

        setHovered({
            id,
            x: Math.max(TOOLTIP_MARGIN, Math.min(point.x, maxX)),
            y: Math.max(TOOLTIP_MARGIN, Math.min(point.y, maxY)),
        });
    };

    const showTooltipFromMouse = (event, id) => {
        const viewport = viewportRef.current?.getBoundingClientRect();
        if (!viewport) return;

        placeTooltip(id, {
            x: event.clientX - viewport.left + 12,
            y: event.clientY - viewport.top + 12,
        });
    };

    // A FocusEvent carries no client coordinates; the path's own box does.
    const showTooltipFromFocus = (event, id) => {
        const viewport = viewportRef.current?.getBoundingClientRect();
        const target = event.currentTarget.getBoundingClientRect();
        if (!viewport) return;

        placeTooltip(id, {
            x: target.left - viewport.left + target.width / 2,
            y: target.top - viewport.top + target.height / 2,
        });
    };

    const hoveredRows = (forecastRowsByDistrict?.get(hovered?.id) || [])
        .filter((row) => row.status !== 'unavailable');
    const hoveredRisk = hovered ? riskOf(hovered.id) : 'outside';

    const featureClass = (risk) => style[`districtRiskMapFeature${capitalise(risk)}`];

    const shapeProps = (id) => ({
        tabIndex: 0,
        'aria-label': `${nameOf(id)}: ${riskLabel(riskOf(id))}`,
        'aria-describedby': hovered?.id === id ? tooltipId : undefined,
        onMouseEnter: (event) => showTooltipFromMouse(event, id),
        onMouseMove: (event) => showTooltipFromMouse(event, id),
        onMouseLeave: () => setHovered(null),
        onFocus: (event) => showTooltipFromFocus(event, id),
        onBlur: () => setHovered(null),
    });

    return (
        <section className={style.districtRiskMap} aria-label="District forecast risk map">
            <h3>District forecast risk map</h3>
            <div className={style.districtRiskLegend} aria-label="Risk categories">
                <span><i className={style.districtRiskLegendAlert} />Alert</span>
                <span><i className={style.districtRiskLegendWatch} />Watch</span>
                <span><i className={style.districtRiskLegendNormal} />Normal</span>
                <span><i className={style.districtRiskLegendOutside} />Not highlighted / unavailable</span>
            </div>
            <div className={style.districtRiskMapViewport} ref={viewportRef}>
                {boundaryError ? (
                    <p className={style.districtRiskMapEmpty}>
                        Could not load district boundaries: {boundaryError.message || 'DHIS2 request failed.'}
                    </p>
                ) : boundaries === null || viewportSize === null ? (
                    <p className={style.districtRiskMapEmpty} data-pdf-pending>
                        Loading district boundaries from DHIS2…
                    </p>
                ) : mapLayout ? (
                    <svg
                        className={style.districtRiskSvg}
                        viewBox={mapLayout.viewBox}
                        width={mapLayout.width}
                        height={mapLayout.height}
                        role="group"
                        aria-label="District boundaries from DHIS2 over OpenStreetMap"
                    >
                        {/* The tiles are clipped to the districts, so the
                            basemap shows Malawi and none of the place names
                            around it. The district paths below still draw the
                            full country. */}
                        {mapLayout.areas.length > 0 && (
                            <defs>
                                <clipPath id={mapClipId} clipRule="evenodd">
                                    {mapLayout.areas.map((area) => (
                                        <path key={area.id} d={area.d} />
                                    ))}
                                </clipPath>
                            </defs>
                        )}
                        <g
                            data-pdf-map-tiles
                            aria-hidden="true"
                            clipPath={mapLayout.areas.length > 0
                                ? `url(#${mapClipId})`
                                : undefined}
                        >
                            {mapLayout.tiles.map((tile) => (
                                <image
                                    key={tile.key}
                                    data-pdf-map-tile=""
                                    className={style.districtRiskMapTile}
                                    href={tile.href}
                                    x={tile.x}
                                    y={tile.y}
                                    width={tile.size}
                                    height={tile.size}
                                />
                            ))}
                        </g>
                        {mapLayout.areas.map((area) => {
                            const risk = riskOf(area.id);
                            return (
                                <path
                                    key={area.id}
                                    className={`${style.districtRiskMapFeature} ${featureClass(risk)}`}
                                    d={area.d}
                                    fill={RISK_COLOURS[risk]}
                                    fillOpacity={0.52}
                                    stroke="#ffffff"
                                    strokeWidth={1.2}
                                    strokeLinejoin="round"
                                    fillRule="evenodd"
                                    {...shapeProps(area.id)}
                                >
                                    <title>{`${nameOf(area.id)}: ${riskLabel(risk)}`}</title>
                                </path>
                            );
                        })}
                        {mapLayout.points.map((point) => {
                            const risk = riskOf(point.id);
                            return (
                                <circle
                                    key={point.id}
                                    className={`${style.districtRiskMapPoint} ${featureClass(risk)}`}
                                    cx={point.x}
                                    cy={point.y}
                                    r={3.5}
                                    fill={RISK_COLOURS[risk]}
                                    stroke="#ffffff"
                                    strokeWidth={1}
                                    {...shapeProps(point.id)}
                                >
                                    <title>{`${nameOf(point.id)}: ${riskLabel(risk)}`}</title>
                                </circle>
                            );
                        })}
                        {/* The tile licence requires visible attribution. It is
                            kept as a small corner credit rather than the old
                            caption line, and lives inside the SVG so it is
                            captured into the PDF too. */}
                        <a
                            href="https://www.openstreetmap.org/copyright"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <text
                                className={style.districtRiskMapAttribution}
                                x={mapLayout.width - 6}
                                y={mapLayout.height - 6}
                                textAnchor="end"
                                fontSize={8}
                                fill="#475569"
                                stroke="#ffffff"
                                strokeWidth={2}
                                paintOrder="stroke"
                            >
                                © OpenStreetMap contributors
                            </text>
                        </a>
                    </svg>
                ) : (
                    <p className={style.districtRiskMapEmpty}>
                        No district boundary geometries are available from the DHIS2 instance.
                    </p>
                )}
                {!boundaryError && mapLayout && (
                    <div
                        className={style.districtRiskMapZoomControls}
                        data-pdf-exclude
                        aria-label="Map zoom controls"
                    >
                        <button
                            type="button"
                            aria-label="Zoom in"
                            disabled={zoomLevel >= MAX_MAP_ZOOM}
                            onClick={() => changeZoom(1)}
                        >
                            +
                        </button>
                        <button
                            type="button"
                            aria-label="Zoom out"
                            disabled={zoomLevel <= MIN_MAP_ZOOM}
                            onClick={() => changeZoom(-1)}
                        >
                            −
                        </button>
                    </div>
                )}
                {hovered && mapLayout && (
                    <div
                        className={style.districtRiskTooltip}
                        data-pdf-exclude
                        id={tooltipId}
                        role="tooltip"
                        style={{ left: hovered.x, top: hovered.y }}
                    >
                        <strong>{nameOf(hovered.id)} · {riskLabel(hoveredRisk)}</strong>
                        {hoveredRows.length > 0 ? hoveredRows.map((row) => (
                            <div className={style.districtRiskTooltipRow} key={row.period}>
                                <span>{periodLabel(row.period)}</span>
                                <span>
                                    Median <ForecastValue value={row.predictionMedian} />
                                    {' · '}Lower <ForecastValue value={row.predictionLowerBound} />
                                    {' · '}Upper <ForecastValue value={row.predictionUpperBound} />
                                </span>
                            </div>
                        )) : (
                            <span>No forecast values available.</span>
                        )}
                    </div>
                )}
            </div>
            {districts.length === 0 && (
                <p className={style.districtRiskMapEmpty}>
                    No district-level units are available under this selection.
                </p>
            )}
            {mapLayout && unmappedUnits.length > 0 && (
                <p className={style.districtRiskMapCaption}>
                    {unmappedUnits.length} organisation unit
                    {unmappedUnits.length === 1 ? '' : 's'} in this selection
                    {unmappedUnits.length === 1 ? ' has' : ' have'} no boundary and
                    {unmappedUnits.length === 1 ? ' is' : ' are'} not drawn.
                </p>
            )}
        </section>
    );
};

/**
 * The title and explanatory line for the risk table's current mode. Alert rows
 * show how far above threshold the forecast runs; watch rows show how close;
 * top rows show the highest forecast medians when there is no risk at all.
 */
const riskTableCopy = (mode) => {
    if (mode === 'alert') {
        return {
            title: i18n.t('Districts on alert'),
            note: i18n.t('Ranked by forecast cases above threshold.'),
        };
    }

    if (mode === 'watch') {
        return {
            title: i18n.t('Districts on watch'),
            note: i18n.t('No district is on alert. Peak is the month closest to the threshold; ranked by how close the forecast median runs to it.'),
        };
    }

    if (mode === 'top') {
        return {
            title: i18n.t('Top districts by forecast cases'),
            note: i18n.t('No district is on alert or watch. Ranked by the highest forecast median across the forecast months.'),
        };
    }

    return {
        title: i18n.t('District forecast table'),
        note: i18n.t('No district is on alert or watch, and no district has a forecast median for this bulletin period.'),
    };
};

/**
 * The risk table beside the map. Unlike the old alert-only table it is always
 * rendered: with alerts, then watches, then the highest forecast medians, and
 * an empty-state card when there is no forecast at all.
 */
export const DistrictRiskTable = ({ style, mode, rows, isConfigured }) => {
    const { title, note } = riskTableCopy(mode);

    return (
        <section
            className={`${style.districtAlertTable} ${style.districtRiskTable}`}
            aria-label="District forecast risk table"
        >
            <h3>
                {title}
                {rows.length > 0 && <span> ({rows.length})</span>}
            </h3>
            <p className={style.districtAlertTableNote}>{note}</p>
            {rows.length === 0 ? (
                <p className={style.districtForecastEmpty}>
                    {isConfigured
                        ? i18n.t('No district-level forecast values are available for this bulletin period.')
                        : i18n.t('Configure malaria threshold, prediction bounds, median prediction, or alarm indicators to display the district forecast table.')}
                </p>
            ) : (
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
            )}
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
    highlight,
    onHighlightChange,
}) => {
    const forecastPeriods = React.useMemo(
        () => period ? getMonthlyPeriods(period, 0, 3) : [],
        [period]
    );

    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnitId);
    const level = Number(selectedUnit?.level);
    const isDistrictSelection = level === 3;

    // The map colours this set; everything else in the country stays grey.
    const highlightedDistricts = React.useMemo(
        () => resolveHighlightedDistricts({ orgUnits, selectedOrgUnitId, highlight }),
        [orgUnits, selectedOrgUnitId, highlight]
    );

    const status = React.useMemo(
        () => buildDistrictForecastStatuses({
            dataValues,
            mapping,
            periods: forecastPeriods,
            orgUnits,
            selectedOrgUnitId,
            districts: highlightedDistricts,
        }),
        [dataValues, forecastPeriods, mapping, orgUnits, selectedOrgUnitId, highlightedDistricts]
    );

    const riskTable = React.useMemo(
        () => buildDistrictRiskTable({
            dataValues,
            mapping,
            periods: forecastPeriods,
            orgUnits,
            selectedOrgUnitId,
            districts: highlightedDistricts,
        }),
        [dataValues, forecastPeriods, mapping, orgUnits, selectedOrgUnitId, highlightedDistricts]
    );

    const selectedDistrictForecast = React.useMemo(
        () => buildSelectedDistrictForecastRows({
            dataValues,
            mapping,
            periods: forecastPeriods,
            selectedOrgUnitId,
        }),
        [dataValues, forecastPeriods, mapping, selectedOrgUnitId]
    );

    // A bulletin is for a country, a zone or a DHO. A deeper unit has no map of
    // its own in this section, as before.
    if (!selectedUnit || !Number.isFinite(level) || level > 3) return null;
    if (!status) return null;

    return (
        <section className={`${style.sectionCard} ${style.districtRiskSummary}`}>
            <div className={style.sectionHeader}>
                <h2 className={style.casesChartTitle}>District forecast risk</h2>
            </div>
            <p className={style.casesChartSubtitle}>
                {isDistrictSelection
                    ? "The highlighted district's monthly forecast is below. Districts outside the highlight are grey."
                    : 'Alerts are based on configured alarm indicators. Watch districts have a predicted median at least 75% of, but below, the configured threshold.'}
            </p>
            {onHighlightChange && (
                <MapHighlightControl
                    style={style}
                    orgUnits={orgUnits}
                    selectedOrgUnitId={selectedOrgUnitId}
                    highlight={highlight}
                    onChange={onHighlightChange}
                />
            )}
            {/* The map always shows the whole country, with only the highlighted
                districts coloured. The table is always beside it: alerts, then
                watches, then the highest forecast medians. A DHO bulletin also
                stacks its monthly forecast table in the same right-hand pane. */}
            <div className={style.districtRiskRow}>
                <DistrictRiskMap
                    style={style}
                    orgUnits={orgUnits}
                    districts={highlightedDistricts}
                    forecastRowsByDistrict={status.forecastRowsByDistrict}
                    isConfigured={status.isConfigured}
                />
                <div className={style.districtRiskRightPane}>
                    <DistrictRiskTable
                        style={style}
                        mode={riskTable.mode}
                        rows={riskTable.rows}
                        isConfigured={status.isConfigured}
                    />
                    {isDistrictSelection && (
                        <SelectedDistrictForecastTable
                            style={style}
                            district={selectedUnit}
                            rows={selectedDistrictForecast.rows}
                            isConfigured={selectedDistrictForecast.isConfigured}
                        />
                    )}
                </div>
            </div>
        </section>
    );
};

export default DistrictRiskSummary;
