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
} from 'recharts';
import { useDataEngine } from '@dhis2/app-runtime';
import getDataValues, { getMonthlyPeriods } from '../utils/getDataValues';
import {
    buildHistoricalClimateCaseRows,
    getRainfallCasePeakInsight,
} from '../utils/historicalClimateCases';

const RAINFALL_COLOR = '#86bec3';
const TEMPERATURE_COLOR = '#df453f';
const CASES_COLOR = '#328c5a';
const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const caseFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

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
                                margin={{ top: 16, right: 84, bottom: 8, left: 8 }}
                            >
                                <CartesianGrid vertical={false} stroke="#dbe2ea" />
                                <XAxis
                                    dataKey="period"
                                    tickFormatter={shortMonth}
                                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Courier New' }}
                                    axisLine={{ stroke: '#cbd5e1' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    yAxisId="rainfall"
                                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Courier New' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={42}
                                    label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', fill: '#64748b' }}
                                />
                                <YAxis
                                    yAxisId="cases"
                                    orientation="right"
                                    tickFormatter={(value) => caseFormat.format(value)}
                                    tick={{ fill: CASES_COLOR, fontSize: 10, fontFamily: 'Courier New' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={48}
                                    label={{ value: 'Cases', angle: 90, position: 'insideRight', fill: CASES_COLOR }}
                                />
                                <YAxis
                                    yAxisId="temperature"
                                    orientation="right"
                                    offset={52}
                                    tickFormatter={(value) => `${numberFormat.format(value)}°`}
                                    tick={{ fill: TEMPERATURE_COLOR, fontSize: 10, fontFamily: 'Courier New' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={38}
                                    label={{ value: '°C', angle: 90, position: 'insideRight', fill: TEMPERATURE_COLOR }}
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
