export const RolesQuery = {
    useRoles: {
        resource: 'userRoles',
        params: {
            paging: false,
            fields: ['id', 'displayName'],
        },
    },
};