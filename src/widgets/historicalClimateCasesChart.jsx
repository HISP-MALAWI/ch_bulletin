import React from 'react';
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    usePlotArea,
    useXAxisTicks,
    useChartWidth,
} from 'recharts';
import { useDataEngine } from '@dhis2/app-runtime';
import getDataValues, { getMonthlyPeriods } from '../utils/getDataValues';
import {
    buildHistoricalClimateCaseRows,
    getRainfallCasePeakInsight,
    getRainfallCasePeaks,
} from '../utils/historicalClimateCases';

const RAINFALL_COLOR = '#86bec3';
const TEMPERATURE_COLOR = '#df453f';
const CASES_COLOR = '#328c5a';
const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const caseFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

// The three axes are laid out side by side to the right of the plot — rainfall
// on the left, cases and then temperature on the right — and each axis label is
// drawn *inside* its own band of ticks. Right-hand ticks are anchored at the
// band's left edge and grow rightwards, so a label placed at the band's right
// edge collides with them as soon as the numbers are wide: a five-figure case
// count reaches the "Cases" label at the width this chart used to leave. The
// bands are wider than the numbers they hold for that reason, and the labels
// are set at the ticks' own size so the space they take is known.
const AXIS_TICK = { fill: '#64748b', fontSize: 10, fontFamily: 'Courier New' };
const AXIS_LABEL_TEXT = { fontSize: 10, fontFamily: 'Courier New' };

// A case count is the widest number on the chart and the one that grows: the
// band has to hold a grouped national figure ("340,000", seven characters at the
// tick size) beside its own label, so it is given the room and the gutter beyond
// the last axis is trimmed to match. The two together are what the plot gives up
// on the right, and they are unchanged in total from before.
const CASES_AXIS_WIDTH = 80;
const TEMPERATURE_AXIS_WIDTH = 62;
const CHART_RIGHT_MARGIN = 44;

// The chart's top margin holds the lag annotation when there is one to draw.
const LAG_BAND_HEIGHT = 40;
const LAG_COLOR = '#10324a';
const LAG_FONT_SIZE = 10.5;
const LAG_ARROW_HEAD = 7;
// Courier New at LAG_FONT_SIZE. Only used to keep the label inside the chart
// when the two peaks sit against one edge; nothing depends on it being exact.
const LAG_CHAR_WIDTH = 6.3;

const shortMonth = (period) => {
    const date = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1));
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC',
    }).format(date);
};

const monthAndYear = (period) => {
    const date = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1));
    return new Intl.DateTimeFormat('en', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date);
};

/**
 * The arrow the reference bulletin draws between the two peaks: a line from the
 * rainfall peak across to the case peak, arrowhead at the case end, with the gap
 * named above it. It sits in the chart's top margin rather than across the plot,
 * so it cannot land on the bars and the line it is pointing at.
 *
 * The peak months are looked up among the axis ticks rather than worked out from
 * the data, because the ticks are what the reader sees: the band centres the bars
 * actually sit on. A peak whose month is not drawn has nothing to point at, and
 * the annotation is dropped rather than aimed at a guessed position.
 */
const LagAnnotation = ({ peaks }) => {
    const plotArea = usePlotArea();
    const ticks = useXAxisTicks();
    const chartWidth = useChartWidth();

    if (!peaks || !plotArea || !ticks || !chartWidth) return null;

    const from = ticks.find((tick) => tick.value === peaks.rainfallPeriod);
    const to = ticks.find((tick) => tick.value === peaks.casePeriod);

    if (!from || !to) return null;

    const text = `rain peak → case peak ≈ ${peaks.leadMonths} month${peaks.leadMonths === 1 ? '' : 's'}`;
    const halfText = (text.length * LAG_CHAR_WIDTH) / 2;
    // Centred over the span between the peaks, then held inside the chart: a
    // pair of peaks at one end would otherwise push the label past the SVG edge,
    // and an SVG root clips what overflows it. The whole chart is fair game
    // rather than just the plot — the label sits in the top margin, where the
    // axis bands and their labels are the only things beside it.
    const minTextX = halfText;
    const maxTextX = Math.max(minTextX, chartWidth - halfText);
    const textX = Math.min(
        Math.max((from.coordinate + to.coordinate) / 2, minTextX),
        maxTextX
    );
    const arrowY = plotArea.y - 10;
    const arrowX = Math.max(from.coordinate, to.coordinate - LAG_ARROW_HEAD);

    return (
        <g>
            <line
                x1={from.coordinate}
                y1={arrowY}
                x2={arrowX}
                y2={arrowY}
                stroke={LAG_COLOR}
                strokeWidth={1.2}
            />
            <polygon
                points={`${arrowX},${arrowY - 4} ${to.coordinate},${arrowY} ${arrowX},${arrowY + 4}`}
                fill={LAG_COLOR}
            />
            <text
                x={textX}
                y={arrowY - 7}
                textAnchor="middle"
                fontSize={LAG_FONT_SIZE}
                fontFamily="Courier New"
                fill={LAG_COLOR}
            >
                {text}
            </text>
        </g>
    );
};

