export const OrganisationUnitQuery = {
        results : {
            resource: 'organisationUnits',
            params: {
                paging: false,
                fields: ['id,displayName,level,geometry,children[id,displayName,level],parent[id,displayName,level]'],
        }    
}
};
