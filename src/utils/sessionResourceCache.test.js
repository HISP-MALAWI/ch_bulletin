import {
    clearSessionResourceCache,
    getSessionCachedResource,
    getSessionResourceCacheValue,
} from './sessionResourceCache';

describe('session resource cache', () => {
    const cacheKey = 'test:metadata';

    beforeEach(() => clearSessionResourceCache(cacheKey));

    it('shares in-flight requests and caches the successful result', async () => {
        let resolveRequest;
        const loader = jest.fn(() => new Promise((resolve) => {
            resolveRequest = resolve;
        }));

        const first = getSessionCachedResource(cacheKey, loader);
        const second = getSessionCachedResource(cacheKey, loader);
        await Promise.resolve();
        expect(loader).toHaveBeenCalledTimes(1);

        resolveRequest({ values: ['metadata'] });
        await expect(first).resolves.toEqual({ values: ['metadata'] });
        await expect(second).resolves.toEqual({ values: ['metadata'] });
        await expect(
            getSessionCachedResource(cacheKey, loader)
        ).resolves.toEqual({ values: ['metadata'] });
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('does not cache failed or undefined responses', async () => {
        const loader = jest
            .fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ values: ['retry'] });

        await expect(getSessionCachedResource(cacheKey, loader)).rejects.toThrow('offline');
        await expect(getSessionCachedResource(cacheKey, loader)).resolves.toBeUndefined();
        await expect(getSessionCachedResource(cacheKey, loader)).resolves.toEqual({
            values: ['retry'],
        });
        expect(loader).toHaveBeenCalledTimes(3);
    });

    it('does not let an invalidated in-flight request repopulate the cache', async () => {
        let resolveOldRequest;
        const oldRequest = getSessionCachedResource(
            cacheKey,
            () => new Promise((resolve) => {
                resolveOldRequest = resolve;
            })
        );

        clearSessionResourceCache(cacheKey);
        await expect(
            getSessionCachedResource(cacheKey, () => Promise.resolve('fresh'))
        ).resolves.toBe('fresh');
        resolveOldRequest('stale');
        await expect(oldRequest).resolves.toBe('stale');

        expect(getSessionResourceCacheValue(cacheKey)).toEqual({
            found: true,
            value: 'fresh',
        });
    });
});
