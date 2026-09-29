import React from 'react';
import {
    Area,
    Bar,
    CartesianGrid,
    ComposedChart,
    LabelList,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { getMonthlyPeriods } from '../utils/getDataValues';
import { buildSelectedUnitMalariaData } from '../utils/monthlyMalariaData';

const CASES_COLOR = '#328c94';

const numberFormat = new Intl.NumberFormat('en');

const shortMonth = (period) => {
    const date = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1));
    return new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
};

const compactNumber = (value) => `${Math.round(value / 1000)}k`;

const TotalLabel = ({ x, y, width, payload }) => {
    if (!payload) return null;
    const total = payload.cases;
    if (total <= 0) return null;
    return (
        <text x={x + width / 2} y={y - 8} fill="#102b42" textAnchor="middle" fontSize={12}>
            {compactNumber(total)}
        </text>
    );
};

const HealthCasesWidget = ({ style, step, dataValues = [], mapping = [], orgUnits = [], selectedOrgUnit, period }) => {
    const periods = React.useMemo(
        () => (period ? getMonthlyPeriods(period) : []),
        [period]
    );
    const { malariaMapping, rows } = React.useMemo(
        () => buildSelectedUnitMalariaData({ dataValues, mapping, periods, selectedOrgUnit }),
        [dataValues, mapping, periods, selectedOrgUnit]
    );
    const hasChartData = rows.some((row) => (
        row.cases > 0 ||
        row.threshold !== null ||
        row.predictionMedian !== null ||
        row.predictionRange !== undefined
    ));
    const diseaseName = malariaMapping?.displayName?.replace(/\s+cases?$/i, '').toLowerCase() || 'malaria';
    const selectedOrgUnitName = orgUnits.find((unit) => unit.id === selectedOrgUnit)?.displayName || '';
    const dateRange = periods.length
        ? `${shortMonth(periods[0]).replace(/ (\d{2})$/, ' 20$1')} – ${shortMonth(periods.at(-1)).replace(/ (\d{2})$/, ' 20$1')}`
        : '';

    return (
        <div>
            <div className={style.sectionHeader}>
                <div className={style.stepBadge}>{step}</div>
                <h2 className={style.casesChartTitle}>Current {diseaseName} cases and prediction</h2>
            </div>
            <p className={style.casesChartSubtitle}>
                Confirmed cases and forecast range{selectedOrgUnitName ? ` for ${selectedOrgUnitName}` : ''}{dateRange ? `, ${dateRange}` : ''}
            </p>
            {hasChartData ? (
                <div className={style.casesChart}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={rows} margin={{ top: 24, right: 12, bottom: 8, left: 4 }} barCategoryGap="24%">
                            <CartesianGrid vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="period"
                                tickFormatter={shortMonth}
                                tick={{ fill: '#334155', fontSize: 12, fontFamily: 'Courier New' }}
                                axisLine={{ stroke: '#cbd5e1' }}
                                tickLine={false}
                                minTickGap={8}
                            />
                            <YAxis
                                tickFormatter={compactNumber}
                                tick={{ fill: '#64748b', fontSize: 12, fontFamily: 'Courier New' }}
                                axisLine={false}
                                tickLine={false}
                                width={54}
                            />
                            <Tooltip
                                formatter={(value, name) => [
                                    Array.isArray(value)
                                        ? `${numberFormat.format(value[0])} – ${numberFormat.format(value[1])}`
                                        : numberFormat.format(value),
                                    name,
                                ]}
                                labelFormatter={(label) => shortMonth(label)}
                            />
                            <Legend verticalAlign="bottom" />
                            <Bar dataKey="cases" name="Confirmed cases" fill={CASES_COLOR} maxBarSize={58}>
                                <LabelList dataKey="cases" content={<TotalLabel />} />
                            </Bar>
                            <Area
                                dataKey="predictionRange"
                                name="Prediction range"
                                type="monotone"
                                fill="#3b82f6"
                                fillOpacity={0.24}
                                stroke="none"
                                connectNulls
                            />
                            {malariaMapping?.threshold && (
                                <Line
                                    dataKey="threshold"
                                    name="Threshold"
                                    type="monotone"
                                    stroke="#ce332d"
                                    strokeWidth={2}
                                    strokeDasharray="6 4"
                                    dot={false}
                                    connectNulls
                                />
                            )}
                            {malariaMapping?.predictionUpperBound && (
                                <Line
                                    dataKey="predictionUpperBound"
                                    name="Upper prediction limit"
                                    type="monotone"
                                    stroke="#60a5fa"
                                    strokeWidth={1.5}
                                    dot={false}
                                    connectNulls
                                />
                            )}
                            {malariaMapping?.predictionMedian && (
                                <Line
                                    dataKey="predictionMedian"
                                    name="Median prediction"
                                    type="monotone"
                                    stroke="#1d4ed8"
                                    strokeWidth={2}
                                    strokeDasharray="6 4"
                                    dot={false}
                                    connectNulls
                                />
                            )}
                            {malariaMapping?.predictionLowerBound && (
                                <Line
                                    dataKey="predictionLowerBound"
                                    name="Lower prediction limit"
                                    type="monotone"
                                    stroke="#60a5fa"
                                    strokeWidth={1.5}
                                    dot={false}
                                    connectNulls
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className={style.casesChartEmpty}>
                    {malariaMapping ? 'No malaria case data is available for these months and the selected organization unit.' : 'Add a malaria mapping to display case trends.'}
                </div>
            )}
        </div>
    );
};

export default HealthCasesWidget;