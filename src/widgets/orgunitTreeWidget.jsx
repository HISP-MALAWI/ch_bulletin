import React from 'react';
import { OrganisationUnitTree } from '@dhis2/ui';

const OrgUnitTreeWidget = ({ loading, error, data, setSelectedOrgUnit }) => {
    const [selectedOrgPath, setSelectedOrgUnitPath] = React.useState(null);
    if (loading) {
        return <p>Loading organizational units...</p>;
    }

    if (error) {
        return <p>Error loading organizational units: {error.message}</p>;
    }

    const orgUnits = data?.results?.organisationUnits || [];

    // Find level 1 org unit
    const level1Unit = orgUnits.find(unit => unit.level === 1);

    const rootIds = level1Unit?.id ? [level1Unit.id] : [];

    if (rootIds.length === 0) {
        return <p>No root organizational unit found.</p>;
    }

    return (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            
            <OrganisationUnitTree
                roots={rootIds}
                initiallyExpanded={rootIds}
                selected={selectedOrgPath ? [selectedOrgPath] : []}
                onChange={(selected) => {
                    console.log('Selected org unit:', selected);
                    console.log('selectedOrgPath:', selected.path);
                    setSelectedOrgUnitPath(selected.path);
                    setSelectedOrgUnit(selected.id);
                }}
                singleSelection
            />
        </div>
    );
};

export default OrgUnitTreeWidget;