const HistoricalClimateCasesChart = ({
    style,
    dataValues = [],
    mapping = [],
    rainfallDataElement,
    temperatureDataElement,
    period,
    orgUnits = [],
    selectedOrgUnit,
    initialClimateDataValues,
    onClimateDataValuesChange,
}) => {
    const engine = useDataEngine();
    const [climateDataValues, setClimateDataValues] = React.useState(initialClimateDataValues || []);
    const [loading, setLoading] = React.useState(initialClimateDataValues === undefined);
    const periods = React.useMemo(
        () => period ? getMonthlyPeriods(period, 11, 0) : [],
        [period]
    );

    React.useEffect(() => {
        if (initialClimateDataValues !== undefined) {
            setClimateDataValues(initialClimateDataValues);
            setLoading(false);
            return undefined;
        }

        if (
            !periods.length ||
            !rainfallDataElement ||
            !temperatureDataElement ||
            !selectedOrgUnit
        ) {
            setClimateDataValues([]);
            onClimateDataValuesChange?.([]);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        getDataValues(
            [rainfallDataElement, temperatureDataElement],
            periods,
            [selectedOrgUnit],
            engine
        ).then((values) => {
            if (!cancelled) {
                setClimateDataValues(values);
                onClimateDataValuesChange?.(values);
            }
        }).catch((error) => {
            console.error('Failed to load historical climate data:', error);
            if (!cancelled) {
                setClimateDataValues([]);
                onClimateDataValuesChange?.([]);
            }
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [
        engine,
        initialClimateDataValues,
        onClimateDataValuesChange,
        periods,
        rainfallDataElement,
        selectedOrgUnit,
        temperatureDataElement,
    ]);

    const rows = React.useMemo(() => buildHistoricalClimateCaseRows({
        climateDataValues,
        caseDataValues: dataValues,
        mapping,
        periods,
        rainfallDataElement,
        temperatureDataElement,
        selectedOrgUnit,
        orgUnits,
    }), [
        climateDataValues,
        dataValues,
        mapping,
        periods,
        rainfallDataElement,
        temperatureDataElement,
        selectedOrgUnit,
        orgUnits,
    ]);
    const hasData = rows.some((row) =>
        row.rainfall !== null || row.temperature !== null || row.cases !== null
    );
    const insight = getRainfallCasePeakInsight(rows);
    const peaks = getRainfallCasePeaks(rows);
    // The annotation states the same lag as the sentence below the chart, so it
    // is worth drawing only when there is one: rain peaking first is the claim
    // the bulletin makes. When it does not hold, the sentence says so instead
    // and no arrow is drawn.
    const lagPeaks = peaks && peaks.leadMonths > 0 ? peaks : null;
    const selectedUnitName = orgUnits.find((unit) => unit.id === selectedOrgUnit)?.displayName;
    const range = periods.length
        ? `${shortMonth(periods[0])}–${shortMonth(periods.at(-1))}`
        : '';

    if (!selectedOrgUnit || !periods.length) return null;

    return (
        <section className={`${style.sectionCard} ${style.historicalClimateCasesPanel}`}>
            <h2 className={style.casesChartTitle}>Historical climate and confirmed cases</h2>
            <p className={style.casesChartSubtitle}>
                Rainfall, temperature and confirmed cases{selectedUnitName ? ` · ${selectedUnitName}` : ''}{range ? ` · ${range}` : ''}
            </p>
            {loading ? (
                <div className={style.casesChartEmpty}>Loading historical climate data…</div>
            ) : hasData ? (
                <>
                    <div className={style.historicalClimateCasesChart}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={rows}
                                margin={{
                                    top: lagPeaks ? LAG_BAND_HEIGHT : 16,
                                    right: CHART_RIGHT_MARGIN,
                                    bottom: 8,
                                    left: 8,
                                }}
                            >
                                <CartesianGrid vertical={false} stroke="#dbe2ea" />
                                <XAxis
                                    dataKey="period"
                                    tickFormatter={shortMonth}
                                    tick={AXIS_TICK}
                                    axisLine={{ stroke: '#cbd5e1' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    yAxisId="rainfall"
                                    tick={AXIS_TICK}
                                    axisLine={false}
                                    tickLine={false}
                                    width={42}
                                    label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', fill: '#64748b', style: AXIS_LABEL_TEXT }}
                                />
                                <YAxis
                                    yAxisId="cases"
                                    orientation="right"
                                    tickFormatter={(value) => caseFormat.format(value)}
                                    tick={{ ...AXIS_TICK, fill: CASES_COLOR }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={CASES_AXIS_WIDTH}
                                    label={{ value: 'Cases', angle: 90, position: 'insideRight', fill: CASES_COLOR, style: AXIS_LABEL_TEXT }}
                                />
                                <YAxis
                                    yAxisId="temperature"
                                    orientation="right"
                                    offset={52}
                                    tickFormatter={(value) => `${numberFormat.format(value)}°`}
                                    tick={{ ...AXIS_TICK, fill: TEMPERATURE_COLOR }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={TEMPERATURE_AXIS_WIDTH}
                                    label={{ value: '°C', angle: 90, position: 'insideRight', fill: TEMPERATURE_COLOR, style: AXIS_LABEL_TEXT }}
                                />
                                <Tooltip
                                    labelFormatter={monthAndYear}
                                    formatter={(value, name) => {
                                        if (value === null || value === undefined) return ['No data', name];
                                        if (name === 'Rainfall') return [`${numberFormat.format(value)} mm`, name];
                                        if (name === 'Temperature') return [`${numberFormat.format(value)} °C`, name];
                                        return [caseFormat.format(value), name];
                                    }}
                                />
                                <Legend verticalAlign="bottom" height={28} />
                                <Bar
                                    yAxisId="rainfall"
                                    dataKey="rainfall"
                                    name="Rainfall"
                                    fill={RAINFALL_COLOR}
                                    maxBarSize={32}
                                />
                                <Line
                                    yAxisId="temperature"
                                    dataKey="temperature"
                                    name="Temperature"
                                    type="monotone"
                                    stroke={TEMPERATURE_COLOR}
                                    strokeWidth={2}
                                    strokeDasharray="4 4"
                                    connectNulls
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                                <Line
                                    yAxisId="cases"
                                    dataKey="cases"
                                    name="Confirmed cases"
                                    type="monotone"
                                    stroke={CASES_COLOR}
                                    strokeWidth={2.5}
                                    connectNulls
                                    dot={{ r: 3, fill: CASES_COLOR }}
                                    activeDot={{ r: 5 }}
                                />
                                {lagPeaks ? <LagAnnotation peaks={lagPeaks} /> : null}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <p className={style.historicalClimateCasesInsight}>
                        {insight || 'Review the monthly rainfall, temperature and case trends together to guide preparedness.'}
                    </p>
                </>
            ) : (
                <div className={style.casesChartEmpty}>
                    {!rainfallDataElement || !temperatureDataElement
                        ? 'Select rainfall and temperature data elements in Settings to display historical climate.'
                        : 'No historical rainfall, temperature or confirmed case data is available for this period and organization unit.'}
                </div>
            )}
        </section>
    );
};

export default HistoricalClimateCasesChart;
