import { getDistrictDescendants } from './districtForecasts';

export const MAP_HIGHLIGHT_MODES = ['own', 'neighbours', 'all', 'manual'];

export const DEFAULT_MAP_HIGHLIGHT = { mode: 'own', districtIds: [] };

const getParentId = (unit) => unit?.parent?.id || unit?.parent || null;

const isLevelThree = (unit) => Number(unit?.level) === 3 && Boolean(unit?.id);

/**
 * A saved highlight as the rest of the app reads it.
 *
 * An unknown mode is `own` rather than absent, and ids are de-duplicated. Stale
 * ids are deliberately kept: the resolver intersects them with the districts it
 * can actually see, so a district that comes back later is still selected, and
 * an empty organisation-unit list at save time cannot wipe the author's manual
 * choice.
 */
export const normaliseMapHighlight = (highlight) => {
    const mode = MAP_HIGHLIGHT_MODES.includes(highlight?.mode)
        ? highlight.mode
        : DEFAULT_MAP_HIGHLIGHT.mode;
    const districtIds = Array.isArray(highlight?.districtIds)
        ? Array.from(new Set(
            highlight.districtIds.filter((id) => typeof id === 'string' && id)
        ))
        : [];

    return { mode, districtIds };
};

/**
 * The mode the control should show for a given level.
 *
 * The available choices depend on what the bulletin is for: a national bulletin
 * has no meaningful "neighbouring", and "all districts" is just its own set. A
 * saved mode that is not offered would otherwise leave the select blank, so it
 * displays as the equivalent mode that is offered.
 */
export const canonicalHighlightMode = (mode, level) => {
    const normalised = normaliseMapHighlight({ mode }).mode;
    const numericLevel = Number(level);

    if (normalised === 'neighbours' && numericLevel !== 3) return 'own';
    if (normalised === 'all' && numericLevel === 1) return 'own';

    return normalised;
};

/**
 * The other districts in a DHO's zone, including the DHO itself.
 *
 * A district without a parent has no peers to find; returning the district alone
 * is safer than treating every parentless unit as its neighbour.
 */
export const getSameZoneDistricts = (orgUnits = [], districtId) => {
    const district = orgUnits.find((unit) => unit.id === districtId);
    if (!district) return [];

    const parentId = getParentId(district);
    if (!parentId) return [district];

    return orgUnits.filter((unit) =>
        isLevelThree(unit) && getParentId(unit) === parentId
    );
};

/**
 * The level-3 unit a deeper selection belongs to, or null.
 */
export const findLevelThreeAncestor = (orgUnits = [], unitId) => {
    const unitsById = new Map(orgUnits.map((unit) => [unit.id, unit]));
    const visited = new Set();
    let unit = unitsById.get(unitId);

    while (unit && !visited.has(unit.id)) {
        if (Number(unit.level) === 3) return unit;

        visited.add(unit.id);
        unit = unitsById.get(getParentId(unit));
    }

    return null;
};

/**
 * The level-3 units grouped by their level-2 parent, for the editor's checklist.
 *
 * Every level-3 unit is kept — the map draws the hospital Point units too — and
 * a unit without a parent lands in an "Other" group rather than vanishing.
 * Groups and their districts are sorted by name so the list is stable as the
 * author ticks and unticks.
 */
export const groupDistrictsByZone = (orgUnits = []) => {
    const zoneNames = new Map(
        orgUnits
            .filter((unit) => Number(unit?.level) === 2 && unit?.id)
            .map((unit) => [unit.id, unit.displayName || unit.name || unit.id])
    );
    const groups = new Map();

    orgUnits.filter(isLevelThree).forEach((unit) => {
        const parentId = getParentId(unit);
        // Unknown parents all share one "Other" group; using the raw parent id
        // would produce several groups with the same heading.
        const groupId = zoneNames.has(parentId) ? parentId : 'ungrouped';

        if (!groups.has(groupId)) {
            groups.set(groupId, {
                id: groupId,
                name: zoneNames.get(groupId) || '',
                districts: [],
            });
        }

        groups.get(groupId).districts.push({
            id: unit.id,
            name: unit.displayName || unit.name || unit.id,
        });
    });

    return Array.from(groups.values())
        .map((group) => ({
            ...group,
            districts: group.districts.sort(
                (left, right) => left.name.localeCompare(right.name)
            ),
        }))
        // A district without a zone is drawn last, under the control's "Other"
        // heading, rather than before every named zone.
        .sort((left, right) => {
            if (!left.name) return right.name ? 1 : 0;
            if (!right.name) return -1;
            return left.name.localeCompare(right.name);
        });
};

const ownDistricts = ({ orgUnits, selectedOrgUnitId, selectedUnit, level }) => {
    if (!selectedUnit) return [];

    if (level === 1) return orgUnits.filter(isLevelThree);
    if (level === 2) return getDistrictDescendants(orgUnits, selectedOrgUnitId);
    if (level === 3) return [selectedUnit];
    if (level > 3) {
        const ancestor = findLevelThreeAncestor(orgUnits, selectedOrgUnitId);
        return ancestor ? [ancestor] : [];
    }

    return [];
};

/**
 * The districts the map should colour.
 *
 * The map always draws the whole country; this is the set that is coloured by
 * risk, with everything else grey. `own` reproduces the old selection-derived
 * behaviour, `neighbours` is the same-zone set around a DHO, `all` is the whole
 * country, and `manual` is the author's list intersected with the level-3 units
 * that are actually visible.
 */
export const resolveHighlightedDistricts = ({
    orgUnits = [],
    selectedOrgUnitId,
    highlight,
}) => {
    const config = normaliseMapHighlight(highlight);
    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnitId);
    const level = Number(selectedUnit?.level);
    const own = ownDistricts({ orgUnits, selectedOrgUnitId, selectedUnit, level });

    if (config.mode === 'all') {
        return orgUnits.filter(isLevelThree);
    }

    if (config.mode === 'manual') {
        const chosen = orgUnits.filter((unit) =>
            isLevelThree(unit) && config.districtIds.includes(unit.id)
        );
        return chosen.length > 0 ? chosen : own;
    }

    if (config.mode === 'neighbours') {
        if (level === 3) {
            const peers = getSameZoneDistricts(orgUnits, selectedOrgUnitId);
            return peers.length > 0 ? peers : own;
        }

        if (level > 3) {
            const ancestor = findLevelThreeAncestor(orgUnits, selectedOrgUnitId);
            const peers = ancestor ? getSameZoneDistricts(orgUnits, ancestor.id) : [];
            return peers.length > 0 ? peers : own;
        }
    }

    return own;
};
