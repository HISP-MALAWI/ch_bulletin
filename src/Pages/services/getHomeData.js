export const homeDataQuery = {
    dataStore: {
    resource: 'dataStore/CH_Bulletin/draft_bulletin',
    },
    me : {
        resource: 'me',
        params: {
            fields: 'id,displayName,organisationUnits[id,displayName,children[id,displayName]]',
        },
    },
    organisationUnits: {
        resource: 'organisationUnits',
        params: {
            fields: 'id,displayName,level,parent[id,displayName,level]',
            paging: false,
        },
    }
}