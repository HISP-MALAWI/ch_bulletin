const getDataValues = async (data, period, organisationUnit, engine) => {
    if (!engine || typeof engine.query !== 'function') {
        console.error('getDataValues requires a valid DHIS2 engine with query().');
        return [];
    }

    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    const dxValues = data.flatMap((item) => {
        if (typeof item === 'string') {
            return [item];
        }

        return [item.dataElement, item.alarmElement].filter(Boolean);
    });

    const uniqueDxValues = Array.from(new Set(dxValues));

    if (uniqueDxValues.length === 0 || !period || !organisationUnit) {
        return [];
    }

    const dataValuesQuery = {
        analytics: {
        resource: 'analytics',
        params: {
            dimension: [
                `dx:${uniqueDxValues.join(';')}`,
                `pe:${period}`,
                `ou:${organisationUnit}`,
            ],
        },
    }
    };

    try {
        const response = await engine.query(dataValuesQuery);
        console.log('Fetched data values:', response);
        return response.rows;
    } catch (error) {
        console.error('Failed to fetch data values:', error);
        return [];
    }
};

export default getDataValues;