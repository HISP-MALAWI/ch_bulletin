const getParentId = (unit) => unit?.parent?.id || unit?.parent || null;

/**
 * Each district's alarm, threshold and prediction values, month by month. The
 * risk classification, the map tooltip and the alert table all read the same
 * numbers, so they are collected once here rather than three times in slightly
 * different ways — a district must not be able to appear on the map and not in
 * the table.
 *
 * A blank is not a zero. `Number('')` and `Number(null)` are both `0`, so a
 * missing prediction used to become a real threshold or median and could put a
 * district in the Watch band. `'0'` is kept: zero is a valid alarm value.
 */
const collectDistrictValues = ({ districts, dataValues, malariaMapping, periods }) => {
    const periodSet = new Set(periods);
    const rowsByDistrict = new Map(
        districts.map((district) => [district.id, new Map()])
    );

    dataValues.forEach((row) => {
        const [dataElement, period, orgUnitId] = row;
        const districtPeriods = rowsByDistrict.get(orgUnitId);
        if (!districtPeriods || !periodSet.has(period)) return;

        const rawValue = row.at(-1);
        if (rawValue === '' || rawValue === null || rawValue === undefined) return;
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return;

        const values = districtPeriods.get(period) || {};
        if (dataElement === malariaMapping.alarmElement) {
            values.alarm = value;
        } else if (dataElement === malariaMapping.threshold) {
            values.threshold = value;
        } else if (dataElement === malariaMapping.predictionMedian) {
            values.predictionMedian = value;
        } else if (dataElement === malariaMapping.predictionLowerBound) {
            values.predictionLowerBound = value;
        } else if (dataElement === malariaMapping.predictionUpperBound) {
            values.predictionUpperBound = value;
        }
        districtPeriods.set(period, values);
    });

    return rowsByDistrict;
};

/**
 * One forecast month as the map reads it: the three prediction columns and the
 * risk category they classify as. Alarm wins over the Watch band; a month with
 * no values at all is `unavailable` rather than a quiet `normal`.
 */
const toForecastRow = (period, values = {}) => {
    const isAlert = values.alarm === 1;
    const isWatch = !isAlert &&
        values.threshold > 0 &&
        values.predictionMedian >= values.threshold * 0.75 &&
        values.predictionMedian < values.threshold;

    return {
        period,
        predictionMedian: values.predictionMedian ?? null,
        predictionLowerBound: values.predictionLowerBound ?? null,
        predictionUpperBound: values.predictionUpperBound ?? null,
        status: isAlert
            ? 'alert'
            : isWatch
                ? 'watch'
                : Object.values(values).some((value) => value !== undefined)
                    ? 'normal'
                    : 'unavailable',
    };
};

/**
 * The district's risk over the forecast window: alert if any month carries an
 * alarm, otherwise watch if any month is in the band, otherwise normal if any
 * month has values. `null` means there is nothing to classify, which the map
 * draws as outside/unavailable rather than as a quiet district.
 */
export const getDistrictRiskFromRows = (rows = []) =>
    rows.some((row) => row.status === 'alert')
        ? 'alert'
        : rows.some((row) => row.status === 'watch')
            ? 'watch'
            : rows.some((row) => row.status === 'normal')
                ? 'normal'
                : null;

const isAboveThreshold = (values) =>
    Number.isFinite(values.predictionMedian) &&
    Number.isFinite(values.threshold) &&
    values.threshold > 0 &&
    values.predictionMedian >= values.threshold;

/**
 * One row per district on alert, for the table under the risk map: the month
 * its median prediction peaks, that month's prediction and threshold, how far
 * the prediction runs above the threshold, and in how many of the forecast
 * months it does so.
 *
 * Ranked by that excess, so the districts expected furthest above threshold
 * lead. A district whose peak month carries no threshold has no excess to rank
 * by and sorts last, after the ones that do.
 */
