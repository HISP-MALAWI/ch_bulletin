import { buildDistrictForecastStatuses, getZoneDescendants } from './districtForecasts';

// One rule for every hazard, as the reference bulletin has it: a region is High
// once a certain share of its districts are on alert, Moderate once a smaller
// share is on alert or watch, and Low otherwise. Named rather than inlined so
// the two thresholds read as the rule they are.
export const HIGH_ALERT_SHARE = 0.3;
export const MODERATE_ALERT_OR_WATCH_SHARE = 0.25;

const levelFor = (alertShare, watchShare) => {
    if (alertShare >= HIGH_ALERT_SHARE) {
        return 'high';
    }

    if (alertShare + watchShare >= MODERATE_ALERT_OR_WATCH_SHARE) {
        return 'moderate';
    }

    return 'low';
};

const unitName = (unit) => unit?.displayName || unit?.name || unit?.id || '';

const parentIdOf = (unit) => unit?.parent?.id || unit?.parent || null;

// Whether the window holds a reading for even one district. A district with no
// row is not the same as a district that is fine, and the rule above cannot
// tell them apart: both come out normal. Drafts saved before the editor started
// fetching district-level values carry only national and zone rows, which would
// otherwise read as a country with nothing to report.
const hasDistrictReadings = (dataValues, districts, periods) => {
    const districtIds = new Set(districts.map((district) => district.id));
    const periodSet = new Set(periods);

    return dataValues.some((row) => districtIds.has(row[2]) && periodSet.has(row[1]));
};

/**
 * The risk level for each region, from the same district statuses the district
 * risk summary is built on — so the two cannot disagree about which districts
 * are on alert.
 *
 * A national selection covers every zone beneath it; a zone selection covers
 * itself; anything lower has no regions to report and comes back empty.
 *
 * `level` is null for a zone with no districts under it, because a region with
 * nothing to count is not the same as a region with nothing wrong. Read
 * `isConfigured` and `hasDistrictData` before showing any of this: with no alarm
 * indicator mapped, or with no district-level readings in the window, every
 * district classifies as normal, and an instance in either state would
 * otherwise publish a clean bill of health for the whole country.
 */
export const buildRegionalRisk = ({
    dataValues = [],
    mapping = [],
    periods = [],
    orgUnits = [],
    selectedOrgUnitId,
}) => {
    const status = buildDistrictForecastStatuses({
        dataValues,
        mapping,
        periods,
        orgUnits,
        selectedOrgUnitId,
    });

    if (!status) {
        return { regions: [], isConfigured: false, hasDistrictData: false };
    }

    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnitId);
    const zones = Number(selectedUnit?.level) === 1
        ? getZoneDescendants(orgUnits, selectedOrgUnitId)
        : selectedUnit
            ? [selectedUnit]
            : [];

    const districtsById = new Map(status.districts.map((district) => [district.id, district]));
    const inZone = (zoneId) => (district) => parentIdOf(districtsById.get(district.id)) === zoneId;

    const regions = zones.map((zone) => {
        const districts = status.districts.filter(inZone(zone.id));
        const alerts = status.alerts.filter(inZone(zone.id)).length;
        const watches = status.watches.filter(inZone(zone.id)).length;
        const total = districts.length;
        const alertShare = total ? alerts / total : 0;
        const watchShare = total ? watches / total : 0;

        return {
            id: zone.id,
            name: unitName(zone),
            level: total ? levelFor(alertShare, watchShare) : null,
            alerts,
            watches,
            districts: total,
            alertShare,
            watchShare,
        };
    });

    return {
        regions,
        isConfigured: status.isConfigured,
        hasDistrictData: hasDistrictReadings(dataValues, status.districts, periods),
    };
};
