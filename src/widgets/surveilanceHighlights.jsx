import React from 'react';
import {
    Area,
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceArea,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import i18n from '@dhis2/d2-i18n';
import { getMonthlyPeriods } from '../utils/getDataValues';
import { buildSelectedUnitMalariaData, summariseForecast } from '../utils/monthlyMalariaData';
import { palette, series, fontFamily } from '../theme/tokens';
import { BulletinSectionHeader } from './bulletinSection';

const numberFormat = new Intl.NumberFormat('en');
// 1,500 -> 1.5K, 1,500,000 -> 1.5M, 250 -> 250. The previous formatter rounded
// to whole thousands, so any value under 500 printed as "0k" and small axes
// showed repeated "0k / 0k / 1k" ticks.
const compactFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const compactNumber = (value) => compactFormat.format(value);

const axisTick = { fill: palette.mute, fontSize: 12, fontFamily: fontFamily.mono };

// Axis names wear the same small-type voice as the ticks. Passed as a plain
// string, recharts renders a label in its own default sans-serif, which left
// the one piece of chrome on the figure speaking in a different voice from
// everything around it.
const axisLabelStyle = {
    fill: palette.mute,
    fontSize: 12,
    fontFamily: fontFamily.mono,
};

// Hoisted rather than written inline: the catalogue scanner cannot parse a
// nested object literal in a JSX attribute.
const xAxisLabel = {
    value: 'Months',
    position: 'bottom',
    style: axisLabelStyle,
};

// "Cases", not "Confirmed Malaria Cases". The widget is generic over the mapped
// disease — the title above already names it — and this axis carries the alert
// threshold and the forecast median as well as the observed line, so naming one
// of the three would misdescribe the other two.
const yAxisLabel = {
    value: 'Cases',
    angle: -90,
    position: 'insideLeft',
    style: { ...axisLabelStyle, textAnchor: 'middle' },
};

// Below this chart width the point labels are dropped (the tooltip and the
// monthly list carry the numbers) and the axes get tighter.
const COMPACT_WIDTH = 560;

// Each label is a literal i18n.t call rather than a lookup into a map: the
// catalogue scanner cannot resolve a computed call.
const statusLabel = (status) => {
    if (status === 'alert') return i18n.t('Alert');
    if (status === 'watch') return i18n.t('Watch');
    return i18n.t('Normal');
};

const seriesLabel = (id) => {
    if (id === 'cases') return i18n.t('Confirmed cases');
    if (id === 'median') return i18n.t('Median forecast');
    if (id === 'range50') return i18n.t('50% interval');
    if (id === 'range80') return i18n.t('80% interval');
    return i18n.t('Alert threshold');
};

const STATUS_CLASS = {
    alert: 'bulletinTagAlert',
    watch: 'bulletinTagWatch',
    normal: 'bulletinTagNormal',
};

// Marks differ by shape as well as colour (solid + dots, dashed + dots,
// dotted, filled band), so the series can be told apart without colour.
const SERIES_MARKER = {
    cases: { kind: 'line', color: series.cases, dash: undefined, dot: true },
    median: { kind: 'line', color: palette.lake, dash: '6 4', dot: true },
    threshold: { kind: 'line', color: series.threshold, dash: '2 3', dot: false },
    range50: { kind: 'band', color: series.predictionQuartile },
    range80: { kind: 'band', color: series.predictionRange },
};

// Periods arrive as 'YYYYMM'. Parsed at UTC midnight on the first of the month,
// so a viewer behind UTC never sees the name slip into the previous month. An
// unparseable period yields null rather than an Invalid Date, which would make
// Intl.DateTimeFormat throw and take the chart down with it.
const parsePeriod = (period) => {
    const value = String(period);

    if (!/^\d{6}$/.test(value)) {
        return null;
    }

    const date = new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, 1));
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatPeriod = (period, options) => {
    const date = parsePeriod(period);
    return date
        ? new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(date)
        : String(period);
};

const longMonth = (period) => formatPeriod(period, { month: 'long', year: 'numeric' });
const monthYear = (period) => formatPeriod(period, { month: 'short', year: 'numeric' });

