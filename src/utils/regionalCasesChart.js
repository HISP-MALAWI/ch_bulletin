export const buildRegionalMalariaData = ({ dataValues = [], mapping = [], periods = [], orgUnits = [], selectedOrgUnit }) => {
    const malariaMapping = mapping.find((item) => /malaria/i.test(item.displayName || ''));
    if (!malariaMapping?.dataElement || periods.length === 0) {
        return { malariaMapping: null, rows: [] };
    }

    const periodSet = new Set(periods);
    const rowsByPeriod = new Map(periods.map((month) => [month, {
        period: month,
        cases: 0,
    }]));

    dataValues.forEach((row) => {
        const [dataElement, month, organisationUnitId] = row;
        if (
            dataElement !== malariaMapping.dataElement ||
            !periodSet.has(month) ||
            organisationUnitId !== selectedOrgUnit
        ) return;

        const value = Number(row.at(-1));
        if (Number.isFinite(value)) {
            rowsByPeriod.get(month).cases += value;
        }
    });

    return {
        malariaMapping,
        rows: Array.from(rowsByPeriod.values()),
    };
};