export const buildDistrictAlertRows = ({
    dataValues = [],
    mapping = [],
    periods = [],
    orgUnits = [],
    selectedOrgUnitId,
    districts: explicitDistricts,
}) => {
    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnitId);
    const hasExplicitDistricts = Array.isArray(explicitDistricts);

    // An explicit set may come from a level-3 (DHO) selection, so the level gate
    // only applies when the districts have to be derived from the selection.
    if (!hasExplicitDistricts && ![1, 2].includes(Number(selectedUnit?.level))) return [];

    const malariaMapping = mapping.find((item) => /malaria/i.test(item?.displayName || ''));
    if (!malariaMapping || periods.length === 0) return [];

    const districts = hasExplicitDistricts
        ? explicitDistricts
        : getDistrictDescendants(orgUnits, selectedOrgUnitId);
    const rowsByDistrict = collectDistrictValues({
        districts,
        dataValues,
        malariaMapping,
        periods,
    });
    const unitsById = new Map(orgUnits.map((unit) => [unit.id, unit]));

    const rows = districts.flatMap((district) => {
        const months = periods.map(
            (period) => rowsByDistrict.get(district.id).get(period) || {}
        );

        if (!months.some((values) => values.alarm === 1)) return [];

        // The first month holding the highest prediction, so a plateau names
        // the month it starts in rather than the last month it reaches.
        const peakIndex = months.reduce(
            (best, values, index) =>
                Number.isFinite(values.predictionMedian) &&
                (best === -1 || values.predictionMedian > months[best].predictionMedian)
                    ? index
                    : best,
            -1
        );
        const peak = peakIndex === -1 ? {} : months[peakIndex];
        const median = Number.isFinite(peak.predictionMedian) ? peak.predictionMedian : null;
        const threshold = Number.isFinite(peak.threshold) ? peak.threshold : null;

        return [{
            id: district.id,
            name: district.displayName || district.name || district.id,
            region: unitsById.get(getParentId(district))?.displayName || null,
            peakPeriod: peakIndex === -1 ? null : periods[peakIndex],
            peakMedian: median,
            peakThreshold: threshold,
            excess: median !== null && threshold > 0
                ? Math.round(((median - threshold) / threshold) * 100)
                : null,
            monthsAbove: months.filter(isAboveThreshold).length,
            monthsTotal: periods.length,
        }];
    });

    const rank = (row) => (row.excess === null ? Number.NEGATIVE_INFINITY : row.excess);

    return rows.sort((left, right) =>
        rank(left) === rank(right)
            ? left.name.localeCompare(right.name)
            : rank(right) - rank(left)
    );
};

export const buildSelectedDistrictForecastRows = ({
    dataValues = [],
    mapping = [],
    periods = [],
    selectedOrgUnitId,
}) => {
    const malariaMapping = mapping.find((item) => /malaria/i.test(item?.displayName || ''));
    const valuesByPeriod = new Map(periods.map((period) => [period, {}]));

    if (!malariaMapping) return { rows: [], isConfigured: false };

    const elementFields = [
        ['threshold', malariaMapping.threshold],
        ['predictionLowerBound', malariaMapping.predictionLowerBound],
        ['predictionMedian', malariaMapping.predictionMedian],
        ['predictionUpperBound', malariaMapping.predictionUpperBound],
        ['alarm', malariaMapping.alarmElement],
    ];
    dataValues.forEach((row) => {
        const [dataElement, period, orgUnitId] = row;
        if (orgUnitId !== selectedOrgUnitId || !valuesByPeriod.has(period)) return;

        const field = elementFields.find(([, element]) => element && element === dataElement)?.[0];
        if (!field) return;

        const rawValue = row.at(-1);
        if (rawValue === '' || rawValue === null || rawValue === undefined) return;
        const value = Number(rawValue);
        if (Number.isFinite(value)) valuesByPeriod.get(period)[field] = value;
    });

    const rows = periods.map((period) => {
        const values = valuesByPeriod.get(period);
        const hasAlarm = values.alarm === 1;
        const isWatch = !hasAlarm &&
            values.threshold > 0 &&
            values.predictionMedian >= values.threshold * 0.75 &&
            values.predictionMedian < values.threshold;

        return {
            period,
            threshold: values.threshold ?? null,
            predictionLowerBound: values.predictionLowerBound ?? null,
            predictionMedian: values.predictionMedian ?? null,
            predictionUpperBound: values.predictionUpperBound ?? null,
            alarm: values.alarm ?? null,
            status: hasAlarm
                ? 'alert'
                : isWatch
                    ? 'watch'
                    : Object.values(values).some((value) => value !== undefined)
                        ? 'normal'
                        : 'unavailable',
        };
    });

    return {
        rows,
        isConfigured: Boolean(
            malariaMapping.alarmElement ||
            malariaMapping.threshold ||
            malariaMapping.predictionLowerBound ||
            malariaMapping.predictionMedian ||
            malariaMapping.predictionUpperBound
        ),
    };
};

/**
 * Whether a selection is one the regional view can be built for.
 *
 * The regional levels describe the zones of a country, or the districts of a
 * zone. A district selection has neither: it would be measured against itself,
 * and the row above it would come back empty and read as an outage. So the
 * national-and-zonal sections of the document are not rendered for one.
 *
 * A level that is not known — an organisation unit the client has not loaded,
 * or one that carries none — is not a district, and does not hide anything.
 */
