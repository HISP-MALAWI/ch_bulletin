import React from 'react';
import i18n from '@dhis2/d2-i18n';
import {
    MultiSelect,
    MultiSelectOption,
    SingleSelectField,
    SingleSelectOption,
} from '@dhis2/ui';
import {
    canonicalHighlightMode,
    resolveHighlightedDistricts,
} from '../utils/mapHighlight';

const getParentId = (unit) => unit?.parent?.id || unit?.parent || null;

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

/**
 * The author's choice of which districts the map colours.
 *
 * It is rendered only by the editor: the preview and the PDF receive the saved
 * choice and no callback, so the control never appears in the document.
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

    const districts = React.useMemo(() => {
        const zoneNames = new Map(
            orgUnits
                .filter((unit) => Number(unit.level) === 2)
                .map((unit) => [unit.id, unit.displayName || unit.name || unit.id])
        );

        return orgUnits
            .filter((unit) => Number(unit.level) === 3 && unit.id)
            .map((unit) => ({
                id: unit.id,
                name: unit.displayName || unit.name || unit.id,
                zone: zoneNames.get(getParentId(unit)) || '',
            }))
            .sort((left, right) => (
                left.zone === right.zone
                    ? left.name.localeCompare(right.name)
                    : left.zone.localeCompare(right.zone)
            ));
    }, [orgUnits]);

    // A saved id for a district this user cannot see is inert to the map; it
    // also has no option here, so it is left out of the selection count.
    const visibleIds = React.useMemo(
        () => districtIds.filter((id) => districts.some((district) => district.id === id)),
        [districtIds, districts]
    );

    const changeMode = (nextMode) => {
        if (!onChange) return;

        if (nextMode === 'manual' && districtIds.length === 0) {
            const own = resolveHighlightedDistricts({
                orgUnits,
                selectedOrgUnitId,
                highlight: { mode: 'own', districtIds: [] },
            });

            onChange({ mode: 'manual', districtIds: own.map((district) => district.id) });
            return;
        }

        onChange({ mode: nextMode, districtIds });
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
                    <MultiSelect
                        filterable
                        label={i18n.t('Districts')}
                        selected={visibleIds}
                        onChange={({ selected }) =>
                            onChange({ mode: 'manual', districtIds: selected })
                        }
                    >
                        {districts.map((district) => (
                            <MultiSelectOption
                                key={district.id}
                                value={district.id}
                                label={district.zone
                                    ? `${district.name} — ${district.zone}`
                                    : district.name}
                            />
                        ))}
                    </MultiSelect>
                    <p className={style.mapHighlightHint}>
                        {visibleIds.length === 0
                            ? i18n.t('No districts selected; the map shows the bulletin district.')
                            : i18n.t('{{total}} district(s) highlighted', { total: visibleIds.length })}
                    </p>
                </>
            )}

            <p className={style.mapHighlightHint}>
                {i18n.t('Changing the organisation unit resets this to that district.')}
            </p>
        </div>
    );
};

export default MapHighlightControl;
