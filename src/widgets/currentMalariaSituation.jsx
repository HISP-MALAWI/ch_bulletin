import React from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    LabelList,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { getMonthlyPeriods } from '../utils/getDataValues';
import { buildRegionalMalariaData, buildZoneMalariaData } from '../utils/regionalCasesChart';

const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const ZONE_COLORS = ['#12374e', '#328c94', '#e0a32e', '#7a6bb7'];

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
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date);
};

const compactNumber = (value) => {
    if (Math.abs(value) < 1000) return String(value);
    return `${Math.round(value / 1000)}k`;
};

const TotalLabel = ({ x, y, width, payload }) => (
    (payload?.total ?? payload?.cases) > 0 ? (
        <text
            x={x + width / 2}
            y={y - 6}
            fill="#102b42"
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
        >
            {compactNumber(payload.total ?? payload.cases)}
        </text>
    ) : null
);

const CurrentMalariaSituation = ({
    style,
    dataValues = [],
    mapping = [],
    period,
    orgUnits = [],
    selectedOrgUnit,
}) => {
    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnit);
    const periods = React.useMemo(
        () => period ? getMonthlyPeriods(period, 12, 0).slice(0, 12) : [],
        [period]
    );
    const { malariaMapping, zones, rows } = React.useMemo(
        () => buildZoneMalariaData({
            dataValues,
            mapping,
            periods,
            orgUnits,
            selectedOrgUnit,
        }),
        [dataValues, mapping, orgUnits, periods, selectedOrgUnit]
    );
    const { rows: selectedUnitRows } = React.useMemo(
        () => buildRegionalMalariaData({
            dataValues,
            mapping,
            periods,
            selectedOrgUnit,
        }),
        [dataValues, mapping, periods, selectedOrgUnit]
    );

    if (!selectedOrgUnit) return null;

    const isLevelOneSelection = Number(selectedUnit?.level) === 1;
    const chartRows = isLevelOneSelection ? rows : selectedUnitRows;
    const hasData = chartRows.some((row) => (isLevelOneSelection ? row.total : row.cases) > 0);
    const range = periods.length
        ? `${monthAndYear(periods[0])}–${monthAndYear(periods.at(-1))}`
        : '';
    const selectedUnitName = selectedUnit?.displayName || selectedUnit?.name || 'selected organisation unit';

    return (
        <section className={`${style.sectionCard} ${style.currentMalariaPanel}`}>
            <h2 className={style.casesChartTitle}>Current Malaria Situation</h2>
            <p className={style.casesChartSubtitle}>
                Confirmed cases {isLevelOneSelection ? 'by region' : `in ${selectedUnitName}`}{range ? ` · ${range}` : ''}
            </p>
            {hasData ? (
                <div className={style.currentMalariaChart}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartRows}
                            margin={{ top: 20, right: 8, bottom: 0, left: 0 }}
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
                                tickFormatter={compactNumber}
                                tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'Courier New' }}
                                axisLine={false}
                                tickLine={false}
                                width={40}
                            />
                            <Tooltip
                                labelFormatter={(label) => monthAndYear(label)}
                                formatter={(value, name) => [numberFormat.format(value), name]}
                            />
                            {isLevelOneSelection ? (
                                <>
                                    <Legend verticalAlign="bottom" height={28} />
                                    {zones.map((zone, index) => (
                                        <Bar
                                            key={zone.id}
                                            dataKey={zone.id}
                                            name={zone.displayName || zone.name || zone.id}
                                            stackId="malaria-regions"
                                            fill={ZONE_COLORS[index % ZONE_COLORS.length]}
                                            maxBarSize={38}
                                        >
                                            {index === zones.length - 1 && (
                                                <LabelList dataKey="total" content={<TotalLabel />} />
                                            )}
                                        </Bar>
                                    ))}
                                </>
                            ) : (
                                <Bar
                                    dataKey="cases"
                                    name="Confirmed malaria cases"
                                    fill={ZONE_COLORS[0]}
                                    maxBarSize={38}
                                >
                                    <LabelList dataKey="cases" content={<TotalLabel />} />
                                </Bar>
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className={style.casesChartEmpty}>
                    {malariaMapping
                        ? `No malaria case data is available for ${isLevelOneSelection ? 'these regions' : 'this organisation unit'} and months.`
                        : 'Add a malaria data-element mapping to display regional case trends.'}
                </div>
            )}
            <p className={style.currentMalariaNote}>
                {isLevelOneSelection
                    ? 'Regional totals are stacked. Labels above bars show the total across zones.'
                    : 'Bars show confirmed malaria cases recorded for the selected organisation unit.'}
            </p>
        </section>
    );
};

export default CurrentMalariaSituation;
