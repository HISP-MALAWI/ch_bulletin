import { useDataQuery } from '@dhis2/app-runtime';

const dataQuery = (query) => {
    const {loading, error, data, refetch} = useDataQuery(query);
    return { loading, error, data, refetch };
};

export default dataQuery;