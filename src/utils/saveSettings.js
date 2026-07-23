import crudMutation from '../Pages/services/engines/dataMutation';

const saveSettings = async (settings, dataStoreError, engine) => {
    if (!engine || typeof engine.mutate !== 'function') {
        console.error('saveSettings requires a valid data engine.');
        return;
    }

    const type = dataStoreError?.details?.httpStatusCode === 404 ? 'create' : 'update';
    const resource = 'dataStore/CH_Bulletin/settings';

    return await crudMutation(engine, settings, type, resource);
};

export default saveSettings;