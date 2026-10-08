// A bulletin's status is what its record says, or draft when it says nothing:
// records written before the field existed are drafts, and comparing the raw
// value against a status would drop them from both lists rather than from one.
export const bulletinStatus = (bulletin) => bulletin?.status || 'draft';

export const isPublished = (bulletin) => bulletinStatus(bulletin) === 'published';

/**
 * The store appends — a new bulletin is pushed onto the end of the array and an
 * existing one is replaced where it already sits — so the array runs oldest to
 * newest and reversing it puts the most recently added bulletin at the top.
 * Editing a bulletin does not move it, because it was not added again.
 */
// Reversed on a copy: the array is the one the query returned, and reversing it
// in place would reorder the fetched data under everything else reading it.
const newestFirst = (bulletins) =>
    [...(Array.isArray(bulletins) ? bulletins : [])].reverse();

/**
 * The bulletins still being worked on, newest first. This is everything that
 * has not been published rather than everything whose status reads "draft": the
 * archive is the published set, and a record carrying a status this version
 * does not know about is still someone's work in hand. Asking for drafts by
 * name would hide such a record from both lists at once.
 */
export const selectDraftBulletins = (bulletins) =>
    newestFirst(bulletins).filter((bulletin) => !isPublished(bulletin));

/**
 * The archive: the bulletins that have been published, newest first.
 */
export const selectPublishedBulletins = (bulletins) =>
    newestFirst(bulletins).filter(isPublished);
