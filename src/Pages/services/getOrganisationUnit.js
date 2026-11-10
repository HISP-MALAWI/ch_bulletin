export const getOrganisationUnitQuery = {
  organisationUnits: {
    resource: "organisationUnits",
    id: ({ orgUnitId }) => orgUnitId,
    params: {
      fields: 'id,geometry',
    },
  },
};
