import { computePageSlices, sanitiseFileName } from './bulletinPdf'

describe('computePageSlices', () => {
    it('covers the document exactly, with no trailing empty page', () => {
        // 554mm is an exact multiple of the 277mm content area. The previous
        // implementation emitted a blank third page here.
        const slices = computePageSlices(554, 277, [])

        expect(slices).toEqual([
            { start: 0, height: 277 },
            { start: 277, height: 277 },
        ])
    })

    it('gives the remainder its own page', () => {
        expect(computePageSlices(600, 277, [])).toEqual([
            { start: 0, height: 277 },
            { start: 277, height: 277 },
            { start: 554, height: 46 },
        ])
    })

    it('ends a page at the last block boundary that fits', () => {
        // A boundary at 250mm is the last one inside the first 277mm page, so
        // the first page stops there instead of cutting through the block.
        expect(computePageSlices(600, 277, [250])).toEqual([
            { start: 0, height: 250 },
            { start: 250, height: 277 },
            { start: 527, height: 73 },
        ])
    })

    it('ignores boundaries outside the document', () => {
        const withBoundaries = computePageSlices(600, 277, [0, -10, 600, 900])
        const without = computePageSlices(600, 277, [])

        expect(withBoundaries).toEqual(without)
    })

    it('defers a boundary that does not fit on the current page', () => {
        // 300mm is past the first page's 277mm limit, so page one still runs
        // full length rather than being cut short to reach it.
        expect(computePageSlices(600, 277, [300])).toEqual([
            { start: 0, height: 277 },
            { start: 277, height: 23 },
            { start: 300, height: 277 },
            { start: 577, height: 23 },
        ])
    })

    it('keeps a single page under the content height', () => {
        expect(computePageSlices(100, 277, [])).toEqual([{ start: 0, height: 100 }])
    })

    it('returns nothing for an empty or degenerate document', () => {
        expect(computePageSlices(0, 277, [])).toEqual([])
        expect(computePageSlices(100, 0, [])).toEqual([])
    })

    it('never emits an empty slice, whatever the height', () => {
        for (let height = 1; height <= 1200; height += 7) {
            const slices = computePageSlices(height, 277, [137, 411, 930])

            expect(slices.every((slice) => slice.height > 0)).toBe(true)
            expect(slices.reduce((total, slice) => total + slice.height, 0)).toBeCloseTo(
                height,
                6
            )
        }
    })
})

describe('sanitiseFileName', () => {
    it('strips characters that are unsafe in a path', () => {
        expect(sanitiseFileName(['Bulletin', 'August 2026', 'Lilongwe/Kanengo'])).toBe(
            'Bulletin_August_2026_Lilongwe_Kanengo'
        )

        expect(
            sanitiseFileName(['Bulletin', 'June 2026', 'Nkhata/Bay: Health Centre'])
        ).toBe('Bulletin_June_2026_Nkhata_Bay_Health_Centre')
    })

    it('skips empty parts', () => {
        expect(sanitiseFileName(['Bulletin', undefined, null, '', 'Lilongwe'])).toBe(
            'Bulletin_Lilongwe'
        )
    })

    it('falls back to a usable name when nothing survives', () => {
        expect(sanitiseFileName([])).toBe('bulletin')
        expect(sanitiseFileName(['///'])).toBe('bulletin')
    })

    it('caps the length and leaves no trailing separator', () => {
        const fileName = sanitiseFileName([`Bulletin ${'a'.repeat(400)}`])

        expect(fileName.length).toBeLessThanOrEqual(120)
        expect(fileName.endsWith('_')).toBe(false)
        expect(fileName.endsWith('.')).toBe(false)
    })
})
