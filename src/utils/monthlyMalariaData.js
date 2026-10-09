// The chart reads a value out of a positional analytics row by matching the
// data element id back to the mapping, so every prediction field has to be
// named here as well as in the `dx:` list. One list, used both to seed an empty
// row and to build the lookup, so adding a field is a single line.
const PREDICTION_FIELDS = [
    'threshold',
    'predictionLowerBound',
    'predictionMedian',
    'predictionUpperBound',
    'predictionQuartileLow',
    'predictionQuartileHigh',
];

const FORECAST_FIELDS = new Set([
    'predictionLowerBound',
    'predictionMedian',
    'predictionUpperBound',
    'predictionQuartileLow',
    'predictionQuartileHigh',
]);

export const buildSelectedUnitMalariaData = ({
    dataValues = [],
    mapping = [],
    periods = [],
    selectedOrgUnit,
    forecastStartPeriod,
}) => {
    const malariaMapping = mapping.find((item) => /malaria/i.test(item.displayName || ''));
    if (!malariaMapping?.dataElement || periods.length === 0) {
        return { malariaMapping: null, rows: [] };
    }

    const emptyRow = (month) => {
        const row = { period: month, cases: 0 };
        PREDICTION_FIELDS.forEach((field) => {
            row[field] = null;
        });
        return row;
    };

    const periodSet = new Set(periods);
    const rowsByPeriod = new Map(periods.map((month) => [month, emptyRow(month)]));

    const rowFieldByDataElement = new Map();
    PREDICTION_FIELDS.forEach((field) => {
        const dataElementId = malariaMapping[field];
        if (dataElementId) {
            rowFieldByDataElement.set(dataElementId, field);
        }
    });

    dataValues.forEach((row) => {
        const [dataElement, month, organisationUnitId] = row;
        if (!periodSet.has(month) || organisationUnitId !== selectedOrgUnit) return;

        const value = Number(row.at(-1));
        if (!Number.isFinite(value)) return;

        if (dataElement === malariaMapping.dataElement) {
            rowsByPeriod.get(month).cases += value;
            return;
        }

        const rowField = rowFieldByDataElement.get(dataElement);
        if (rowField) {
            if (
                FORECAST_FIELDS.has(rowField) &&
                forecastStartPeriod &&
                month < forecastStartPeriod
            ) return;
            rowsByPeriod.get(month)[rowField] = value;
        }
    });

    rowsByPeriod.forEach((row) => {
        // A band needs both edges, so a half-populated pair is left as no band
        // rather than drawn down to zero.
        if (row.predictionLowerBound !== null && row.predictionUpperBound !== null) {
            row.predictionRange = [row.predictionLowerBound, row.predictionUpperBound];
        }
        if (row.predictionQuartileLow !== null && row.predictionQuartileHigh !== null) {
            row.quartileRange = [row.predictionQuartileLow, row.predictionQuartileHigh];
        }
    });

    return {
        malariaMapping,
        rows: Array.from(rowsByPeriod.values()),
    };
};

/**
 * Says, for each forecast month, whether its predicted median sits above the
 * alert threshold, near it, or below it — the rule the reference bulletin
 * documents: above the threshold is an alert, and within `watchBand` of it is a
 * watch.
 *
 * Months missing either the median or a usable threshold are left out rather
 * than guessed at. Returns structured data only; the sentence is assembled
 * where it is shown, so it stays translatable.
 */
export const summariseForecast = ({ rows = [], watchBand = 0.1 } = {}) => {
    const months = rows
        .filter((row) => (
            Number.isFinite(row.predictionMedian) &&
            Number.isFinite(row.threshold) &&
            row.threshold > 0
        ))
        .map((row) => {
            const ratio = row.predictionMedian / row.threshold;
            return {
                period: row.period,
                median: row.predictionMedian,
                threshold: row.threshold,
                status: ratio > 1 ? 'alert' : ratio >= 1 - watchBand ? 'watch' : 'normal',
            };
        });

    const peak = months.reduce(
        (highest, month) => (highest && highest.median >= month.median ? highest : month),
        null
    );

    // Independent of the threshold: the shaded forecast region starts where the
    // predictions do, whether or not a threshold is configured.
    const firstForecast = rows.find((row) => Number.isFinite(row.predictionMedian));

    return {
        months,
        monthsAboveThreshold: months.filter((month) => month.status === 'alert').length,
        peak,
        forecastStartsAt: firstForecast ? firstForecast.period : null,
    };
};

export const sumMappedPredictionValues = ({
    dataValues = [],
    mapping = [],
    periods = [],
    selectedOrgUnit,
    predictionField,
}) => {
    const dataElementIds = new Set(
        mapping.map((item) => item?.[predictionField]).filter(Boolean)
    );
    const periodSet = new Set(periods);
    if (dataElementIds.size === 0 || periodSet.size === 0 || !selectedOrgUnit) {
        return null;
    }

    let total = 0;
    let foundValue = false;

    dataValues.forEach((row) => {
        const [dataElement, month, organisationUnitId] = row;
        const rawValue = row.at(-1);
        if (
            !dataElementIds.has(dataElement) ||
            !periodSet.has(month) ||
            organisationUnitId !== selectedOrgUnit ||
            rawValue === '' ||
            rawValue === null ||
            rawValue === undefined
        ) return;

        const value = Number(rawValue);
        if (Number.isFinite(value)) {
            total += value;
            foundValue = true;
        }
    });

    return foundValue ? total : null;
};

export const countMappedAlerts = ({ dataValues = [], mapping = [], periods = [], selectedOrgUnit }) => {
    const alarmElementIds = new Set(mapping.map((item) => item?.alarmElement).filter(Boolean));
    const periodSet = new Set(periods);
    if (alarmElementIds.size === 0 || periodSet.size === 0 || !selectedOrgUnit) {
        return null;
    }

    let alertCount = 0;
    let foundValue = false;

    dataValues.forEach((row) => {
        const [dataElement, month, organisationUnitId] = row;
        if (
            !alarmElementIds.has(dataElement) ||
            !periodSet.has(month) ||
            organisationUnitId !== selectedOrgUnit
        ) return;

        const value = Number(row.at(-1));
        if (value === 0 || value === 1) {
            foundValue = true;
            if (value === 1) alertCount += 1;
        }
    });

    return foundValue ? alertCount : null;
};