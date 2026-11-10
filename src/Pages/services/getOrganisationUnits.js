export const organisationUnitsQuery = {
    results: {
        resource: 'organisationUnits',
        params: {
            fields: ['id,displayName,level,parent[id,displayName,level]'],
            paging: false,
        },
    },
};

export const readOrganisationUnits = (data) => {
    const response = data?.results;
    const units = Array.isArray(response)
        ? response
        : response?.organisationUnits;
    return Array.isArray(units) ? units : [];
};
