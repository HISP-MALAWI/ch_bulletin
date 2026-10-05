import { getDistrictDescendants, getZoneDescendants } from './districtForecasts';

export const buildHistoricalClimateCaseRows = ({
    climateDataValues = [],
    caseDataValues = [],
    mapping = [],
    periods = [],
    rainfallDataElement,
    temperatureDataElement,
    selectedOrgUnit,
    orgUnits = [],
}) => {
    const malariaMapping = mapping.find((item) => /malaria/i.test(item?.displayName || ''));
    const periodSet = new Set(periods);
    const districtIds = new Set(
        getDistrictDescendants(orgUnits, selectedOrgUnit).map((unit) => unit.id)
    );
    const zoneIds = new Set(
        getZoneDescendants(orgUnits, selectedOrgUnit).map((unit) => unit.id)
    );
    const rowsByPeriod = new Map(periods.map((period) => [
        period,
        { period, rainfall: null, temperature: null, cases: null },
    ]));

    climateDataValues.forEach((row) => {
        const [dataElement, period, orgUnit, rawValue] = row;
        const chartRow = rowsByPeriod.get(period);
        if (!chartRow || orgUnit !== selectedOrgUnit || rawValue === '' || rawValue == null) return;

        const value = Number(rawValue);
        if (!Number.isFinite(value)) return;
        if (dataElement === rainfallDataElement) chartRow.rainfall = value;
        if (dataElement === temperatureDataElement) chartRow.temperature = value;
    });

    const directCases = new Map();
    const zoneCases = new Map();
    const districtCases = new Map();
    caseDataValues.forEach((row) => {
        const [dataElement, period, orgUnit] = row;
        const chartRow = rowsByPeriod.get(period);
        const rawValue = row.at(-1);
        if (
            !chartRow ||
            dataElement !== malariaMapping?.dataElement ||
            rawValue === '' ||
            rawValue == null
        ) return;

        const value = Number(rawValue);
        if (!Number.isFinite(value)) return;
        if (orgUnit === selectedOrgUnit) {
            directCases.set(period, (directCases.get(period) || 0) + value);
        } else if (zoneIds.has(orgUnit)) {
            zoneCases.set(period, (zoneCases.get(period) || 0) + value);
        } else if (districtIds.has(orgUnit)) {
            districtCases.set(period, (districtCases.get(period) || 0) + value);
        }
    });

    rowsByPeriod.forEach((row) => {
        if (directCases.has(row.period)) {
            row.cases = directCases.get(row.period);
        } else if (zoneCases.has(row.period)) {
            row.cases = zoneCases.get(row.period);
        } else if (districtCases.has(row.period)) {
            row.cases = districtCases.get(row.period);
        }
    });

    return Array.from(rowsByPeriod.values());
};

export const getRainfallCasePeakInsight = (rows = []) => {
    const rainfallPeak = rows
        .filter((row) => Number.isFinite(row.rainfall))
        .reduce((peak, row) => !peak || row.rainfall > peak.rainfall ? row : peak, null);
    const casesPeak = rows
        .filter((row) => Number.isFinite(row.cases))
        .reduce((peak, row) => !peak || row.cases > peak.cases ? row : peak, null);

    if (!rainfallPeak || !casesPeak) return null;

    const rainfallIndex = rows.findIndex((row) => row.period === rainfallPeak.period);
    const casesIndex = rows.findIndex((row) => row.period === casesPeak.period);
    const leadMonths = casesIndex - rainfallIndex;

    if (leadMonths > 0) {
        return `The rainfall peak precedes the confirmed-case peak by ${leadMonths} month${leadMonths === 1 ? '' : 's'}, supporting anticipatory preparedness.`;
    }
    if (leadMonths === 0) {
        return 'Rainfall and confirmed cases peak in the same month; align prevention and facility readiness ahead of this period.';
    }
    return 'The rainfall peak does not precede the confirmed-case peak in this period; use the monthly trends to guide local preparedness.';
};