const monthAbbrev = (period) => formatPeriod(period, { month: 'short' });

// Which periods open a year, so a tick can say which one it is without every
// tick paying for the year.
const findYearStarts = (periods) => {
    const yearStarts = new Set();
    let currentYear = null;

    periods.forEach((period) => {
        const year = String(period).slice(0, 4);

        if (year !== currentYear) {
            yearStarts.add(period);
            currentYear = year;
        }
    });

    return yearStarts;
};

// The year sits on a second line under the month rather than beside it on one.
// Recharts drops a tick whose text is wider than its slot allows, and "Jan 2026"
// is nearly three times the width of "Oct" — so writing the year inline made the
// single tick carrying it the single tick most likely to be culled. Stacked,
// every tick is about as wide as "2026" and the year survives wherever the tick
// does.
const MonthTick = ({ x, y, payload, yearStarts, className }) => {
    const period = payload?.value;

    return (
        // The class recharts passes down has to land on the element it looks for:
        // it finds the rendered ticks by that class to read their font size, which
        // it then uses as the text width when deciding how many ticks fit. Without
        // it the axis measures every label at the browser default.
        <g
            className={className}
            transform={`translate(${x},${y})`}
            fill={axisTick.fill}
            fontSize={axisTick.fontSize}
            fontFamily={axisTick.fontFamily}
        >
            <text x={0} y={0} dy={12} textAnchor="middle">
                {monthAbbrev(period)}
            </text>
            {yearStarts?.has(period) && (
                <text x={0} y={0} dy={26} textAnchor="middle" fontSize={10}>
                    {String(period).slice(0, 4)}
                </text>
            )}
        </g>
    );
};

// Built at render time (not module load) so the translation is looked up once
// i18n has initialised.
const getForecastRegionLabel = () => ({
    value: `${i18n.t('Forecast')} →`,
    position: 'insideTopLeft',
    fill: palette.shire,
    fontSize: 11,
    fontFamily: fontFamily.mono,
});

const useMediaQuery = (query) => {
    const [matches, setMatches] = React.useState(() => (
        typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false
    ));
    React.useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;
        const mql = window.matchMedia(query);
        const onChange = (event) => setMatches(event.matches);
        setMatches(mql.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);
    return matches;
};

// Width of the chart's own container, not the window: the widget can sit in a
// narrow column on a wide screen.
const useElementWidth = (ref, ready) => {
    const [width, setWidth] = React.useState(0);
    React.useLayoutEffect(() => {
        const element = ref.current;
        if (!ready || !element) return undefined;
        setWidth(element.getBoundingClientRect().width);
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) setWidth(entries[0].contentRect.width);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref, ready]);
    return width;
};

const SeriesMarker = ({ id }) => {
    const marker = SERIES_MARKER[id];
    return (
        <svg width="20" height="10" viewBox="0 0 20 10" aria-hidden="true" focusable="false" style={{ flex: 'none' }}>
            {marker.kind === 'band' ? (
                <rect x="1" y="1" width="18" height="8" rx="2" fill={marker.color} stroke={palette.line} />
            ) : (
                <>
                    <line x1="0" x2="20" y1="5" y2="5" stroke={marker.color} strokeWidth="2" strokeDasharray={marker.dash} />
                    {marker.dot && <circle cx="10" cy="5" r="3" fill={marker.color} />}
                </>
            )}
        </svg>
    );
};

// Doubles as the legend and the series filter. Buttons, so it works with a
// keyboard and touch; hidden series are struck through, not just dimmed.
// Centred across the chart's width, so it reads as the figure's legend rather
// than as a toolbar stranded at the top left of a full-width plot.
const SeriesLegend = ({ items, hidden, onToggle, onHover }) => (
    <div
        role="group"
        aria-label={i18n.t('Chart series')}
        style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 8px', margin: '0 0 8px' }}
    >
        {items.map((id) => {
            const isHidden = Boolean(hidden[id]);
            return (
                <button
                    key={id}
                    type="button"
                    aria-pressed={!isHidden}
                    onClick={() => onToggle(id)}
                    onMouseEnter={() => onHover(id)}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover(id)}
                    onBlur={() => onHover(null)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        minHeight: 36,
                        padding: '4px 10px',
                        border: `1px solid ${palette.line}`,
                        borderRadius: 6,
                        background: 'transparent',
                        color: isHidden ? palette.mute : palette.ink,
                        font: 'inherit',
                        fontSize: 12,
                        cursor: 'pointer',
                        opacity: isHidden ? 0.6 : 1,
                        textDecoration: isHidden ? 'line-through' : 'none',
                    }}
                >
                    <SeriesMarker id={id} />
                    {seriesLabel(id)}
                </button>
            );
        })}
    </div>
);

