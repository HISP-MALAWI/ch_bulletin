import { getMonthlyPeriods } from './getDataValues';
import {
    buildDistrictForecastStatuses,
    buildSelectedDistrictForecastRows,
} from './districtForecasts';
import { getClimateSignals } from './climateSignals';

const formatMonth = (period) => {
    const date = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(4, 6)) - 1, 1));
    return new Intl.DateTimeFormat('en', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date);
};

const getSeasonalSignals = (rows) => {
    const rainfallRows = rows.filter((row) => Number.isFinite(row.rainfall) && row.rainfall > 0);
    const temperatureRows = rows.filter((row) => Number.isFinite(row.temperature));

    return {
        peakRainfall: rainfallRows.sort((left, right) => right.rainfall - left.rainfall)[0] || null,
        warmestPeriod: temperatureRows.sort((left, right) => right.temperature - left.temperature)[0] || null,
    };
};

const getMedianPeak = ({ dataValues, malariaMapping, periods, orgUnitIds }) => {
    if (!malariaMapping?.predictionMedian) return null;

    const periodSet = new Set(periods);
    const orgUnitSet = new Set(orgUnitIds);
    const totalsByPeriod = new Map();
    dataValues.forEach((row) => {
        const [dataElement, period, orgUnitId] = row;
        const rawValue = row.at(-1);
        if (
            dataElement !== malariaMapping.predictionMedian ||
            !periodSet.has(period) ||
            !orgUnitSet.has(orgUnitId) ||
            rawValue === '' ||
            rawValue === null ||
            rawValue === undefined
        ) return;

        const value = Number(rawValue);
        if (Number.isFinite(value)) {
            totalsByPeriod.set(period, (totalsByPeriod.get(period) || 0) + value);
        }
    });

    return Array.from(totalsByPeriod, ([period, value]) => ({ period, value }))
        .sort((left, right) => right.value - left.value)[0] || null;
};

const formatSeasonalRainfall = (rainfall) =>
    `Seasonal outlook: rainfall is highest in ${formatMonth(rainfall.period)} (${rainfall.rainfall.toFixed(1)} mm); time prevention activity ahead of this period.`;

const formatTenDayRainfall = (rainfall) =>
    `10-day forecast: rainfall is highest on ${rainfall.date} (${rainfall.rainfall.toFixed(1)} mm); use this window to prepare facilities and communities for increased breeding-site risk.`;

