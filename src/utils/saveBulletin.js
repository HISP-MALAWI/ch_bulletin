import crudMutation from '../Pages/services/engines/dataMutation';

const saveBulletinToDataStore = async (bulletin, engine) => {
    const namespace = 'CH_Bulletin';
    const key = 'draft_bulletin';
    const resource = `dataStore/${namespace}/${key}`;

    try {
        // Check if the key exists
        const dataStoreResponse = await engine.query({
            dataStore: { resource },
        });

        const existing = dataStoreResponse?.dataStore;
        const existingList = Array.isArray(existing) ? existing : [];
        const updatedList = [...existingList, bulletin];
        console.log('Existing list:', existingList);
        return await crudMutation(engine, updatedList, 'update', resource);

    } catch (error) {
        const status = error?.details?.httpStatusCode || error?.httpStatusCode;

        if (status === 404) {
            return await crudMutation(engine, [bulletin], 'create', resource);
        }

        console.error('Failed to save bulletin to data store:', error);
        throw error;
    }
};

export default saveBulletinToDataStore;