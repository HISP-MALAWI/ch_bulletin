import { clearDistrictBoundaryCache, getDistrictBoundaries } from './districtBoundaries';

const geometry = { type: 'Point', coordinates: [34, -13] };
const engineReturning = (organisationUnits) => ({
    query: jest.fn().mockResolvedValue({ boundaries: { organisationUnits } }),
});

beforeEach(() => {
    clearDistrictBoundaryCache();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('getDistrictBoundaries', () => {
    it('uses geometry the districts already carry rather than asking for it', async () => {
        const engine = engineReturning([]);

        await expect(
            getDistrictBoundaries([{ id: 'a', geometry }, { id: 'b', geometry }], engine)
        ).resolves.toEqual([{ id: 'a', geometry }, { id: 'b', geometry }]);

        // This is the editor's path: its own org unit query asked for geometry,
        // so the map costs it no request at all.
        expect(engine.query).not.toHaveBeenCalled();
    });

    it('fetches the boundaries when the districts do not carry them', async () => {
        const engine = engineReturning([{ id: 'a', displayName: 'Balaka-DHO', geometry }]);

        await expect(
            getDistrictBoundaries([{ id: 'a', displayName: 'Balaka-DHO' }], engine)
        ).resolves.toEqual([{ id: 'a', geometry }]);

        expect(engine.query).toHaveBeenCalledWith({
            boundaries: {
                resource: 'organisationUnits',
                params: {
                    filter: ['level:eq:3'],
                    fields: ['id,displayName,geometry'],
                    paging: false,
                },
            },
        });
    });

    it('fetches everything when only some districts carry geometry', async () => {
        const engine = engineReturning([{ id: 'a', geometry }, { id: 'b', geometry }]);

        await getDistrictBoundaries([{ id: 'a', geometry }, { id: 'b' }], engine);

        // Half from the caller and half from the server would be two sources of
        // truth in one drawing.
        expect(engine.query).toHaveBeenCalledTimes(1);
    });

    it('fetches once for the session, not once per preview', async () => {
        const engine = engineReturning([{ id: 'a', geometry }]);

        await getDistrictBoundaries([{ id: 'a' }], engine);
        await getDistrictBoundaries([{ id: 'a' }], engine);
        await getDistrictBoundaries([{ id: 'a' }], engine);

        expect(engine.query).toHaveBeenCalledTimes(1);
    });

    it('retries after a failure rather than remembering it', async () => {
        const failing = { query: jest.fn().mockRejectedValue(new Error('offline')) };

        await expect(getDistrictBoundaries([{ id: 'a' }], failing)).resolves.toEqual([]);
        await expect(getDistrictBoundaries([{ id: 'a' }], failing)).resolves.toEqual([]);

        // A network blip must not poison the rest of the session.
        expect(failing.query).toHaveBeenCalledTimes(2);
    });

    it('does not cache a response that is missing its list', async () => {
        const odd = { query: jest.fn().mockResolvedValue({ boundaries: {} }) };

        await expect(getDistrictBoundaries([{ id: 'a' }], odd)).resolves.toEqual([]);
        await getDistrictBoundaries([{ id: 'a' }], odd);

        expect(odd.query).toHaveBeenCalledTimes(2);
    });

    it('drops a boundary with no geometry rather than passing it on', async () => {
        const engine = engineReturning([
            { id: 'a', geometry },
            { id: 'b', geometry: null },
        ]);

        await expect(getDistrictBoundaries([{ id: 'a' }, { id: 'b' }], engine))
            .resolves.toEqual([{ id: 'a', geometry }]);
    });

    it('asks for nothing when there are no districts', async () => {
        const engine = engineReturning([{ id: 'a', geometry }]);

        await expect(getDistrictBoundaries([], engine)).resolves.toEqual([]);
        await expect(getDistrictBoundaries(undefined, engine)).resolves.toEqual([]);

        expect(engine.query).not.toHaveBeenCalled();
    });

    it('returns nothing rather than throwing when there is no engine', async () => {
        await expect(getDistrictBoundaries([{ id: 'a' }], undefined)).resolves.toEqual([]);
        await expect(getDistrictBoundaries([{ id: 'a' }], {})).resolves.toEqual([]);
    });

    it('forgets the boundaries when the cache is cleared', async () => {
        const engine = engineReturning([{ id: 'a', geometry }]);

        await getDistrictBoundaries([{ id: 'a' }], engine);
        clearDistrictBoundaryCache();
        await getDistrictBoundaries([{ id: 'a' }], engine);

        expect(engine.query).toHaveBeenCalledTimes(2);
    });
});
