import {
    bulletinStatus,
    isPublished,
    selectDraftBulletins,
    selectPublishedBulletins,
} from './bulletinList';

const bulletins = [
    { id: 'oldest', status: 'draft' },
    { id: 'published-1', status: 'published' },
    { id: 'middle', status: 'draft' },
    { id: 'published-2', status: 'published' },
    { id: 'newest', status: 'draft' },
];

describe('bulletinStatus', () => {
    it('reads a record with no status as a draft', () => {
        expect(bulletinStatus({ id: 'legacy' })).toBe('draft');
        expect(bulletinStatus({ id: 'published', status: 'published' })).toBe('published');
        expect(bulletinStatus(undefined)).toBe('draft');
    });
});

describe('the two lists', () => {
    it('splits the records by status, most recently added first', () => {
        expect(selectDraftBulletins(bulletins).map(({ id }) => id))
            .toEqual(['newest', 'middle', 'oldest']);
        expect(selectPublishedBulletins(bulletins).map(({ id }) => id))
            .toEqual(['published-2', 'published-1']);
    });

    it('keeps a record with no status, whose drafts on one side and the archive on the other', () => {
        const legacy = [{ id: 'legacy' }];
        expect(selectDraftBulletins(legacy).map(({ id }) => id)).toEqual(['legacy']);
        expect(selectPublishedBulletins(legacy)).toEqual([]);
        expect(isPublished(legacy[0])).toBe(false);
    });

    it('keeps a record whose status is one this version does not know, rather than showing it nowhere', () => {
        const submitted = [{ id: 'submitted', status: 'submitted' }];
        expect(selectDraftBulletins(submitted).map(({ id }) => id)).toEqual(['submitted']);
        expect(selectPublishedBulletins(submitted)).toEqual([]);
    });

    it('leaves the fetched list in the order it arrived in', () => {
        const stored = [...bulletins];
        selectDraftBulletins(stored);
        expect(stored.map(({ id }) => id)).toEqual(bulletins.map(({ id }) => id));
    });

    it('returns nothing when the store holds no list', () => {
        expect(selectDraftBulletins(undefined)).toEqual([]);
        expect(selectPublishedBulletins({})).toEqual([]);
    });
});
