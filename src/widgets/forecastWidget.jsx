import { useEffect, useMemo } from 'react';
import { CloudRain, Thermometer, Droplets, Wind } from 'lucide-react';
import { BulletinSectionHeader } from './bulletinSection';

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

const ForecastWidget = ({ style, description, step, title, forecast, organisationUnit }) => {
    useEffect(() => {
        // console.log(forecast);
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
                    /* Four across, one row. This section is a half-width column
                       of the document — about 540px at a 1440px window — so a
                       card is only around 130px wide there, and the icon and
                       the text cannot sit side by side inside that: the trend
                       pill was pushed past the card's edge, and past the edge
                       of the section. The card stacks instead, which needs no
                       more width than its widest word.
                       The count is fixed rather than left to an auto-fit, so
                       that the number of columns cannot come out differently in
                       a window of a different width.
                       No width media query here on purpose. The PDF export
                       clones this document into an iframe sized to the browser
                       window, so a max-width rule collapses the captured layout
                       at widths that have nothing to do with the card's real
                       width. */
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 8px;
                    margin: 14px 0 16px;
                }
                .fw-stat {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 10px;
                    border-radius: 10px;
                    background: #F8FAFC;
                    /* The track can shrink below the card's contents; the
                       wrapping below is what keeps them inside it. */
                    min-width: 0;
                }
                .fw-stat__icon {
                    width: 28px; height: 28px;
                    border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                .fw-stat__icon--sky { background: #EAF2FC; color: #2E7DD1; }
                .fw-stat__icon--amber { background: #FCF1E3; color: #E08A2C; }
                .fw-stat__icon--teal { background: #E4F5F3; color: #12897F; }
                .fw-stat__icon--violet { background: #EEECFA; color: #6C63C9; }
                .fw-stat__body { min-width: 0; }
                /* anywhere rather than break-word: it is the one that shrinks
                   the card's minimum width, so a word too wide for the card
                   wraps instead of hanging out of it. It only bites in a
                   cramped window, where the section is narrower than the four
                   cards need. */
                .fw-stat__label { font-size: 10.5px; color: #64748B; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.25; overflow-wrap: anywhere; }
                /* The pill drops below the value rather than over the card's
                   edge when the two do not fit on one line together. */
                .fw-stat__valueRow { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
                .fw-stat__value { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; color: #16233A; }
                .fw-stat__sub { font-size: 10.5px; color: #64748B; margin-top: 1px; line-height: 1.3; }

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

            <BulletinSectionHeader step={step} title={title} description={description} />

            {ouLabel && <p className={style.sectionSub}>{ouLabel}</p>}

            {!hasData ? (
                <div className="fw-empty">
                    <p>No forecast data is available</p>
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

                    {/* The plot this head used to caption is gone, so the head
                        now captions the table below it and no longer carries a
                        legend — the swatches named series that are not drawn. */}
                    <div className="fw-chart-head">
                        <div>
                            <div className="fw-chart-head__title">{daily.length}-Day Forecast Overview</div>
                            <div className="fw-chart-head__range">{daily[0].label} — {daily[daily.length - 1].label}</div>
                        </div>
                    </div>

                    {/* Always shown. It used to wait behind a toggle because it
                        was the chart's detail; with the chart removed it is the
                        section's content, and a control has no place on the page
                        the export captures. */}
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
                </>
            )}
        </div>
    );
};

export default ForecastWidget;