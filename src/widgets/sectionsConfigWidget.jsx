import React from 'react';
import i18n from '@dhis2/d2-i18n';
import { Checkbox } from '@dhis2/ui';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { SettingsSection } from './settingsSectionWidget';
import { groupRows, resolveSections } from '../utils/bulletinSections';

// The labels are literals inside these functions rather than data in
// `bulletinSections.js`, because the catalogue scanner cannot follow an
// `i18n.t` through a variable and would drop every one of them. Several repeat
// strings the document already uses, so existing translations carry over.
const LABELS = {
    malariaOverview: () => i18n.t('Malaria overview'),
    forecastSummary: () => i18n.t('Forecast summary cards'),
    // The id is `highlights` because that is what stored configs carry; the
    // section is the document's executive summary. See `bulletinSections.js`.
    highlights: () => i18n.t('Executive Summary'),
    currentMalariaSituation: () => i18n.t('Current Malaria Situation'),
    malariaForecast: () => i18n.t('Malaria Forecast'),
    historicalClimate: () => i18n.t('Historical climate and cases'),
    weatherForecast: () => i18n.t('Weather Forecast'),
    seasonalClimate: () => i18n.t('Seasonal climate'),
    districtRisk: () => i18n.t('District forecast risk'),
    districtActions: () => i18n.t('District actions'),
};

const labelFor = (id) => (LABELS[id] ? LABELS[id]() : id);

const moveButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    padding: 0,
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    background: '#fff',
    color: '#334155',
    cursor: 'pointer',
};

const MoveButton = ({ direction, label, disabled, onClick }) => {
    const Icon = direction === 'up' ? ArrowUpwardIcon : ArrowDownwardIcon;

    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            style={{
                ...moveButtonStyle,
                color: disabled ? '#cbd5e1' : moveButtonStyle.color,
                cursor: disabled ? 'default' : 'pointer',
            }}
        >
            <Icon fontSize="small" />
        </button>
    );
};

/**
 * The document's contents, in the order it reads: the sections it carries, in
 * the sequence they appear. The masthead and footer are not in the list because
 * they are not really sections — the export repeats the masthead at the top of
 * every page after the first, so moving or hiding it would break the running
 * header rather than reorder the document.
 *
 * Sections that share a line of the document are one entry here and move
 * together. Their visibility is separate, so hiding the seasonal climate chart
 * widens the weather forecast beside it instead of leaving a gap.
 */
export const SectionsConfigWidget = ({ styles, sections, setSections }) => {
    // Everything is read through `resolveSections`, so the list is complete and
    // in a known order even before the settings key exists — which it does not,
    // on any install that has not been saved since this was added.
    const resolved = resolveSections(sections);
    const rows = groupRows(resolved);

    const setOrder = (items) => {
        setSections(items.map(({ id, visible }) => ({ id, visible })));
    };

    const moveRow = (index, delta) => {
        const target = index + delta;

        if (target < 0 || target >= rows.length) {
            return;
        }

        const order = rows.map(({ items }) => items);
        [order[index], order[target]] = [order[target], order[index]];
        setOrder(order.flat());
    };

    const toggle = (id) => {
        setOrder(
            resolved.map((section) =>
                section.id === id ? { ...section, visible: !section.visible } : section
            )
        );
    };

    const hiddenCount = resolved.filter((section) => !section.visible).length;

    return (
        <SettingsSection
            step="5"
            title={i18n.t('Document Sections')}
            subtitle={i18n.t(
                'The sections the document carries, in the order it reads. The masthead and the footer are fixed.'
            )}
            pill={hiddenCount > 0 ? i18n.t('{{total}} hidden', { total: hiddenCount }) : null}
            styles={styles}
        >
            <div style={{ marginTop: '16px' }}>
                {rows.map(({ row, items }, index) => {
                    // A pair is one line of the document, so it is one entry in
                    // this list: it moves as a unit and nothing can be slipped
                    // between the two halves.
                    const anyVisible = items.some((section) => section.visible);

                    return (
                        <div
                            key={row || items[0].id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 12px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                marginBottom: '8px',
                                background: anyVisible ? '#fff' : '#f8fafc',
                            }}
                        >
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <MoveButton
                                    direction="up"
                                    label={i18n.t('Move {{section}} up', {
                                        section: labelFor(items[0].id),
                                    })}
                                    disabled={index === 0}
                                    onClick={() => moveRow(index, -1)}
                                />
                                <MoveButton
                                    direction="down"
                                    label={i18n.t('Move {{section}} down', {
                                        section: labelFor(items[0].id),
                                    })}
                                    disabled={index === rows.length - 1}
                                    onClick={() => moveRow(index, 1)}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {items.map((section) => (
                                    <Checkbox
                                        key={section.id}
                                        checked={section.visible}
                                        label={labelFor(section.id)}
                                        onChange={() => toggle(section.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </SettingsSection>
    );
};