// Reads the month's row directly instead of the per-series payload, so the
// order and labels are ours and the raw data keys never reach the screen.
const ChartTooltip = ({ active, payload, style, statusByPeriod, hidden }) => {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0].payload;
    if (!row) return null;

    const range = (value) => `${numberFormat.format(value[0])} – ${numberFormat.format(value[1])}`;
    const entries = [];
    const add = (id, text) => {
        if (!hidden[id]) entries.push({ id, text });
    };
    if (Number.isFinite(row.cases)) add('cases', numberFormat.format(row.cases));
    if (Number.isFinite(row.predictionMedian)) add('median', numberFormat.format(Math.round(row.predictionMedian)));
    if (Array.isArray(row.quartileRange)) add('range50', range(row.quartileRange));
    if (Array.isArray(row.predictionRange)) add('range80', range(row.predictionRange));
    if (Number.isFinite(row.threshold)) add('threshold', numberFormat.format(Math.round(row.threshold)));

    const status = statusByPeriod[row.period];

    return (
        <div
            style={{
                minWidth: 200,
                maxWidth: 'min(300px, 80vw)',
                padding: '10px 12px',
                background: palette.paper,
                border: `1px solid ${palette.line}`,
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                color: palette.ink,
                fontSize: 13,
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <strong>{longMonth(row.period)}</strong>
                {status && (
                    <span className={`${style.bulletinTag} ${style[STATUS_CLASS[status]]}`}>
                        {statusLabel(status)}
                    </span>
                )}
            </div>
            {entries.length === 0 && (
                <div style={{ color: palette.mute }}>{i18n.t('No data for this month')}</div>
            )}
            {entries.map((entry) => (
                <div
                    key={entry.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '2px 0' }}
                >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <SeriesMarker id={entry.id} />
                        {seriesLabel(entry.id)}
                    </span>
                    <span style={{ fontFamily: fontFamily.mono, fontVariantNumeric: 'tabular-nums' }}>{entry.text}</span>
                </div>
            ))}
        </div>
    );
};

// Labels the confirmed-cases line at each point that has one. A line's points
// arrive as x/y/value, not the bar's payload and width.
const CasesLabel = ({ x, y, value }) => {
    if (!Number.isFinite(value) || value <= 0) return null;
    return (
        <text x={x} y={y - 9} fill={palette.ink} textAnchor="middle" fontSize={11}>
            {compactNumber(value)}
        </text>
    );
};

