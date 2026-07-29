import { useEffect, useMemo, useState } from 'react';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';
import { CloudRain, Thermometer, Droplets, Wind, ChevronDown } from 'lucide-react';

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });

// Flattens a single MET-style timeseries entry into the fields the chart needs.
function flattenEntry(entry) {
    const details = entry?.data?.instant?.details;
    if (!details) return null;
    const precip =
        entry?.data?.next_1_hours?.details?.precipitation_amount ??
        entry?.data?.next_6_hours?.details?.precipitation_amount ??
        0;
    return {
        time: entry.time,
        t: details.air_temperature,
        rh: details.relative_humidity,
        wind: details.wind_speed,
        precip,
    };
}

// Accepts either the raw GeoJSON forecast payload ({ properties: { timeseries }})
// or an already-flattened array of { time, t, rh, wind, precip }.
function normaliseForecast(forecast) {
    const raw = forecast?.properties?.timeseries ?? forecast?.timeseries ?? forecast;
    if (!Array.isArray(raw)) return [];
    return raw
        .map((entry) => (entry?.data ? flattenEntry(entry) : entry))
        .filter(Boolean);
}

function aggregateByDay(rows) {
    const byDay = new Map();
    for (const r of rows) {
        const d = r.time.slice(0, 10);
        if (!byDay.has(d)) {
            byDay.set(d, { date: d, tMin: r.t, tMax: r.t, rhSum: 0, rhN: 0, windSum: 0, windN: 0, precip: 0 });
        }
        const b = byDay.get(d);
        b.tMin = Math.min(b.tMin, r.t);
        b.tMax = Math.max(b.tMax, r.t);
        b.rhSum += r.rh; b.rhN += 1;
        b.windSum += r.wind; b.windN += 1;
        b.precip += r.precip;
    }
    return Array.from(byDay.values()).map((b) => ({
        date: b.date,
        label: DAY_LABEL.format(new Date(b.date + 'T00:00:00Z')),
        tMin: Math.round(b.tMin * 10) / 10,
        tMax: Math.round(b.tMax * 10) / 10,
        rh: Math.round(b.rhSum / b.rhN),
        wind: Math.round((b.windSum / b.windN) * 10) / 10,
        precip: Math.round(b.precip * 10) / 10,
    }));
}

function trend(values) {
    if (values.length < 2) return 0;
    return values[values.length - 1] - values[0];
}

function TrendPill({ delta, unit = '' }) {
    if (Math.abs(delta) < 0.05) return <span className="fw-pill fw-pill--flat">Steady</span>;
    const up = delta > 0;
    return (
        <span className={`fw-pill ${up ? 'fw-pill--up' : 'fw-pill--down'}`}>
            {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}{unit}
        </span>
    );
}

function Stat({ icon, label, value, sub, pill, accent }) {
    return (
        <div className="fw-stat">
            <div className={`fw-stat__icon fw-stat__icon--${accent}`}>{icon}</div>
            <div className="fw-stat__body">
                <div className="fw-stat__label">{label}</div>
                <div className="fw-stat__valueRow">
                    <span className="fw-stat__value">{value}</span>
                    {pill}
                </div>
                {sub && <div className="fw-stat__sub">{sub}</div>}
            </div>
        </div>
    );
}

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;
    const tMax = payload.find((p) => p.dataKey === 'tMax')?.value;
    const tMin = payload.find((p) => p.dataKey === 'tMin')?.value;
    const precip = payload.find((p) => p.dataKey === 'precip')?.value;
    return (
        <div className="fw-tooltip">
            <div className="fw-tooltip__date">{label}</div>
            <div className="fw-tooltip__row"><span className="fw-tooltip__dot fw-tooltip__dot--max" />Max {tMax}°C</div>
            <div className="fw-tooltip__row"><span className="fw-tooltip__dot fw-tooltip__dot--min" />Min {tMin}°C</div>
            <div className="fw-tooltip__row"><span className="fw-tooltip__dot fw-tooltip__dot--rain" />Rainfall {precip} mm</div>
        </div>
    );
}

