export const OrganisationUnitQuery = {
        results : {
            resource: 'organisationUnits',
            params: {
                paging: false,
                fields: ['id',"displayName",'name','level','children[id,name,level]'],
        }    
}
};