const HealthCasesWidget = ({
    style,
    step,
    title = 'Malaria Forecast',
    description,
    dataValues = [],
    mapping = [],
    orgUnits = [],
    selectedOrgUnit,
    period,
    // Optional. The component has no fetch of its own, so the parent can pass
    // these to show the loading / error states. Both default to off.
    loading = false,
    error = null,
}) => {
    const organisationUnitList = Array.isArray(orgUnits) ? orgUnits : [];
    const periods = React.useMemo(
        () => (period ? getMonthlyPeriods(period) : []),
        [period]
    );
    const { malariaMapping, rows } = React.useMemo(
        () => buildSelectedUnitMalariaData({
            dataValues,
            mapping,
            periods,
            selectedOrgUnit,
            forecastStartPeriod: period,
        }),
        [dataValues, mapping, periods, selectedOrgUnit, period]
    );
    const forecast = React.useMemo(() => summariseForecast({ rows }), [rows]);

    // Built from the months actually plotted, so whichever tick opens a new
    // year is the one that spells it out.
    const yearStarts = React.useMemo(
        () => findYearStarts(rows.map((row) => row.period)),
        [rows]
    );

    const [hidden, setHidden] = React.useState({});
    const [hovered, setHovered] = React.useState(null);
    const toggleSeries = React.useCallback(
        (id) => setHidden((current) => ({ ...current, [id]: !current[id] })),
        []
    );
    const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
    const chartRef = React.useRef(null);

    const hasChartData = rows.some((row) => (
        row.cases > 0 ||
        row.threshold !== null ||
        row.predictionMedian !== null ||
        row.predictionRange !== undefined ||
        row.quartileRange !== undefined
    ));
    const showChart = hasChartData && !loading && !error;
    const chartWidth = useElementWidth(chartRef, showChart);
    const compact = chartWidth > 0 && chartWidth < COMPACT_WIDTH;

    const diseaseName = malariaMapping?.displayName?.replace(/\s+cases?$/i, '').toLowerCase() || 'malaria';
    const selectedOrgUnitName = organisationUnitList.find((unit) => unit.id === selectedOrgUnit)?.displayName || '';
    const dateRange = periods.length ? `${monthYear(periods[0])} – ${monthYear(periods.at(-1))}` : '';
    const lastPeriod = rows.length ? rows[rows.length - 1].period : null;

    const statusByPeriod = React.useMemo(() => {
        const map = {};
        forecast.months.forEach((month) => {
            map[month.period] = month.status;
        });
        return map;
    }, [forecast]);

    // Partial data: say so, rather than leaving a quiet gap in the line.
    const missingCaseMonths = forecast.forecastStartsAt
        ? rows.filter((row) => row.period < forecast.forecastStartsAt && !Number.isFinite(row.cases)).length
        : 0;

    const legendItems = ['cases'];
    if (malariaMapping?.predictionMedian) legendItems.push('median');
    legendItems.push('range50', 'range80');
    if (malariaMapping?.threshold) legendItems.push('threshold');

    // While a legend entry is hovered or focused, the other series step back.
    const dim = (id) => (hovered && hovered !== id ? 0.25 : 1);

    // A month whose median has crossed its threshold is marked in red, which is
    // how the reference bulletin picks out an exceeded month.
    const medianLabel = ({ x, y, value, index }) => {
        if (!Number.isFinite(value)) return null;
        const threshold = rows[index]?.threshold;
        const above = Number.isFinite(threshold) && value > threshold;
        return (
            <text
                x={x}
                y={y - 9}
                textAnchor="middle"
                fontSize={11.5}
                fontWeight={600}
                fill={above ? palette.alert : palette.lake}
            >
                {compactNumber(value)}
            </text>
        );
    };

    // The interpolation values are written out rather than spread from an
    // object: the catalogue scanner cannot parse a spread here.
    const interpretation = (() => {
        if (!forecast.peak) return null;

        const month = longMonth(forecast.peak.period);
        const value = numberFormat.format(Math.round(forecast.peak.median));
        const threshold = numberFormat.format(Math.round(forecast.peak.threshold));

        if (forecast.monthsAboveThreshold > 0) {
            return i18n.t('The median forecast is above the alert threshold in {{months}} of {{total}} months. The highest is {{month}} at {{value}} against a threshold of {{threshold}}.', {
                months: forecast.monthsAboveThreshold,
                total: forecast.months.length,
                month: month,
                value: value,
                threshold: threshold,
            });
        }

        return i18n.t('The median forecast stays below the alert threshold in every month. It comes closest in {{month}}, at {{value}} against a threshold of {{threshold}}.', {
            month: month,
            value: value,
            threshold: threshold,
        });
    })();

    const chartTitle = i18n.t('Current {{disease}} cases and prediction', { disease: diseaseName });
    const chartSubtitle = i18n.t('Monthly confirmed cases and forecast range')
        + (selectedOrgUnitName ? ` · ${selectedOrgUnitName}` : '')
        + (dateRange ? ` · ${dateRange}` : '');

    const renderPlaceholder = () => {
        if (loading) {
            return (
                <div className={style.casesChartEmpty} role="status" aria-busy="true">
                    {i18n.t('Loading chart data…')}
                </div>
            );
        }
        if (error) {
            return (
                <div className={style.casesChartEmpty} role="alert">
                    {i18n.t('The chart could not be loaded. Try again, or check your connection.')}
                </div>
            );
        }
        return (
            <div className={style.casesChartEmpty} role="status">
                {malariaMapping
                    ? i18n.t('No malaria case data is available for these months and the selected organization unit.')
                    : i18n.t('Add a malaria mapping to display case trends.')}
            </div>
        );
    };

    return (
        <div>
            <BulletinSectionHeader step={step} title={title} description={description} />
            {/* The chart's own heading sits over the plot it names, so it is
                centred across it; the section heading above keeps the app's
                left alignment. */}
            <div className={style.casesChartHeader}>
                <h3 className={style.casesChartTitle}>{chartTitle}</h3>
                <p className={style.casesChartSubtitle}>{chartSubtitle}</p>
            </div>
            {/* The plot across the full width with its reading beneath it, so
                the status list cannot squeeze the chart into a side column. */}
            <div className={style.casesChartLayout}>
            {showChart ? (
                <div>
                    <SeriesLegend items={legendItems} hidden={hidden} onToggle={toggleSeries} onHover={setHovered} />
                    <div
                        ref={chartRef}
                        className={style.casesChart}
                        role="figure"
                        aria-label={interpretation ? `${chartTitle}. ${interpretation}` : chartTitle}
                        style={compact ? { height: 300 } : undefined}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={rows}
                                // The ticks and the axis name are paid for by the axis's
                                // own height above; this margin is what the name itself
                                // sits in. Recharts draws it below the axis without
                                // reserving room for it, so a margin sized for the ticks
                                // alone clips the name off.
                                margin={{ top: compact ? 12 : 24, right: compact ? 8 : 12, bottom: 32, left: compact ? 0 : 4 }}
                                accessibilityLayer
                            >
                                <CartesianGrid vertical={false} stroke={palette.line} />
                                {/* Shaded behind everything else, so the forecast
                                    months read as a different kind of number. */}
                                {forecast.forecastStartsAt && lastPeriod && (
                                    <ReferenceArea
                                        x1={forecast.forecastStartsAt}
                                        x2={lastPeriod}
                                        fill={palette.paper}
                                        fillOpacity={1}
                                        stroke="none"
                                        label={getForecastRegionLabel()}
                                    />
                                )}
                                <XAxis
                                    dataKey="period"
                                    // The formatter is what recharts measures to decide whether
                                    // a tick fits, so it stays the short month even though the
                                    // tick below draws a year under some of them.
                                    tickFormatter={monthAbbrev}
                                    tick={<MonthTick yearStarts={yearStarts} />}
                                    tickMargin={6}
                                    // The ticks hang from the top of the axis band, and the
                                    // axis name is drawn at the band's bottom edge — so this
                                    // height is what keeps the name clear of the second,
                                    // year line rather than the margin below.
                                    height={44}
                                    axisLine={{ stroke: palette.line }}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                    minTickGap={compact ? 16 : 8}
                                    label={xAxisLabel}
                                />
                                <YAxis
                                    tickFormatter={compactNumber}
                                    tick={axisTick}
                                    tickMargin={4}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                    width={compact ? 52 : 60}
                                    label={yAxisLabel}
                                />
                                <Tooltip
                                    content={<ChartTooltip style={style} statusByPeriod={statusByPeriod} hidden={hidden} />}
                                    cursor={{ stroke: palette.mute, strokeDasharray: '3 3' }}
                                    allowEscapeViewBox={{ x: false, y: false }}
                                    wrapperStyle={{ outline: 'none', zIndex: 10 }}
                                    offset={12}
                                    isAnimationActive={false}
                                />
                                {/* A line rather than bars, so observed cases and the
                                    alert threshold are the same kind of mark and can
                                    be read against each other. Dr Manda*/}
                                <Line
                                    dataKey="cases"
                                    name={seriesLabel('cases')}
                                    type="monotone"
                                    stroke={series.cases}
                                    strokeOpacity={dim('cases')}
                                    strokeWidth={2}
                                    dot={{ r: compact ? 2.5 : 3, fill: series.cases, strokeWidth: 0, fillOpacity: dim('cases') }}
                                    activeDot={{ r: 5, strokeWidth: 2, stroke: palette.paper }}
                                    label={compact ? false : CasesLabel}
                                    hide={Boolean(hidden.cases)}
                                    isAnimationActive={!reduceMotion}
                                    animationDuration={400}
                                    connectNulls
                                />
                                {/* Two bands, the wider one drawn first and lighter,
                                    with the narrower interval inside it. */}
                                <Area
                                    dataKey="predictionRange"
                                    name={seriesLabel('range80')}
                                    type="monotone"
                                    fill={series.predictionRange}
                                    fillOpacity={dim('range80')}
                                    stroke="none"
                                    hide={Boolean(hidden.range80)}
                                    isAnimationActive={!reduceMotion}
                                    animationDuration={400}
                                    connectNulls
                                />
                                <Area
                                    dataKey="quartileRange"
                                    name={seriesLabel('range50')}
                                    type="monotone"
                                    fill={series.predictionQuartile}
                                    fillOpacity={dim('range50')}
                                    stroke="none"
                                    hide={Boolean(hidden.range50)}
                                    isAnimationActive={!reduceMotion}
                                    animationDuration={400}
                                    connectNulls
                                />
                                {malariaMapping?.threshold && (
                                    <Line
                                        dataKey="threshold"
                                        name={seriesLabel('threshold')}
                                        type="monotone"
                                        stroke={series.threshold}
                                        strokeOpacity={dim('threshold')}
                                        strokeWidth={2}
                                        strokeDasharray="2 3"
                                        dot={false}
                                        activeDot={false}
                                        hide={Boolean(hidden.threshold)}
                                        isAnimationActive={!reduceMotion}
                                        animationDuration={400}
                                        connectNulls
                                    />
                                )}
                                {malariaMapping?.predictionMedian && (
                                    <Line
                                        dataKey="predictionMedian"
                                        name={seriesLabel('median')}
                                        type="monotone"
                                        stroke={palette.lake}
                                        strokeOpacity={dim('median')}
                                        strokeWidth={2}
                                        strokeDasharray="6 4"
                                        dot={{ r: compact ? 2.5 : 3, fill: palette.lake, strokeWidth: 0, fillOpacity: dim('median') }}
                                        activeDot={{ r: 5, strokeWidth: 2, stroke: palette.paper }}
                                        label={compact ? false : medianLabel}
                                        hide={Boolean(hidden.median)}
                                        isAnimationActive={!reduceMotion}
                                        animationDuration={400}
                                        connectNulls
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    {missingCaseMonths > 0 && (
                        <p role="note" style={{ margin: '8px 0 0', fontSize: 12, color: palette.mute }}>
                            {i18n.t('Confirmed cases are missing for {{total}} of the months before the forecast; the line is drawn across the gap.', { total: missingCaseMonths })}
                        </p>
                    )}
                </div>
            ) : (
                renderPlaceholder()
            )}

            <div className={style.casesChartNotes}>
            {forecast.months.length > 0 && (
                <div className={style.bulletinList}>
                    {forecast.months.map((month) => (
                        <div key={month.period} className={style.bulletinListItem}>
                            <span className={style.bulletinListItemText}>
                                <strong>{longMonth(month.period)}</strong>
                                {' — '}
                                {i18n.t('median {{median}}, threshold {{threshold}}', {
                                    median: numberFormat.format(Math.round(month.median)),
                                    threshold: numberFormat.format(Math.round(month.threshold)),
                                })}
                            </span>
                            <span className={`${style.bulletinTag} ${style[STATUS_CLASS[month.status]]}`}>
                                {statusLabel(month.status)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {interpretation && (
                <p className={style.bulletinInterpretation}>{interpretation}</p>
            )}
            </div>
            </div>
        </div>
    );
};

export default HealthCasesWidget;