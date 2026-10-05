import { getDistrictDescendants, getZoneDescendants } from './districtForecasts';

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

export const buildZoneMalariaData = ({
    dataValues = [],
    mapping = [],
    periods = [],
    orgUnits = [],
    selectedOrgUnit,
}) => {
    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnit);
    const malariaMapping = mapping.find((item) => /malaria/i.test(item.displayName || ''));
    const zones = getZoneDescendants(orgUnits, selectedOrgUnit);

    if (Number(selectedUnit?.level) !== 1 || !malariaMapping?.dataElement || periods.length === 0) {
        return { malariaMapping: malariaMapping || null, zones, rows: [] };
    }

    const districtsByZone = new Map(
        zones.map((zone) => [
            zone.id,
            getDistrictDescendants(orgUnits, zone.id).map((district) => district.id),
        ])
    );
    const valuesByUnitAndPeriod = new Map();

    dataValues.forEach((row) => {
        const [dataElement, period, orgUnitId] = row;
        if (dataElement !== malariaMapping.dataElement || !periods.includes(period)) return;

        const rawValue = row.at(-1);
        if (rawValue === '' || rawValue === null || rawValue === undefined) return;

        const value = Number(rawValue);
        if (!Number.isFinite(value)) return;

        const key = `${orgUnitId}:${period}`;
        const previous = valuesByUnitAndPeriod.get(key);
        valuesByUnitAndPeriod.set(key, {
            value: (previous?.value || 0) + value,
        });
    });

    const rows = periods.map((period) => {
        const row = { period, total: 0 };
        zones.forEach((zone) => {
            const directValue = valuesByUnitAndPeriod.get(`${zone.id}:${period}`);
            let cases = directValue?.value;

            if (!directValue) {
                const districtValues = districtsByZone.get(zone.id)
                    .map((districtId) => valuesByUnitAndPeriod.get(`${districtId}:${period}`))
                    .filter(Boolean);
                cases = districtValues.reduce((total, districtValue) => total + districtValue.value, 0);
            }

            row[zone.id] = cases || 0;
            row.total += cases || 0;
        });
        return row;
    });

    return { malariaMapping, zones, rows };
};