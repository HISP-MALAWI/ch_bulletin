import { basemapAttribution, clearDistrictMapCache, getDistrictMap } from './districtMap';

const engineReturning = (map) => ({
    query: jest.fn().mockResolvedValue({ map }),
});

beforeEach(() => {
    clearDistrictMapCache();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('getDistrictMap', () => {
    it('reads the chosen map and names it', async () => {
        const engine = engineReturning({
            id: 'abc123',
            displayName: 'CCH - Rainfall forecast',
            basemap: 'osmLight',
        });

        await expect(getDistrictMap('abc123', engine)).resolves.toEqual({
            id: 'abc123',
            name: 'CCH - Rainfall forecast',
            attribution: '© OpenStreetMap contributors',
        });

        expect(engine.query).toHaveBeenCalledWith({
            map: {
                resource: 'maps/abc123',
                params: { fields: ['id,displayName,basemap'] },
            },
        });
    });

    it('falls back to the id when the map has no name', async () => {
        const engine = engineReturning({ id: 'abc123' });

        await expect(getDistrictMap('abc123', engine)).resolves.toEqual({
            id: 'abc123',
            name: 'abc123',
            attribution: null,
        });
    });

    it('reads each map once for the session', async () => {
        const engine = engineReturning({ id: 'abc123', displayName: 'Rainfall' });

        await getDistrictMap('abc123', engine);
        await getDistrictMap('abc123', engine);
        await getDistrictMap('abc123', engine);

        expect(engine.query).toHaveBeenCalledTimes(1);
    });

    it('reads a second map rather than answering the first one for it', async () => {
        const engine = {
            query: jest
                .fn()
                .mockResolvedValueOnce({ map: { id: 'one', displayName: 'One' } })
                .mockResolvedValueOnce({ map: { id: 'two', displayName: 'Two' } }),
        };

        await getDistrictMap('one', engine);
        await expect(getDistrictMap('two', engine)).resolves.toMatchObject({ id: 'two' });

        expect(engine.query).toHaveBeenCalledTimes(2);
    });

    it('retries after a failure rather than remembering it', async () => {
        const failing = { query: jest.fn().mockRejectedValue(new Error('403')) };

        await expect(getDistrictMap('abc123', failing)).resolves.toBeNull();
        await expect(getDistrictMap('abc123', failing)).resolves.toBeNull();

        // No access today must not mean no access for the rest of the session.
        expect(failing.query).toHaveBeenCalledTimes(2);
    });

    it('does not cache a response that is missing its map', async () => {
        const odd = { query: jest.fn().mockResolvedValue({ map: {} }) };

        await expect(getDistrictMap('abc123', odd)).resolves.toBeNull();
        await getDistrictMap('abc123', odd);

        expect(odd.query).toHaveBeenCalledTimes(2);
    });

    it('asks for nothing when no map is configured', async () => {
        const engine = engineReturning({ id: 'abc123' });

        await expect(getDistrictMap(undefined, engine)).resolves.toBeNull();
        await expect(getDistrictMap('', engine)).resolves.toBeNull();
        await expect(getDistrictMap(null, engine)).resolves.toBeNull();

        expect(engine.query).not.toHaveBeenCalled();
    });

    it('returns nothing rather than throwing when there is no engine', async () => {
        await expect(getDistrictMap('abc123', undefined)).resolves.toBeNull();
        await expect(getDistrictMap('abc123', {})).resolves.toBeNull();
    });

    it('forgets the map when the cache is cleared', async () => {
        const engine = engineReturning({ id: 'abc123', displayName: 'Rainfall' });

        await getDistrictMap('abc123', engine);
        clearDistrictMapCache();
        await getDistrictMap('abc123', engine);

        expect(engine.query).toHaveBeenCalledTimes(2);
    });
});

describe('basemapAttribution', () => {
    it('credits OpenStreetMap for the built-in basemaps', () => {
        expect(basemapAttribution('osmLight')).toBe('© OpenStreetMap contributors');
        expect(basemapAttribution('osmDetailed')).toBe('© OpenStreetMap contributors');
        expect(basemapAttribution('OSM')).toBe('© OpenStreetMap contributors');
    });

    it('claims nothing about a basemap it does not know', () => {
        // An instance can serve its own layers, whose terms live in metadata
        // this app never reads — better no credit than a wrong one.
        expect(basemapAttribution('elevation')).toBeNull();
        expect(basemapAttribution('')).toBeNull();
        expect(basemapAttribution(undefined)).toBeNull();
        expect(basemapAttribution(null)).toBeNull();
    });
});
