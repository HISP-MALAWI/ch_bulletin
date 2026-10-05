import React from 'react';
import {
    Area,
    Bar,
    CartesianGrid,
    ComposedChart,
    LabelList,
    Legend,
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
const axisTick = { fill: palette.mute, fontSize: 12, fontFamily: fontFamily.mono };

// The same alert/watch/normal vocabulary the rest of the bulletin uses, so the
// tag, the sentence and the chart all agree.
//
// Each label is a literal i18n.t call rather than a lookup into a map: the
// catalogue scanner cannot resolve a computed call, and a TypeError there means
// the strings silently never reach en.pot.
const statusLabel = (status) => {
    if (status === 'alert') return i18n.t('Alert');
    if (status === 'watch') return i18n.t('Watch');
    return i18n.t('Normal');
};

const STATUS_CLASS = {
    alert: 'bulletinTagAlert',
    watch: 'bulletinTagWatch',
    normal: 'bulletinTagNormal',
};

const shortMonth = (period) => {
    const date = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1));
    return new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
};

const longMonth = (period) => {
    const date = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1));
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
};

const compactNumber = (value) => `${Math.round(value / 1000)}k`;

// Declared out here rather than inline: the catalogue scanner cannot parse a
// nested object literal written directly in a JSX attribute.
const forecastRegionLabel = {
    value: 'FORECAST →',
    position: 'insideTopLeft',
    fill: palette.shire,
    fontSize: 11,
    fontFamily: fontFamily.mono,
};

const TotalLabel = ({ x, y, width, payload }) => {
    if (!payload) return null;
    const total = payload.cases;
    if (total <= 0) return null;
    return (
        <text x={x + width / 2} y={y - 8} fill={palette.ink} textAnchor="middle" fontSize={12}>
            {compactNumber(total)}
        </text>
    );
};

const HealthCasesWidget = ({ style, step, title = 'Malaria Forecast', description, dataValues = [], mapping = [], orgUnits = [], selectedOrgUnit, period }) => {
    const organisationUnitList = Array.isArray(orgUnits) ? orgUnits : [];
    const periods = React.useMemo(
        () => (period ? getMonthlyPeriods(period) : []),
        [period]
    );
    const { malariaMapping, rows } = React.useMemo(
        () => buildSelectedUnitMalariaData({ dataValues, mapping, periods, selectedOrgUnit }),
        [dataValues, mapping, periods, selectedOrgUnit]
    );
    const forecast = React.useMemo(() => summariseForecast({ rows }), [rows]);

    const hasChartData = rows.some((row) => (
        row.cases > 0 ||
        row.threshold !== null ||
        row.predictionMedian !== null ||
        row.predictionRange !== undefined ||
        row.quartileRange !== undefined
    ));
    const diseaseName = malariaMapping?.displayName?.replace(/\s+cases?$/i, '').toLowerCase() || 'malaria';
    const selectedOrgUnitName = organisationUnitList.find((unit) => unit.id === selectedOrgUnit)?.displayName || '';
    const dateRange = periods.length
        ? `${shortMonth(periods[0]).replace(/ (\d{2})$/, ' 20$1')} – ${shortMonth(periods.at(-1)).replace(/ (\d{2})$/, ' 20$1')}`
        : '';
    const lastPeriod = rows.length ? rows[rows.length - 1].period : null;

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
    // object: the catalogue scanner cannot parse a spread here, and it fails
    // the whole file's extraction when it meets one.
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

    return (
        <div>
            <BulletinSectionHeader step={step} title={title} description={description} />
            <h3 className={style.casesChartTitle}>Current {diseaseName} cases and prediction</h3>
            <p className={style.casesChartSubtitle}>
                Confirmed cases and forecast range{selectedOrgUnitName ? ` for ${selectedOrgUnitName}` : ''}{dateRange ? `, ${dateRange}` : ''}
            </p>
            {hasChartData ? (
                <div className={style.casesChart}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={rows} margin={{ top: 24, right: 12, bottom: 8, left: 4 }} barCategoryGap="24%">
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
                                    label={forecastRegionLabel}
                                />
                            )}
                            <XAxis
                                dataKey="period"
                                tickFormatter={shortMonth}
                                tick={axisTick}
                                axisLine={{ stroke: palette.line }}
                                tickLine={false}
                                minTickGap={8}
                            />
                            <YAxis
                                tickFormatter={compactNumber}
                                tick={axisTick}
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
                            <Bar dataKey="cases" name="Confirmed cases" fill={series.cases} maxBarSize={58}>
                                <LabelList dataKey="cases" content={<TotalLabel />} />
                            </Bar>
                            {/* Two bands, the wider one drawn first and lighter,
                                with the narrower interval inside it. */}
                            <Area
                                dataKey="predictionRange"
                                name="80% interval"
                                type="monotone"
                                fill={series.predictionRange}
                                fillOpacity={1}
                                stroke="none"
                                connectNulls
                            />
                            <Area
                                dataKey="quartileRange"
                                name="50% interval"
                                type="monotone"
                                fill={series.predictionQuartile}
                                fillOpacity={1}
                                stroke="none"
                                connectNulls
                            />
                            {malariaMapping?.threshold && (
                                <Line
                                    dataKey="threshold"
                                    name="Alert threshold"
                                    type="monotone"
                                    stroke={series.threshold}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls
                                />
                            )}
                            {malariaMapping?.predictionMedian && (
                                <Line
                                    dataKey="predictionMedian"
                                    name="Median forecast"
                                    type="monotone"
                                    stroke={palette.lake}
                                    strokeWidth={2}
                                    strokeDasharray="6 4"
                                    dot={{ r: 3, fill: palette.lake, strokeWidth: 0 }}
                                    label={medianLabel}
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
    );
};

export default HealthCasesWidget;