const ForecastWidget = ({ style, description, step, title, forecast, organisationUnit }) => {
    const [detailsOpen, setDetailsOpen] = useState(false);

    useEffect(() => {
        console.log(forecast);
    }, [forecast]);

    const daily = useMemo(() => aggregateByDay(normaliseForecast(forecast)), [forecast]);
    const hasData = daily.length > 0;

    const avgHigh = hasData ? Math.round(daily.reduce((s, d) => s + d.tMax, 0) / daily.length) : null;
    const avgLow = hasData ? Math.round(daily.reduce((s, d) => s + d.tMin, 0) / daily.length) : null;
    const totalRain = hasData ? Math.round(daily.reduce((s, d) => s + d.precip, 0) * 10) / 10 : null;
    const avgRh = hasData ? Math.round(daily.reduce((s, d) => s + d.rh, 0) / daily.length) : null;
    const avgWind = hasData ? Math.round((daily.reduce((s, d) => s + d.wind, 0) / daily.length) * 10) / 10 : null;

    const rainTrend = hasData ? trend(daily.map((d) => d.precip)) : 0;
    const tempTrend = hasData ? trend(daily.map((d) => d.tMax)) : 0;
    const rhTrend = hasData ? trend(daily.map((d) => d.rh)) : 0;
    const windTrend = hasData ? trend(daily.map((d) => d.wind)) : 0;

    const ouLabel = organisationUnit?.displayName || organisationUnit?.name || null;

    return (
        <div>
            <style>{`
                .fw-stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin: 14px 0 16px;
                }
                @media (max-width: 620px) {
                    .fw-stats { grid-template-columns: repeat(2, 1fr); }
                }
                .fw-stat {
                    display: flex;
                    gap: 10px;
                    padding: 12px;
                    border-radius: 10px;
                    background: #F8FAFC;
                }
                .fw-stat__icon {
                    width: 34px; height: 34px;
                    border-radius: 9px;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                .fw-stat__icon--sky { background: #EAF2FC; color: #2E7DD1; }
                .fw-stat__icon--amber { background: #FCF1E3; color: #E08A2C; }
                .fw-stat__icon--teal { background: #E4F5F3; color: #12897F; }
                .fw-stat__icon--violet { background: #EEECFA; color: #6C63C9; }
                .fw-stat__label { font-size: 11.5px; color: #64748B; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
                .fw-stat__valueRow { display: flex; align-items: baseline; gap: 6px; margin-top: 2px; }
                .fw-stat__value { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: #16233A; }
                .fw-stat__sub { font-size: 11.5px; color: #64748B; margin-top: 1px; }

                .fw-pill {
                    font-size: 10.5px;
                    font-weight: 700;
                    padding: 1px 6px;
                    border-radius: 999px;
                }
                .fw-pill--up { background: #FBEAE8; color: #C0392B; }
                .fw-pill--down { background: #E5F5EE; color: #1F8A5F; }
                .fw-pill--flat { background: #EEF1F5; color: #64748B; }

                .fw-chart-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }
                .fw-chart-head__title { font-size: 13px; font-weight: 650; color: #16233A; }
                .fw-chart-head__range { font-size: 12px; color: #64748B; margin-top: 1px; }
                .fw-legend { display: flex; gap: 14px; font-size: 11.5px; color: #64748B; }
                .fw-legend__item { display: flex; align-items: center; gap: 5px; }
                .fw-legend__swatch { width: 9px; height: 9px; border-radius: 2px; }

                .fw-chart-frame {
                    background: #F8FAFC;
                    border-radius: 10px;
                    padding: 14px 6px 4px 0;
                }

                .fw-empty {
                    height: 200px;
                    background: #f8fafc;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px dashed #cbd5e1;
                    border-radius: 10px;
                    color: #94a3b8;
                    font-size: 13px;
                }

                .fw-tooltip {
                    background: #16233A;
                    color: white;
                    padding: 10px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    min-width: 140px;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.18);
                }
                .fw-tooltip__date { font-weight: 700; margin-bottom: 6px; font-size: 12px; }
                .fw-tooltip__row { display: flex; align-items: center; gap: 6px; padding: 2px 0; opacity: 0.9; }
                .fw-tooltip__dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
                .fw-tooltip__dot--max { background: #E08A2C; }
                .fw-tooltip__dot--min { background: #2E7DD1; }
                .fw-tooltip__dot--rain { background: #9FB6D4; }

                .fw-details-toggle {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    margin-top: 12px;
                    background: none;
                    border: none;
                    padding: 0;
                    font-size: 12.5px;
                    font-weight: 600;
                    color: #2E7DD1;
                    cursor: pointer;
                }
                .fw-details-toggle svg { transition: transform 160ms ease; }
                .fw-details-toggle svg.fw-open { transform: rotate(180deg); }

                .fw-details-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                    font-size: 12px;
                }
                .fw-details-table th, .fw-details-table td {
                    text-align: left;
                    padding: 6px 8px;
                    border-bottom: 1px solid #E4E9F1;
                    color: #16233A;
                }
                .fw-details-table th {
                    color: #64748B;
                    font-weight: 600;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
            `}</style>

            <div className={style.sectionHeader}>
                <div className={style.stepBadge}>{step}</div>
                <span className={style.sectionTitle}>{title}</span>
                <span className={style.pill}>Auto-fetched from API</span>
            </div>

            {description && <p className={style.sectionSub}>{description}</p>}
            {ouLabel && <p className={style.sectionSub}>{ouLabel}</p>}

            {!hasData ? (
                <div className="fw-empty">
                    <p>Chart Visualization Placeholder</p>
                </div>
            ) : (
                <>
                    <div className="fw-stats">
                        <Stat
                            icon={<CloudRain size={16} />}
                            accent="sky"
                            label="Rainfall"
                            value={`${totalRain} mm`}
                            sub={`${daily.length}-day total`}
                            pill={<TrendPill delta={rainTrend} unit="mm" />}
                        />
                        <Stat
                            icon={<Thermometer size={16} />}
                            accent="amber"
                            label="Temperature"
                            value={`${avgLow}–${avgHigh}°C`}
                            sub="Daily min–max avg"
                            pill={<TrendPill delta={tempTrend} unit="°" />}
                        />
                        <Stat
                            icon={<Droplets size={16} />}
                            accent="teal"
                            label="Humidity"
                            value={`${avgRh}%`}
                            sub="Daily average"
                            pill={<TrendPill delta={rhTrend} unit="%" />}
                        />
                        <Stat
                            icon={<Wind size={16} />}
                            accent="violet"
                            label="Wind"
                            value={`${avgWind} m/s`}
                            sub="Daily average"
                            pill={<TrendPill delta={windTrend} unit="m/s" />}
                        />
                    </div>

                    <div className="fw-chart-head">
                        <div>
                            <div className="fw-chart-head__title">{daily.length}-Day Forecast Overview</div>
                            <div className="fw-chart-head__range">{daily[0].label} — {daily[daily.length - 1].label}</div>
                        </div>
                        <div className="fw-legend">
                            <div className="fw-legend__item"><span className="fw-legend__swatch" style={{ background: '#E08A2C' }} /> Max Temp</div>
                            <div className="fw-legend__item"><span className="fw-legend__swatch" style={{ background: '#2E7DD1' }} /> Min Temp</div>
                            <div className="fw-legend__item"><span className="fw-legend__swatch" style={{ background: '#B9CBE3' }} /> Rainfall</div>
                        </div>
                    </div>

                    <div className="fw-chart-frame">
                        <ResponsiveContainer width="100%" height={200}>
                            <ComposedChart data={daily} margin={{ top: 6, right: 16, bottom: 0, left: -18 }}>
                                <CartesianGrid vertical={false} stroke="#E4E9F1" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="temp" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={34} />
                                <YAxis yAxisId="rain" orientation="right" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={30} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar yAxisId="rain" dataKey="precip" fill="#B9CBE3" radius={[3, 3, 0, 0]} barSize={14} />
                                <Line yAxisId="temp" type="monotone" dataKey="tMax" stroke="#E08A2C" strokeWidth={2} dot={{ r: 3, fill: '#E08A2C', strokeWidth: 0 }} />
                                <Line yAxisId="temp" type="monotone" dataKey="tMin" stroke="#2E7DD1" strokeWidth={2} dot={{ r: 3, fill: '#2E7DD1', strokeWidth: 0 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    <button className="fw-details-toggle" onClick={() => setDetailsOpen((o) => !o)}>
                        View Forecast Details
                        <ChevronDown size={14} className={detailsOpen ? 'fw-open' : ''} />
                    </button>

                    {detailsOpen && (
                        <table className="fw-details-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Min °C</th>
                                    <th>Max °C</th>
                                    <th>Humidity %</th>
                                    <th>Wind m/s</th>
                                    <th>Rain mm</th>
                                </tr>
                            </thead>
                            <tbody>
                                {daily.map((d) => (
                                    <tr key={d.date}>
                                        <td>{d.label}</td>
                                        <td>{d.tMin}</td>
                                        <td>{d.tMax}</td>
                                        <td>{d.rh}</td>
                                        <td>{d.wind}</td>
                                        <td>{d.precip}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </>
            )}
        </div>
    );
};

export default ForecastWidget;