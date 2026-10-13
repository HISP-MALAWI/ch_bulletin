import React from 'react';
import {
    buildDistrictForecastStatuses,
    buildSelectedDistrictForecastRows,
} from '../utils/districtForecasts';
import { getMonthlyPeriods } from '../utils/getDataValues';

const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const MAP_WIDTH = 360;
const MAP_HEIGHT = 460;
const MAP_PADDING = 18;
const MIN_MAP_ZOOM = -3;
const MAX_MAP_ZOOM = 5;
const RISK_PRIORITY = { normal: 0, watch: 1, alert: 2 };
const TILE_SIZE = 256;

const polygonsForGeometry = (geometry) => {
    if (geometry?.type === 'Polygon') return [geometry.coordinates];
    if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
    return [];
};

const projectToWorld = ([longitude, latitude]) => {
    const clampedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
    const sinLatitude = Math.sin(clampedLatitude * Math.PI / 180);
    return [
        (longitude + 180) / 360 * TILE_SIZE,
        (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * TILE_SIZE,
    ];
};

const buildMapLayout = (districts, width, height, zoomLevel = 0) => {
    const points = districts.flatMap((district) =>
        polygonsForGeometry(district.geometry).flatMap((polygon) =>
            polygon.flatMap((ring) => ring)
        )
    );
    if (points.length === 0) return null;

    const worldPoints = points.map(projectToWorld);
    const bounds = worldPoints.reduce((result, [x, y]) => ({
        minX: Math.min(result.minX, x),
        maxX: Math.max(result.maxX, x),
        minY: Math.min(result.minY, y),
        maxY: Math.max(result.maxY, y),
    }), {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
    });
    const rangeX = bounds.maxX - bounds.minX;
    const rangeY = bounds.maxY - bounds.minY;
    if (rangeX === 0 || rangeY === 0) return null;

    const fitScale = Math.min(
        (width - MAP_PADDING * 2) / rangeX,
        (height - MAP_PADDING * 2) / rangeY
    );
    const scale = fitScale * (2 ** zoomLevel);
    const zoom = Math.max(0, Math.min(19, Math.floor(Math.log2(scale))));
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const offsetX = width / 2 - centerX * scale;
    const offsetY = height / 2 - centerY * scale;
    const tileScale = scale / (2 ** zoom);
    const tileSize = TILE_SIZE * tileScale;
    const minTileX = Math.max(0, Math.floor(-offsetX / tileSize));
    const maxTileX = Math.min(2 ** zoom - 1, Math.floor((width - offsetX) / tileSize));
    const minTileY = Math.max(0, Math.floor(-offsetY / tileSize));
    const maxTileY = Math.min(2 ** zoom - 1, Math.floor((height - offsetY) / tileSize));
    const tiles = [];

    for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
        for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            tiles.push({
                key: `${zoom}/${tileX}/${tileY}`,
                href: `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`,
                x: tileX * tileSize + offsetX,
                y: tileY * tileSize + offsetY,
                size: tileSize,
            });
        }
    }

    return {
        width,
        height,
        project: (coordinate) => {
            const [x, y] = projectToWorld(coordinate);
            return [x * scale + offsetX, y * scale + offsetY];
        },
        tiles,
    };
};

