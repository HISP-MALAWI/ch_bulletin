import {
    clearDistrictBoundaryCache,
    getNationalDistrictBoundaries,
    readNationalBoundaries,
} from './districtBoundaries';

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

describe('readNationalBoundaries', () => {
    it('uses the geometry the organisation units already carry', () => {
        expect(readNationalBoundaries([
            { id: 'a', level: 3, displayName: 'Balaka-DHO', geometry },
            { id: 'b', level: 3, displayName: 'Dedza-DHO', geometry },
        ])).toEqual([
            { id: 'a', displayName: 'Balaka-DHO', geometry },
            { id: 'b', displayName: 'Dedza-DHO', geometry },
        ]);
    });

    it('takes level 3 only, and only units with an id', () => {
        expect(readNationalBoundaries([
            { id: 'country', level: 1, geometry },
            { id: 'zone', level: 2, geometry },
            { id: 'facility', level: 4, geometry },
            { level: 3, geometry },
            { id: 'district', level: 3, geometry },
        ])).toEqual([{ id: 'district', displayName: undefined, geometry }]);
    });

    it('is null when there is no level-3 list or any unit is missing its geometry', () => {
        expect(readNationalBoundaries([])).toBeNull();
        expect(readNationalBoundaries([
            { id: 'a', level: 3, geometry },
            { id: 'b', level: 3 },
        ])).toBeNull();
    });
});

describe('getNationalDistrictBoundaries', () => {
    it('fetches the whole national list once', async () => {
        const engine = engineReturning([
            { id: 'a', displayName: 'Balaka-DHO', geometry },
            { id: 'b', displayName: 'Dedza-DHO', geometry },
        ]);

        await expect(getNationalDistrictBoundaries(engine)).resolves.toEqual({
            boundaries: [
                { id: 'a', displayName: 'Balaka-DHO', geometry },
                { id: 'b', displayName: 'Dedza-DHO', geometry },
            ],
            error: null,
        });

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

    it('serves later calls from the session cache', async () => {
        const engine = engineReturning([{ id: 'a', geometry }]);

        await getNationalDistrictBoundaries(engine);
        await getNationalDistrictBoundaries(engine);
        await getNationalDistrictBoundaries(engine);

        expect(engine.query).toHaveBeenCalledTimes(1);
    });

    it('drops a unit with no geometry rather than passing it on', async () => {
        const engine = engineReturning([
            { id: 'a', geometry },
            { id: 'b', geometry: null },
        ]);

        await expect(getNationalDistrictBoundaries(engine)).resolves.toEqual({
            boundaries: [{ id: 'a', displayName: undefined, geometry }],
            error: null,
        });
    });

    it('reports a failure and retries next time rather than caching it', async () => {
        const failing = { query: jest.fn().mockRejectedValue(new Error('offline')) };

        const first = await getNationalDistrictBoundaries(failing);
        const second = await getNationalDistrictBoundaries(failing);

        expect(first.boundaries).toEqual([]);
        expect(first.error).toBeInstanceOf(Error);
        expect(second.boundaries).toEqual([]);
        expect(second.error).toBeInstanceOf(Error);

        // A network blip must not poison the rest of the session.
        expect(failing.query).toHaveBeenCalledTimes(2);
    });

    it('does not cache a response that is missing its list', async () => {
        const odd = { query: jest.fn().mockResolvedValue({ boundaries: {} }) };

        const first = await getNationalDistrictBoundaries(odd);
        await getNationalDistrictBoundaries(odd);

        expect(first.boundaries).toEqual([]);
        expect(first.error).toBeInstanceOf(Error);
        expect(odd.query).toHaveBeenCalledTimes(2);
    });

    it('caches a real empty answer', async () => {
        const engine = engineReturning([]);

        await getNationalDistrictBoundaries(engine);
        await getNationalDistrictBoundaries(engine);

        expect(engine.query).toHaveBeenCalledTimes(1);
    });

    it('returns nothing rather than throwing when there is no engine', async () => {
        await expect(getNationalDistrictBoundaries(undefined)).resolves.toEqual({
            boundaries: [],
            error: null,
        });
        await expect(getNationalDistrictBoundaries({})).resolves.toEqual({
            boundaries: [],
            error: null,
        });
    });

    it('forgets the boundaries when the cache is cleared', async () => {
        const engine = engineReturning([{ id: 'a', geometry }]);

        await getNationalDistrictBoundaries(engine);
        clearDistrictBoundaryCache();
        await getNationalDistrictBoundaries(engine);

        expect(engine.query).toHaveBeenCalledTimes(2);
    });
});
