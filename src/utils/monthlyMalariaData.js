export const buildSelectedUnitMalariaData = ({ dataValues = [], mapping = [], periods = [], selectedOrgUnit }) => {
    const malariaMapping = mapping.find((item) => /malaria/i.test(item.displayName || ''));
    if (!malariaMapping?.dataElement || periods.length === 0) {
        return { malariaMapping: null, rows: [] };
    }

    const periodSet = new Set(periods);
    const rowsByPeriod = new Map(periods.map((month) => [month, {
        period: month,
        cases: 0,
        threshold: null,
        predictionLowerBound: null,
        predictionMedian: null,
        predictionUpperBound: null,
    }]));

    dataValues.forEach((row) => {
        const [dataElement, month, organisationUnitId] = row;
        if (!periodSet.has(month) || organisationUnitId !== selectedOrgUnit) return;

        const value = Number(row.at(-1));
        if (dataElement === malariaMapping.dataElement && Number.isFinite(value)) {
            rowsByPeriod.get(month).cases += value;
        } else if (dataElement === malariaMapping.threshold && Number.isFinite(value)) {
            rowsByPeriod.get(month).threshold = value;
        } else if (dataElement === malariaMapping.predictionLowerBound && Number.isFinite(value)) {
            rowsByPeriod.get(month).predictionLowerBound = value;
        } else if (dataElement === malariaMapping.predictionMedian && Number.isFinite(value)) {
            rowsByPeriod.get(month).predictionMedian = value;
        } else if (dataElement === malariaMapping.predictionUpperBound && Number.isFinite(value)) {
            rowsByPeriod.get(month).predictionUpperBound = value;
        }
    });

    rowsByPeriod.forEach((row) => {
        if (row.predictionLowerBound !== null && row.predictionUpperBound !== null) {
            row.predictionRange = [row.predictionLowerBound, row.predictionUpperBound];
        }
    });

    return {
        malariaMapping,
        rows: Array.from(rowsByPeriod.values()),
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