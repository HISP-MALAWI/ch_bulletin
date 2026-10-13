const getParentId = (unit) => unit?.parent?.id || unit?.parent || null;

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
}) => {
    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnitId);
    if (![1, 2].includes(Number(selectedUnit?.level))) return null;

    const districts = getDistrictDescendants(orgUnits, selectedOrgUnitId);

    const malariaMapping = mapping.find((item) => /malaria/i.test(item.displayName || ''));
    const periodSet = new Set(periods);

    if (!malariaMapping || periodSet.size === 0) {
        return {
            districts,
            alerts: [],
            watches: [],
            normal: districts.map((district) => ({
                id: district.id,
                name: district.displayName || district.name || district.id,
            })),
            forecastRowsByDistrict: new Map(districts.map((district) => [
                district.id,
                periods.map((period) => ({
                    period,
                    predictionMedian: null,
                    predictionLowerBound: null,
                    predictionUpperBound: null,
                    status: 'unavailable',
                })),
            ])),
            isConfigured: false,
        };
    }

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

    const forecastRowsByDistrict = new Map(districts.map((district) => [
        district.id,
        periods.map((period) => {
            const values = rowsByDistrict.get(district.id).get(period) || {};
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
        }),
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
