import React from 'react';
import { buildDistrictActions } from '../utils/districtActions';

const DistrictActionsWidget = ({
    style,
    forecast,
    seasonalClimateRows,
    dataValues,
    mapping,
    period,
    selectedOrgUnitId,
    orgUnits,
}) => {
    const actionGroups = React.useMemo(
        () => buildDistrictActions({
            forecast,
            seasonalClimateRows,
            dataValues,
            mapping,
            period,
            selectedOrgUnitId,
            orgUnits,
        }),
        [forecast, seasonalClimateRows, dataValues, mapping, period, selectedOrgUnitId, orgUnits]
    );

    return (
        <section className={style.districtActionsGrid} aria-label="District health actions">
            {actionGroups.map(({ title, variant, actions }) => (
                <article
                    className={`${style.districtActionCard} ${style[`districtAction${variant[0].toUpperCase()}${variant.slice(1)}`]}`}
                    key={variant}
                >
                    <h2>{title}</h2>
                    <ul>
                        {actions.map((action) => <li key={action}>{action}</li>)}
                    </ul>
                </article>
            ))}
        </section>
    );
};

export default DistrictActionsWidget;