export const hasRegionalRiskView = (orgUnits = [], selectedOrgUnitId) => {
    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnitId);
    const level = Number(selectedUnit?.level);

    return !Number.isFinite(level) || level <= 2;
};

export const getDistrictDescendants = (orgUnits = [], selectedOrgUnitId) => {
    const unitsById = new Map(orgUnits.map((unit) => [unit.id, unit]));
    const selectedUnit = unitsById.get(selectedOrgUnitId);

    if (![1, 2].includes(Number(selectedUnit?.level))) {
        return [];
    }

    return orgUnits.filter((unit) => {
        if (Number(unit.level) !== 3) return false;

        let parentId = getParentId(unit);
        const visited = new Set();

        while (parentId && !visited.has(parentId)) {
            if (parentId === selectedOrgUnitId) return true;
            visited.add(parentId);
            parentId = getParentId(unitsById.get(parentId));
        }

        return false;
    });
};

export const getZoneDescendants = (orgUnits = [], selectedOrgUnitId) => {
    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnitId);
    if (Number(selectedUnit?.level) !== 1) return [];

    return orgUnits.filter((unit) =>
        Number(unit.level) === 2 && getParentId(unit) === selectedOrgUnitId
    );
};

export const buildDistrictForecastStatuses = ({
    dataValues = [],
    mapping = [],
    periods = [],
    orgUnits = [],
    selectedOrgUnitId,
    districts: explicitDistricts,
}) => {
    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnitId);
    const hasExplicitDistricts = Array.isArray(explicitDistricts);

    // An explicit set may come from a level-3 (DHO) selection, so the level gate
    // only applies when the districts have to be derived from the selection.
    if (!hasExplicitDistricts && ![1, 2].includes(Number(selectedUnit?.level))) return null;

    const districts = hasExplicitDistricts
        ? explicitDistricts
        : getDistrictDescendants(orgUnits, selectedOrgUnitId);

    const malariaMapping = mapping.find((item) => /malaria/i.test(item.displayName || ''));

    if (!malariaMapping || periods.length === 0) {
        return {
            districts,
            alerts: [],
            watches: [],
            normal: districts.map((district) => ({
                id: district.id,
                name: district.displayName || district.name || district.id,
            })),
            // The map still needs a row per district per month, and every one
            // of them is unavailable rather than absent.
            forecastRowsByDistrict: new Map(districts.map((district) => [
                district.id,
                periods.map((period) => toForecastRow(period)),
            ])),
            isConfigured: false,
        };
    }

    const rowsByDistrict = collectDistrictValues({
        districts,
        dataValues,
        malariaMapping,
        periods,
    });

    const forecastRowsByDistrict = new Map(districts.map((district) => [
        district.id,
        periods.map((period) =>
            toForecastRow(period, rowsByDistrict.get(district.id).get(period) || {})
        ),
    ]));

    const alerts = [];
    const watches = [];

    districts.forEach((district) => {
        const districtPeriods = rowsByDistrict.get(district.id);
        const alarmPeriod = periods.find((period) => districtPeriods.get(period)?.alarm === 1);

        if (alarmPeriod) {
            const values = districtPeriods.get(alarmPeriod);
            alerts.push({
                id: district.id,
                name: district.displayName || district.name || district.id,
                period: alarmPeriod,
                predictionMedian: values.predictionMedian ?? null,
                threshold: values.threshold ?? null,
            });
            return;
        }

        const watchPeriod = periods.find((period) => {
            const values = districtPeriods.get(period);
            return values?.threshold > 0 &&
                values.predictionMedian >= values.threshold * 0.75 &&
                values.predictionMedian < values.threshold;
        });

        if (watchPeriod) {
            const values = districtPeriods.get(watchPeriod);
            watches.push({
                id: district.id,
                name: district.displayName || district.name || district.id,
                period: watchPeriod,
                predictionMedian: values.predictionMedian,
                threshold: values.threshold,
            });
        }
    });

    const classifiedDistrictIds = new Set([
        ...alerts.map((district) => district.id),
        ...watches.map((district) => district.id),
    ]);
    const normal = districts
        .filter((district) => !classifiedDistrictIds.has(district.id))
        .map((district) => ({
            id: district.id,
            name: district.displayName || district.name || district.id,
        }));

    const sortByName = (left, right) => left.name.localeCompare(right.name);
    alerts.sort(sortByName);
    watches.sort(sortByName);
    normal.sort(sortByName);

    return {
        districts,
        alerts,
        watches,
        normal,
        forecastRowsByDistrict,
        isConfigured: Boolean(
            malariaMapping.alarmElement ||
            (malariaMapping.threshold && malariaMapping.predictionMedian)
        ),
    };
};
