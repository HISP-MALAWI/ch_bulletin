export const RolesQuery = {
    userRoles: {
        resource: 'userRoles',
        params: {
            paging: false,
            fields: ['id', 'displayName'],
        },
    },

    userGroups: {
        resource: 'userGroups',
        params: {
            paging: false,
            fields: ['id', 'displayName'],
        },
    },
};