const featurePath = (district, project) => polygonsForGeometry(district.geometry)
    .flatMap((polygon) => polygon.map((ring) => ring.map((point, index) => {
        const [x, y] = project(point);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ') + ' Z'))
    .join(' ');

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

const DistrictRiskMap = ({
    style,
    districts,
    mapDistricts,
    alerts,
    watches,
    normal,
    forecastRowsByDistrict,
    isConfigured,
    mapLoading,
    mapError,
}) => {
    const viewportRef = React.useRef(null);
    const [viewportSize, setViewportSize] = React.useState({
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
    });
    const [zoomLevel, setZoomLevel] = React.useState(0);
    const [hoveredDistrict, setHoveredDistrict] = React.useState(null);
    React.useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport || typeof ResizeObserver === 'undefined') return undefined;

        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) setViewportSize({ width, height });
        });
        observer.observe(viewport);
        return () => observer.disconnect();
    }, []);

    const mapLayout = React.useMemo(
        () => buildMapLayout(mapDistricts, viewportSize.width, viewportSize.height, zoomLevel),
        [mapDistricts, viewportSize, zoomLevel]
    );
    const changeZoom = (amount) => {
        setZoomLevel((current) => Math.max(
            MIN_MAP_ZOOM,
            Math.min(MAX_MAP_ZOOM, current + amount)
        ));
        setHoveredDistrict(null);
    };
    const riskByDistrict = new Map();
    const addRisk = (district, risk) => {
        const currentRisk = riskByDistrict.get(district.id);
        if (!currentRisk || RISK_PRIORITY[risk] > RISK_PRIORITY[currentRisk]) {
            riskByDistrict.set(district.id, risk);
        }
    };
    normal.forEach((district) => addRisk(district, 'normal'));
    watches.forEach((district) => addRisk(district, 'watch'));
    alerts.forEach((district) => addRisk(district, 'alert'));
    const geographicIds = new Set(mapDistricts.map((district) => district.id));
    const unmappedUnits = districts.filter((district) => !geographicIds.has(district.id));

    const showTooltip = (event, district) => {
        const viewport = viewportRef.current?.getBoundingClientRect();
        if (!viewport) return;

        setHoveredDistrict({
            id: district.id,
            x: Math.min(event.clientX - viewport.left + 12, viewport.width - 205),
            y: Math.min(event.clientY - viewport.top + 12, viewport.height - 120),
        });
    };
    const hoveredFeature = mapDistricts.find((district) => district.id === hoveredDistrict?.id);
    const hoveredRisk = isConfigured
        ? riskByDistrict.get(hoveredDistrict?.id)
        : null;
    const hoveredForecastRows = forecastRowsByDistrict.get(hoveredDistrict?.id) || [];
    const configuredForecastRows = hoveredForecastRows.filter((row) => row.status !== 'unavailable');

    return (
        <section className={style.districtRiskMap} aria-label="Malawi district forecast risk map">
            <h3>District forecast risk map</h3>
            <div className={style.districtRiskLegend} aria-label="Risk categories">
                <span><i className={style.districtRiskLegendAlert} />Alert</span>
                <span><i className={style.districtRiskLegendWatch} />Watch</span>
                <span><i className={style.districtRiskLegendNormal} />Normal</span>
                <span><i className={style.districtRiskLegendOutside} />Outside selection / unavailable</span>
            </div>
            <div
                className={style.districtRiskMapViewport}
                ref={viewportRef}
                onWheel={(event) => {
                    event.preventDefault();
                    changeZoom(event.deltaY < 0 ? 1 : -1);
                }}
            >
                {mapLoading ? (
                    <p className={style.districtRiskMapEmpty}>Loading district boundaries from DHIS2…</p>
                ) : mapError ? (
                    <p className={style.districtRiskMapEmpty}>
                        Could not load district boundaries: {mapError.message || 'DHIS2 request failed.'}
                    </p>
                ) : mapLayout ? (
                    <svg
                        className={style.districtRiskSvg}
                        viewBox={`0 0 ${mapLayout.width} ${mapLayout.height}`}
                        role="group"
                        aria-label="District boundaries from DHIS2 over OpenStreetMap"
                    >
                        {mapLayout.tiles.map((tile) => (
                            <image
                                key={tile.key}
                                className={style.districtRiskMapTile}
                                href={tile.href}
                                x={tile.x}
                                y={tile.y}
                                width={tile.size}
                                height={tile.size}
                            />
                        ))}
                        {mapDistricts.map((district) => {
                            const forecastRows = forecastRowsByDistrict.get(district.id) || [];
                            const hasForecast = forecastRows.some((row) => row.status !== 'unavailable');
                            const risk = isConfigured && hasForecast
                                ? riskByDistrict.get(district.id) || 'normal'
                                : null;
                            const riskClass = risk
                                ? `districtRiskMapFeature${risk[0].toUpperCase()}${risk.slice(1)}`
                                : 'districtRiskMapFeatureOutside';
                            const name = district.displayName || district.name || district.id;

                            return (
                                <path
                                    key={district.id}
                                    className={`${style.districtRiskMapFeature} ${style[riskClass]}`}
                                    d={featurePath(district, mapLayout.project)}
                                    fillRule="evenodd"
                                    tabIndex={0}
                                    aria-label={`${name}: ${risk || 'forecast unavailable'}`}
                                    aria-describedby={hoveredDistrict?.id === district.id
                                        ? 'district-risk-map-tooltip'
                                        : undefined}
                                    onMouseEnter={(event) => showTooltip(event, district)}
                                    onMouseMove={(event) => showTooltip(event, district)}
                                    onMouseLeave={() => setHoveredDistrict(null)}
                                    onFocus={(event) => showTooltip(event, district)}
                                    onBlur={() => setHoveredDistrict(null)}
                                >
                                    <title>{`${name}: ${risk || 'forecast unavailable'}`}</title>
                                </path>
                            );
                        })}
                    </svg>
                ) : (
                    <p className={style.districtRiskMapEmpty}>
                        No district boundary geometries are available from the DHIS2 instance.
                    </p>
                )}
                {!mapLoading && !mapError && mapLayout && (
                    <div className={style.districtRiskMapZoomControls} aria-label="Map zoom controls">
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
                {hoveredDistrict && hoveredFeature && (
                    <div
                        className={style.districtRiskTooltip}
                        id="district-risk-map-tooltip"
                        role="tooltip"
                        style={{ left: Math.max(0, hoveredDistrict.x), top: Math.max(0, hoveredDistrict.y) }}
                    >
                        <strong>
                            {hoveredFeature.displayName || hoveredFeature.name || hoveredFeature.id}
                            {hoveredRisk ? ` · ${hoveredRisk}` : ''}
                        </strong>
                        {configuredForecastRows.length > 0 ? configuredForecastRows.map((row) => (
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
            <p className={style.districtRiskMapCaption}>
                Hover over a district for its forecast median and prediction bounds. District boundaries are from this DHIS2 instance. Map tiles © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                    OpenStreetMap contributors
                </a>.
            </p>
            {unmappedUnits.length > 0 && (
                <p className={style.districtRiskMapCaption}>
                    {unmappedUnits.length} non-geographic organization unit{unmappedUnits.length === 1 ? '' : 's'} remain in the lists but are not shown on district boundaries.
                </p>
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
    mapDistricts,
    mapLoading = false,
    mapError = null,
    selectedOrgUnitId,
}) => {
    const districtMapUnits = mapDistricts || orgUnits.filter((unit) =>
        Number(unit.level) === 3 && unit.geometry
    );
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
                    mapDistricts={districtMapUnits}
                    alerts={status.alerts}
                    watches={status.watches}
                    normal={status.normal}
                    forecastRowsByDistrict={status.forecastRowsByDistrict}
                    isConfigured={status.isConfigured}
                    mapLoading={mapLoading}
                    mapError={mapError}
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
