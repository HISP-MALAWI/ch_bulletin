const cachedValues = new Map();
const inFlightRequests = new Map();
const cacheGenerations = new Map();

export const getSessionResourceCacheValue = (key) => ({
    found: cachedValues.has(key),
    value: cachedValues.get(key),
});

export const getSessionCachedResource = (key, loader) => {
    if (cachedValues.has(key)) return Promise.resolve(cachedValues.get(key));
    if (inFlightRequests.has(key)) return inFlightRequests.get(key);

    const generation = cacheGenerations.get(key) || 0;
    let request;
    request = Promise.resolve()
        .then(loader)
        .then((value) => {
            if (
                value !== undefined &&
                (cacheGenerations.get(key) || 0) === generation
            ) {
                cachedValues.set(key, value);
            }
            return value;
        })
        .finally(() => {
            if (inFlightRequests.get(key) === request) {
                inFlightRequests.delete(key);
            }
        });

    inFlightRequests.set(key, request);
    return request;
};

export const clearSessionResourceCache = (key) => {
    if (key !== undefined) {
        cacheGenerations.set(key, (cacheGenerations.get(key) || 0) + 1);
        cachedValues.delete(key);
        inFlightRequests.delete(key);
        return;
    }

    const keys = new Set([
        ...cachedValues.keys(),
        ...inFlightRequests.keys(),
        ...cacheGenerations.keys(),
    ]);
    keys.forEach((cacheKey) => {
        cacheGenerations.set(
            cacheKey,
            (cacheGenerations.get(cacheKey) || 0) + 1
        );
    });
    cachedValues.clear();
    inFlightRequests.clear();
};
