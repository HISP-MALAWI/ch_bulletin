import { useDataQuery } from '@dhis2/app-runtime';

const dataQuery = (query) => {
    const {loading, error, data} = useDataQuery(query);
    return { loading, error, data };
};

export default dataQuery;