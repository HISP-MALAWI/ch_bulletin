import React, {useEffect} from 'react';
import { OrganisationUnitTree } from '@dhis2/ui';

const OrgUnitTreeWidget = ({ loading, error, data }) => {
  const [root, setRoot] = React.useState();

  useEffect(() => {
    const orgUnits = data?.results?.organisationUnits
    const rootUnit = orgUnits?.find(unit => unit.level === 1);
    setRoot(rootUnit);
    console.log('OrgUnitTreeWidget data:', orgUnits);
  },[data])

  if(loading) return <p>Loading organizational units...</p>;
  if(error) return <p>Error loading organizational units: {error.message}</p>;
  if(root === undefined) return <p>No organizational units found.</p>;
  return (
    <div>
      loaded org units: {data?.organisationUnits?.length || 0}
        <OrganisationUnitTree
            displayName={"Organisation Units"}
            root={root}
            onUpdateSelection={(selected)=>{console.log('Selected org units:', selected)}}
        />
    </div>
  );
}
export default OrgUnitTreeWidget;