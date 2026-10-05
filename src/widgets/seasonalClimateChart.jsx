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
import {
    buildSeasonalClimateRows,
    fetchSeasonalClimateDataValues,
    getSeasonalForecastPeriods,
} from '../utils/seasonalClimateData';
import { palette, series, fontFamily } from '../theme/tokens';
import { BulletinSectionHeader } from './bulletinSection';

const RAINFALL_COLOR = series.rainfall;
const TEMPERATURE_COLOR = series.temperature;
const axisTick = { fill: palette.mute, fontSize: 12, fontFamily: fontFamily.mono };
const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

const formatMonth = (period) => {
    const date = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1));
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC',
    }).format(date);
};

const SeasonalClimateChart = ({
    style,
    rainfallDataElement,
    temperatureDataElement,
    selectedOrgUnit,
    period,
    onDataValuesChange,
    initialDataValues,
    orgUnits = [],
    step,
    title = 'Seasonal rainfall and temperature',
    description,
}) => {
    const engine = useDataEngine();
    const [dataValues, setDataValues] = React.useState(initialDataValues || []);
    const [loading, setLoading] = React.useState(false);
    const [loadError, setLoadError] = React.useState(null);
    const periods = React.useMemo(() => getSeasonalForecastPeriods(period), [period]);
    const hasConfiguredElements = rainfallDataElement && temperatureDataElement;

    React.useEffect(() => {
        if (initialDataValues !== undefined) {
            setDataValues(initialDataValues);
            setLoadError(null);
            setLoading(false);
            return undefined;
        }

        if (!periods.length || !hasConfiguredElements || !selectedOrgUnit) {
            setDataValues([]);
            setLoadError(null);
            onDataValuesChange?.([]);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        fetchSeasonalClimateDataValues({
            dataElements: [rainfallDataElement, temperatureDataElement],
            periods,
            selectedOrgUnit,
            engine
        }).then((values) => {
            if (!cancelled) {
                setDataValues(values);
                onDataValuesChange?.(values);
            }
        }).catch((error) => {
            console.error('Failed to load seasonal climate data:', error);
            if (!cancelled) {
                setDataValues([]);
                onDataValuesChange?.([]);
                setLoadError(error);
            }
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [
        engine,
        hasConfiguredElements,
        initialDataValues,
        onDataValuesChange,
        rainfallDataElement,
        periods,
        selectedOrgUnit,
        temperatureDataElement,
    ]);

    const rows = React.useMemo(() => buildSeasonalClimateRows({
        dataValues,
        periods,
        rainfallDataElement,
        temperatureDataElement,
        selectedOrgUnit,
    }), [dataValues, periods, rainfallDataElement, temperatureDataElement, selectedOrgUnit]);
    const hasChartData = rows.some((row) => row.rainfall !== null || row.temperature !== null);
    const orgUnitName = orgUnits.find((unit) => unit.id === selectedOrgUnit)?.displayName;

    if (!periods.length) return null;

    return (
        <section className={style.sectionCard}>
            <BulletinSectionHeader step={step} title={title} description={description} />
            <p className={style.casesChartSubtitle}>
                Monthly rainfall and mean temperature{orgUnitName ? ` for ${orgUnitName}` : ''}, {formatMonth(periods[0])} – {formatMonth(periods.at(-1))}
            </p>
            {loading ? (
                <div className={style.casesChartEmpty}>Loading seasonal climate data…</div>
            ) : loadError ? (
                <div className={style.casesChartEmpty} role="alert">
                    Unable to load seasonal climate data from DHIS2. Check data access and the configured indicators.
                </div>
            ) : !hasConfiguredElements ? (
                <div className={style.casesChartEmpty}>
                    Select rainfall and temperature data elements in Settings to display this chart.
                </div>
            ) : hasChartData ? (
                <div className={style.casesChart}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={rows} margin={{ top: 12, right: 24, bottom: 8, left: 8 }}>
                            <CartesianGrid vertical={false} stroke={palette.line} />
                            <XAxis
                                dataKey="period"
                                tickFormatter={formatMonth}
                                tick={axisTick}
                                axisLine={{ stroke: palette.line }}
                                tickLine={false}
                            />
                            <YAxis
                                yAxisId="rainfall"
                                tick={axisTick}
                                axisLine={false}
                                tickLine={false}
                                width={48}
                                label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', fill: palette.mute }}
                            />
                            <YAxis
                                yAxisId="temperature"
                                orientation="right"
                                tick={{ ...axisTick, fill: TEMPERATURE_COLOR }}
                                axisLine={false}
                                tickLine={false}
                                width={48}
                                label={{ value: 'Temperature (°C)', angle: 90, position: 'insideRight', fill: TEMPERATURE_COLOR }}
                            />
                            <Tooltip
                                formatter={(value, name) => [
                                    `${numberFormat.format(value)}${name === 'Rainfall' ? ' mm' : ' °C'}`,
                                    name,
                                ]}
                                labelFormatter={formatMonth}
                            />
                            <Legend verticalAlign="bottom" />
                            <Bar
                                yAxisId="rainfall"
                                dataKey="rainfall"
                                name="Rainfall"
                                fill={RAINFALL_COLOR}
                                maxBarSize={58}
                            />
                            <Line
                                yAxisId="temperature"
                                dataKey="temperature"
                                name="Temperature"
                                type="monotone"
                                stroke={TEMPERATURE_COLOR}
                                strokeWidth={2}
                                strokeDasharray="3 5"
                                connectNulls
                                dot={{ r: 3, fill: TEMPERATURE_COLOR }}
                                activeDot={{ r: 5 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className={style.casesChartEmpty}>
                    No rainfall or temperature data is available for this season and organization unit.
                </div>
            )}
        </section>
    );
};

export default SeasonalClimateChart;