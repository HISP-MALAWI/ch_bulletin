import React from 'react';
import i18n from '@dhis2/d2-i18n';
import {
    Checkbox,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui';
import {
    canonicalHighlightMode,
    groupDistrictsByZone,
    resolveHighlightedDistricts,
} from '../utils/mapHighlight';

const MODE_LABELS = (level) => {
    if (level === 3) {
        return [
            ['own', i18n.t('This district')],
            ['neighbours', i18n.t('Districts in the same zone')],
            ['all', i18n.t('All districts in Malawi')],
        ];
    }

    if (level === 2) {
        return [
            ['own', i18n.t('Districts in this zone')],
            ['all', i18n.t('All districts in Malawi')],
        ];
    }

    return [['own', i18n.t('All districts in Malawi')]];
};

const DistrictChecklist = ({ style, groups, selectedIds, describedBy, onToggle }) => {
    const groupId = React.useId();
    const labelId = `${groupId}-label`;

    return (
        <div
            className={style.mapHighlightChecklist}
            role="group"
            aria-labelledby={labelId}
            aria-describedby={describedBy}
        >
            <p id={labelId} className={style.mapHighlightChecklistLabel}>
                {i18n.t('Districts')}
            </p>
            {groups.map((group) => {
                const headingId = `${groupId}-${group.id}`;

                return (
                    <div
                        key={group.id}
                        className={style.mapHighlightZone}
                        role="group"
                        aria-labelledby={headingId}
                    >
                        <p id={headingId} className={style.mapHighlightZoneHeading}>
                            {group.name || i18n.t('Other')}
                        </p>
                        {group.districts.map((district) => (
                            <Checkbox
                                key={district.id}
                                dense
                                checked={selectedIds.has(district.id)}
                                label={district.name}
                                onChange={({ checked }) => onToggle(district.id, checked)}
                            />
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

/**
 * The author's choice of which districts the map colours.
 *
 * It is rendered only by the editor: the preview and the PDF receive the saved
 * choice and no callback, so the control never appears in the document. The
 * checklist is visible while "Choose districts" is selected, so every DHO can be
 * seen and an accidentally skipped one can be ticked back in.
 */
const MapHighlightControl = ({
    style,
    orgUnits = [],
    selectedOrgUnitId,
    highlight,
    onChange,
}) => {
    const selectedUnit = orgUnits.find((unit) => unit.id === selectedOrgUnitId);
    const level = Number(selectedUnit?.level);
    const mode = canonicalHighlightMode(highlight?.mode, level);
    const districtIds = Array.isArray(highlight?.districtIds)
        ? highlight.districtIds
        : [];
    const countId = React.useId();

    const groups = React.useMemo(
        () => groupDistrictsByZone(orgUnits),
        [orgUnits]
    );
    const districts = React.useMemo(
        () => groups.flatMap((group) => group.districts),
        [groups]
    );

    // A saved id for a district this user cannot see is inert to the map; it
    // also has no checkbox, so it is left out of the displayed selection.
    const visibleIds = React.useMemo(
        () => districtIds.filter((id) => districts.some((district) => district.id === id)),
        [districtIds, districts]
    );

    // A manual list whose districts are no longer visible falls back to `own`
    // in the resolver, so that is what the checklist must show. Otherwise the
    // ticks and the colours on the map would disagree.
    const resolvedIds = React.useMemo(() => {
        if (mode !== 'manual' || visibleIds.length > 0) return visibleIds;

        return resolveHighlightedDistricts({
            orgUnits,
            selectedOrgUnitId,
            highlight: { mode: 'own', districtIds: [] },
        })
            .map((district) => district.id)
            .filter((id) => districts.some((district) => district.id === id));
    }, [mode, visibleIds, orgUnits, selectedOrgUnitId, districts]);

    const selectedIds = React.useMemo(() => new Set(resolvedIds), [resolvedIds]);

    const changeMode = (nextMode) => {
        if (!onChange) return;

        if (nextMode === 'manual') {
            // Keep a manual list the author has already built; otherwise start
            // from what the map currently shows, so a DHO missing from a
            // zone/all highlight can simply be ticked back in.
            if (visibleIds.length > 0) {
                onChange({ mode: 'manual', districtIds });
                return;
            }

            const current = resolveHighlightedDistricts({
                orgUnits,
                selectedOrgUnitId,
                highlight: { mode, districtIds },
            });

            onChange({
                mode: 'manual',
                districtIds: current.map((district) => district.id),
            });
            return;
        }

        onChange({ mode: nextMode, districtIds });
    };

    const toggleDistrict = (id, checked) => {
        if (!onChange) return;

        // When the saved manual list has gone stale, the checklist is showing
        // the resolver's `own` fallback; start the new list from that rather
        // than from the stale ids, so unticking works.
        const baseIds = visibleIds.length > 0 ? districtIds : resolvedIds;
        const next = checked
            ? Array.from(new Set([...baseIds, id]))
            : baseIds.filter((districtId) => districtId !== id);

        onChange({ mode: 'manual', districtIds: next });
    };

    return (
        <div className={style.mapHighlightControl}>
            <SingleSelectField
                label={i18n.t('Highlight districts')}
                selected={mode}
                onChange={({ selected }) => changeMode(selected)}
            >
                {MODE_LABELS(level).map(([value, label]) => (
                    <SingleSelectOption key={value} value={value} label={label} />
                ))}
                <SingleSelectOption value="manual" label={i18n.t('Choose districts')} />
            </SingleSelectField>

            {mode === 'manual' && (
                <>
                    {districts.length === 0 ? (
                        <p className={style.mapHighlightHint}>
                            {i18n.t('No districts are available for this organisation unit.')}
                        </p>
                    ) : (
                        <>
                            <DistrictChecklist
                                style={style}
                                groups={groups}
                                selectedIds={selectedIds}
                                describedBy={countId}
                                onToggle={toggleDistrict}
                            />
                            <p id={countId} className={style.mapHighlightHint} aria-live="polite">
                                {i18n.t('{{total}} district(s) highlighted', {
                                    total: resolvedIds.length,
                                })}
                            </p>
                        </>
                    )}
                </>
            )}

            <p className={style.mapHighlightHint}>
                {i18n.t('Changing the organisation unit resets this to that district.')}
            </p>
        </div>
    );
};

export default MapHighlightControl;