export const buildDistrictActions = ({
    forecast,
    seasonalClimateRows = [],
    dataValues = [],
    mapping = [],
    period,
    selectedOrgUnitId,
    orgUnits = [],
}) => {
    const forecastPeriods = period ? getMonthlyPeriods(period, 0, 3) : [];
    const status = buildDistrictForecastStatuses({
        dataValues,
        mapping,
        periods: forecastPeriods,
        orgUnits,
        selectedOrgUnitId,
    });
    const malariaMapping = mapping.find((item) => /malaria/i.test(item?.displayName || ''));
    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnitId);
    const isDistrictSelection = Number(selectedUnit?.level) === 3;
    const districtForecast = isDistrictSelection
        ? buildSelectedDistrictForecastRows({
            dataValues,
            mapping,
            periods: forecastPeriods,
            selectedOrgUnitId,
        })
        : null;
    const seasonalSignals = getSeasonalSignals(seasonalClimateRows);
    const tenDaySignals = getClimateSignals(forecast);
    const tenDayRainfall = tenDaySignals
        .filter((row) => row.rainfall > 0)
        .sort((left, right) => right.rainfall - left.rainfall)[0] || null;
    const tenDayWarmest = tenDaySignals
        .filter((row) => Number.isFinite(row.temperature))
        .sort((left, right) => right.temperature - left.temperature)[0] || null;
    const monitoredOrgUnitIds = status
        ? status.districts.map((district) => district.id)
        : [selectedOrgUnitId].filter(Boolean);
    const malariaPeak = getMedianPeak({
        dataValues,
        malariaMapping,
        periods: forecastPeriods,
        orgUnitIds: monitoredOrgUnitIds,
    });
    const malariaPeakDetail = malariaPeak
        ? `${isDistrictSelection ? selectedUnit.displayName || selectedUnit.name || 'The selected district' : 'The combined district'} median forecast peaks at ${Math.round(malariaPeak.value)} cases in ${formatMonth(malariaPeak.period)}.`
        : 'A malaria median case peak is not available for the forecast months.';

    if (isDistrictSelection) {
        const unitName = selectedUnit.displayName || selectedUnit.name || selectedUnit.id;
        const alertRows = districtForecast.rows.filter((row) => row.status === 'alert');
        const watchRows = districtForecast.rows.filter((row) => row.status === 'watch');
        const statusRows = districtForecast.rows.filter((row) => row.status !== 'unavailable');
        const alerts = alertRows.length
            ? [
                `${unitName} has an alarm indication in ${alertRows.map((row) => formatMonth(row.period)).join(', ')}.`,
                'Validate recent case reports, intensify timely testing and reporting, and review referral readiness.',
                'Check rapid diagnostic test and antimalarial stocks, staffing, and reporting supplies before the alarm period.',
            ]
            : [`No alarm indication is recorded for ${unitName} in the forecast period; continue routine surveillance and maintain response readiness.`];
        const watches = watchRows.length
            ? watchRows.map((row) =>
                `${unitName} is at Watch in ${formatMonth(row.period)}: the median forecast is ${Math.round(row.predictionMedian)} of ${Math.round(row.threshold)} cases (${Math.round(row.predictionMedian / row.threshold * 100)}% of threshold). Review case trends and reporting weekly, and confirm diagnostic and treatment stocks.`
            )
            : alertRows.length
                ? [`${unitName} is classified as Alert in the forecast window; the alarm status takes priority over Watch classification.`]
                : statusRows.some((row) => row.status === 'normal')
                ? [`${unitName} is currently below the Watch band. Continue routine case reporting and review monthly forecasts for changes.`]
                : ['No threshold/median forecasts are available to classify Watch status.'];
        const districtActions = [malariaPeakDetail];

        if (malariaPeak) {
            districtActions.push(
                `Prepare ${unitName} facilities for the projected peak: review staffing, diagnostic capacity, antimalarial stocks, and reporting completeness before ${formatMonth(malariaPeak.period)}.`
            );
        }
        if (seasonalSignals.peakRainfall) {
            districtActions.push(formatSeasonalRainfall(seasonalSignals.peakRainfall));
            districtActions.push(
                `Before ${formatMonth(seasonalSignals.peakRainfall.period)}, coordinate community clean-up of standing water and reinforce consistent insecticide-treated net use in ${unitName}.`
            );
        }
        if (tenDayRainfall) {
            districtActions.push(formatTenDayRainfall(tenDayRainfall));
            districtActions.push(
                `After rainfall on ${tenDayRainfall.date}, encourage safe removal or covering of water-holding containers and check access to scheduled outreach in ${unitName}.`
            );
        }
        if (seasonalSignals.warmestPeriod) {
            districtActions.push(
                `Seasonal temperatures are highest in ${formatMonth(seasonalSignals.warmestPeriod.period)} (${seasonalSignals.warmestPeriod.temperature.toFixed(1)} °C); align ${unitName} surveillance and prevention messaging with this period.`
            );
        }
        if (tenDayWarmest) {
            districtActions.push(
                `10-day temperatures are highest on ${tenDayWarmest.date} (${tenDayWarmest.temperature.toFixed(1)} °C); remind ${unitName} facilities to report suspected cases promptly and follow national testing and treatment guidance.`
            );
        }
        if (!malariaPeak && !seasonalSignals.peakRainfall && !tenDayRainfall && !seasonalSignals.warmestPeriod && !tenDayWarmest) {
            districtActions.push(`No malaria or weather forecast values are available for ${unitName}; review data before setting response priorities.`);
        }

        return [
            { title: 'Malaria alert response', variant: 'alert', actions: alerts },
            { title: 'Threshold watch response', variant: 'watch', actions: watches },
            { title: 'Forecast-informed actions', variant: 'all', actions: districtActions },
        ];
    }

    let alertActions;
    if (status?.alerts.length) {
        const alarmPeriods = [...new Set(status.alerts.map((district) => district.period))]
            .sort()
            .map(formatMonth);
        alertActions = [
            `${status.alerts.length} monitored district${status.alerts.length === 1 ? '' : 's'} have forecast alarm signals${alarmPeriods.length ? ` in ${alarmPeriods.join(', ')}` : ''}.`,
            'Apply local outbreak-response protocols: validate recent case reports, intensify timely testing and reporting, and review referral readiness.',
            `Check rapid diagnostic test and antimalarial stocks, staffing, and reporting supplies before ${malariaPeak ? formatMonth(malariaPeak.period) : 'the forecast response period'}.`,
        ];
    } else if (status) {
        alertActions = [
            'No district alarm signals are active in the forecast window; maintain routine surveillance and readiness for the projected malaria peak.',
        ];
    } else {
        alertActions = [
            'District alarm classification is available only when a level 1 or 2 organisation unit is selected.',
        ];
    }

    let watchActions;
    if (status?.watches.length) {
        const closestWatch = status.watches.reduce((closest, district) => {
            const ratio = district.predictionMedian / district.threshold;
            return !closest || ratio > closest.ratio
                ? { ratio, period: district.period }
                : closest;
        }, null);
        watchActions = [
            `${status.watches.length} district${status.watches.length === 1 ? '' : 's'} have median malaria forecasts at least 75% but below threshold${closestWatch ? `; the closest forecast is ${Math.round(closestWatch.ratio * 100)}% of threshold in ${formatMonth(closestWatch.period)}` : ''}.`,
            'Review weekly case trends and reporting completeness so a rise toward threshold is detected promptly.',
            'Confirm diagnostic and treatment stocks, and prepare staff coverage for the forecast peak.',
        ];
    } else if (status) {
        watchActions = [
            'No district median forecasts are currently within 25% below threshold; continue monitoring the projected malaria trend.',
        ];
    } else if (malariaPeak) {
        watchActions = [
            `Use the selected unit’s projected median peak of ${Math.round(malariaPeak.value)} cases in ${formatMonth(malariaPeak.period)} to time case review and stock checks.`,
            'Review recent reporting completeness and facility readiness ahead of the projected increase.',
        ];
    } else {
        watchActions = [
            'Median case forecasts are unavailable; review the configured malaria prediction indicators.',
        ];
    }

    const allDistrictActions = [malariaPeakDetail];
    if (seasonalSignals.peakRainfall) {
        allDistrictActions.push(formatSeasonalRainfall(seasonalSignals.peakRainfall));
        allDistrictActions.push(
            `Before the expected rainfall peak in ${formatMonth(seasonalSignals.peakRainfall.period)}, coordinate community clean-up of standing water and reinforce consistent insecticide-treated net use.`
        );
    }
    if (tenDayRainfall) {
        allDistrictActions.push(formatTenDayRainfall(tenDayRainfall));
        allDistrictActions.push(
            `After rainfall on ${tenDayRainfall.date}, encourage safe removal or covering of water-holding containers and check that scheduled outreach remains accessible.`
        );
    }
    if (seasonalSignals.warmestPeriod) {
        allDistrictActions.push(
            `Seasonal outlook: temperatures are highest in ${formatMonth(seasonalSignals.warmestPeriod.period)} (${seasonalSignals.warmestPeriod.temperature.toFixed(1)} °C); align surveillance planning with this period.`
        );
        allDistrictActions.push(
            `Use the warm-period outlook for ${formatMonth(seasonalSignals.warmestPeriod.period)} to keep routine case reporting timely and maintain access to testing and treatment.`
        );
    }
    if (tenDayWarmest) {
        allDistrictActions.push(
            `10-day forecast: temperatures are highest on ${tenDayWarmest.date} (${tenDayWarmest.temperature.toFixed(1)} °C); align surveillance planning with this window.`
        );
        allDistrictActions.push(
            `During the warm period around ${tenDayWarmest.date}, remind facilities to report suspected malaria cases promptly and follow national testing and treatment guidance.`
        );
    }
    if (malariaPeak && seasonalSignals.peakRainfall?.period === malariaPeak.period) {
        allDistrictActions.push(
            `Malaria cases and seasonal rainfall both peak in ${formatMonth(malariaPeak.period)}; complete prevention planning and facility stock checks before that month.`
        );
    }
    if (!malariaPeak && !seasonalSignals.peakRainfall && !tenDayRainfall && !seasonalSignals.warmestPeriod && !tenDayWarmest) {
        allDistrictActions.push(
            `No malaria or weather forecast values are available for ${selectedUnit?.displayName || 'the selected area'}; review forecast data before setting response priorities.`
        );
    }

    return [
        { title: 'Malaria alert response', variant: 'alert', actions: alertActions },
        { title: 'Threshold watch response', variant: 'watch', actions: watchActions },
        { title: 'Forecast-informed actions', variant: 'all', actions: allDistrictActions },
    ];
};
