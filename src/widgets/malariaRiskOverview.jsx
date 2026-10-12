import React from 'react';
import i18n from '@dhis2/d2-i18n';
import { getMonthlyPeriods } from '../utils/getDataValues';
import { describeForecastWindow } from '../utils/periodLabel';
import { hasRegionalRiskView } from '../utils/districtForecasts';
import { buildRegionalRisk } from '../utils/regionalRisk';
import { getDiseaseOverview } from '../utils/diseaseOverviews';
import { palette } from '../theme/tokens';

// The three words the rule produces, with the colours the district risk map
// already uses for the same three states. Written as literals inside the
// function rather than a table at module scope, because the catalogue scanner
// cannot follow `i18n.t` through a variable.
const levelDisplay = () => ({
    high: { label: i18n.t('High'), colour: palette.alert },
    moderate: { label: i18n.t('Moderate'), colour: palette.maize },
    low: { label: i18n.t('Low'), colour: palette.leaf },
});

/**
 * The band that opens the bulletin: what the disease does, and where the risk
 * sits. Sits above the four scenario cards, which answer how much rather than
 * where.
 *
 * The regional levels are derived from the district forecast statuses, so a
 * mis-set alarm indicator would show every region as Low. When the mapping is
 * not configured the levels are withheld and the reader is told why, rather
 * than being told the country is fine.
 *
 * It is a national and zonal view, and a district bulletin is written for
 * someone who is already inside one region: the band would report the district
 * against itself, and with no districts beneath it the row above it would come
 * back as "no district-level readings", which reads as an outage. Below a zone
 * the section is not rendered at all — see `hasRegionalRiskView`.
 */
const MalariaRiskOverview = ({
    style,
    dataValues = [],
    mapping = [],
    period,
    orgUnits = [],
    selectedOrgUnit,
}) => {
    const forecastPeriods = React.useMemo(
        () => (period ? getMonthlyPeriods(period, 0, 3) : []),
        [period]
    );
    const malariaMapping = mapping.find((item) => /malaria/i.test(item?.displayName || ''));
    const { regions, isConfigured, hasDistrictData } = React.useMemo(
        () => buildRegionalRisk({
            dataValues,
            mapping,
            periods: forecastPeriods,
            orgUnits,
            selectedOrgUnitId: selectedOrgUnit,
        }),
        [dataValues, forecastPeriods, mapping, orgUnits, selectedOrgUnit]
    );
    const overview = getDiseaseOverview(malariaMapping?.displayName);

    if (
        !selectedOrgUnit ||
        !hasRegionalRiskView(orgUnits, selectedOrgUnit) ||
        !malariaMapping ||
        !overview
    ) {
        return null;
    }

    const forecastWindow = describeForecastWindow(period);
    // A zone with no districts under it has nothing to report, so it is left off
    // rather than shown as a level.
    const reporting = regions.filter((region) => region.districts > 0);
    // Both checks matter, and they fail differently: an unmapped alarm indicator
    // and a window with no district readings each make every district look
    // normal, so without them the band would announce a quiet country.
    const levelsAvailable = isConfigured && hasDistrictData;
    const levels = levelDisplay();

    return (
        <section className={style.malariaRiskOverview}>
            {forecastWindow.label && (
                <p className={style.malariaRiskEyebrow}>{forecastWindow.label}</p>
            )}
            <h2 className={style.malariaRiskTitle}>{malariaMapping.displayName}</h2>
            <p className={style.malariaRiskDescription}>{overview.description}</p>
            {levelsAvailable && reporting.length > 0 ? (
                <ul className={style.malariaRiskRegions}>
                    {reporting.map((region) => {
                        const display = levels[region.level];

                        return (
                            <li key={region.id} className={style.malariaRiskRegion}>
                                <span>{region.name}</span>
                                <span
                                    className={style.malariaRiskLevel}
                                    style={{ background: display.colour }}
                                >
                                    {display.label}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className={style.malariaRiskNote}>
                    {isConfigured
                        ? i18n.t('No district-level readings are available for this period, so the regional risk levels are not shown.')
                        : i18n.t('Regional risk levels need the malaria alarm and threshold indicators mapped in Settings.')}
                </p>
            )}
        </section>
    );
};

export default MalariaRiskOverview;
