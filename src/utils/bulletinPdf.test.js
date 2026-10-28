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

    describe('with a running header', () => {
        // The masthead is part of page one's flow, so only later pages pay for
        // room to repeat it. 50mm of reserved header on a 277mm page leaves 227.
        it('leaves the first page full and shortens the rest', () => {
            expect(computePageSlices(600, 277, [], { restHeightMm: 227 })).toEqual([
                { start: 0, height: 277 },
                { start: 277, height: 227 },
                { start: 504, height: 96 },
            ])
        })

        it('still covers the document exactly, with no trailing empty page', () => {
            // 277 + 227 is an exact multiple of the two page heights.
            expect(computePageSlices(504, 277, [], { restHeightMm: 227 })).toEqual([
                { start: 0, height: 277 },
                { start: 277, height: 227 },
            ])
        })

        it('returns nothing rather than looping when no space would be left', () => {
            expect(computePageSlices(600, 277, [], { restHeightMm: 0 })).toEqual([])
            expect(computePageSlices(600, 277, [], { restHeightMm: -10 })).toEqual([])
        })
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

// The export reaches into a real DOM and two lazily imported libraries, so the
// capture is stood in for and the canvas methods, which jsdom does not
// implement, are stubbed. What is under test is the excluded sections: that they
// are out of the page while the capture runs, and back in it afterwards however
// the export ends.
describe('inlineMapTiles', () => {
    const makeMap = (hrefs) => {
        document.body.innerHTML = `
            <div id="root">
                <svg>
                    <g data-pdf-map-tiles>
                        ${hrefs.map((href) => `<image data-pdf-map-tile="" href="${href}"></image>`).join('')}
                    </g>
                    <path id="boundary" d="M0 0Z"></path>
                </svg>
            </div>`

        return document.getElementById('root')
    }

    it('rewrites every tile to a data URL and restores the originals', async () => {
        const { inlineMapTiles } = require('./bulletinPdf')
        const element = makeMap(['https://tiles/1.png', 'https://tiles/2.png'])

        const result = await inlineMapTiles(element, {
            load: async (href) => `data:image/png;base64,${href}`,
        })

        const tiles = element.querySelectorAll('[data-pdf-map-tile]')
        expect(tiles[0].getAttribute('href')).toBe('data:image/png;base64,https://tiles/1.png')
        expect(tiles[1].getAttribute('href')).toBe('data:image/png;base64,https://tiles/2.png')
        expect(result).toMatchObject({ inlined: 2, failed: 0, hidden: false })

        result.restore()
        expect(tiles[0].getAttribute('href')).toBe('https://tiles/1.png')
        expect(tiles[1].getAttribute('href')).toBe('https://tiles/2.png')
    })

    it('leaves tiles that are already data URLs alone', async () => {
        const { inlineMapTiles } = require('./bulletinPdf')
        const element = makeMap(['data:image/png;base64,already'])
        const load = jest.fn()

        const result = await inlineMapTiles(element, { load })

        expect(load).not.toHaveBeenCalled()
        expect(result).toMatchObject({ inlined: 0, failed: 0, hidden: false })
    })

    it('hides the whole basemap and reports it when one tile fails', async () => {
        const { inlineMapTiles } = require('./bulletinPdf')
        const element = makeMap(['https://tiles/1.png', 'https://tiles/2.png'])
        jest.spyOn(console, 'warn').mockImplementation(() => {})

        const result = await inlineMapTiles(element, {
            load: async (href) => {
                if (href.endsWith('2.png')) throw new Error('offline')
                return `data:image/png;base64,${href}`
            },
        })

        expect(result).toMatchObject({ failed: 2, hidden: true })
        // No partial inlining: the group goes and the hrefs are untouched.
        expect(element.querySelector('[data-pdf-map-tiles]').style.display).toBe('none')
        expect(element.querySelector('[data-pdf-map-tile]').getAttribute('href')).toBe(
            'https://tiles/1.png'
        )
        // The boundary paths are siblings and stay.
        expect(element.querySelector('#boundary')).not.toBeNull()

        result.restore()
        expect(element.querySelector('[data-pdf-map-tiles]').style.display).toBe('')
    })
})

describe('exportBulletinPdf', () => {
    const canvasContext = { fillRect: jest.fn(), drawImage: jest.fn() }
    let displayDuringCapture = null
    let pendingDuringCapture = null
    let tilesDuringCapture = null
    let captureError = null

    const buildDocument = ({ tiles = [] } = {}) => {
        document.body.innerHTML = `
            <div id="document">
                <div data-pdf-block id="forecast"></div>
                <div data-pdf-block data-pdf-exclude id="summary" style="display: block"></div>
                <div data-pdf-block id="map">
                    <svg>
                        <g data-pdf-map-tiles>
                            ${tiles.map((href) => `<image data-pdf-map-tile="" href="${href}"></image>`).join('')}
                        </g>
                        <path d="M0 0Z"></path>
                    </svg>
                </div>
                <div data-pdf-block id="actions"></div>
            </div>`

        return document.getElementById('document')
    }

    beforeAll(() => {
        HTMLCanvasElement.prototype.getContext = () => canvasContext
        HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,stub'
    })

    beforeEach(() => {
        jest.resetModules()
        displayDuringCapture = null
        pendingDuringCapture = null
        tilesDuringCapture = null
        captureError = null

        jest.doMock('html2canvas', () => ({
            __esModule: true,
            default: async (element) => {
                displayDuringCapture = element.querySelector('#summary').style.display
                pendingDuringCapture = element.querySelector('[data-pdf-pending]') !== null
                tilesDuringCapture = {
                    href: element.querySelector('[data-pdf-map-tile]')?.getAttribute('href') || null,
                    groupDisplay: element.querySelector('[data-pdf-map-tiles]')?.style.display || '',
                }

                if (captureError) {
                    throw captureError
                }

                return { width: 800, height: 1200 }
            },
        }))

        jest.doMock('jspdf', () => ({
            __esModule: true,
            default: class {
                setProperties() {}
                addPage() {}
                addImage() {}
                save = jest.fn()
            },
        }))
    })

    it('takes the excluded sections out of the page while capturing', async () => {
        const { exportBulletinPdf } = require('./bulletinPdf')

        await exportBulletinPdf(buildDocument(), { fileName: 'bulletin.pdf' })

        expect(displayDuringCapture).toBe('none')
    })

    it('puts them back afterwards, with whatever display they had', async () => {
        const { exportBulletinPdf } = require('./bulletinPdf')
        const element = buildDocument()

        await exportBulletinPdf(element, { fileName: 'bulletin.pdf' })

        expect(element.querySelector('#summary').style.display).toBe('block')
    })

    it('holds the capture back while a section is still loading', async () => {
        const { exportBulletinPdf } = require('./bulletinPdf')
        const element = buildDocument()
        const pending = document.createElement('div')
        pending.setAttribute('data-pdf-pending', '')
        element.appendChild(pending)

        // The district risk map's boundaries land just after the download is
        // clicked: the export must wait rather than capture the placeholder.
        setTimeout(() => pending.removeAttribute('data-pdf-pending'), 20)

        await exportBulletinPdf(element, { fileName: 'bulletin.pdf' })

        expect(pendingDuringCapture).toBe(false)
    })

    it('puts them back when the capture fails', async () => {
        const { exportBulletinPdf } = require('./bulletinPdf')
        const element = buildDocument()
        captureError = new Error('capture failed')

        await expect(
            exportBulletinPdf(element, { fileName: 'bulletin.pdf' })
        ).rejects.toThrow('capture failed')

        expect(element.querySelector('#summary').style.display).toBe('block')
    })

    it('inlines the basemap before capturing it', async () => {
        const { exportBulletinPdf } = require('./bulletinPdf')
        const element = buildDocument({ tiles: ['https://tiles/1.png'] })

        const result = await exportBulletinPdf(element, {
            fileName: 'bulletin.pdf',
            mapTileLoader: async (href) => `data:image/png;base64,${href}`,
        })

        expect(tilesDuringCapture.href).toBe('data:image/png;base64,https://tiles/1.png')
        expect(tilesDuringCapture.groupDisplay).toBe('')
        expect(result.mapTilesHidden).toBe(false)

        // Restored afterwards.
        expect(element.querySelector('[data-pdf-map-tile]').getAttribute('href')).toBe(
            'https://tiles/1.png'
        )
    })

    it('hides the basemap when a tile cannot be loaded and says so', async () => {
        const { exportBulletinPdf } = require('./bulletinPdf')
        const element = buildDocument({ tiles: ['https://tiles/1.png'] })
        jest.spyOn(console, 'warn').mockImplementation(() => {})

        const result = await exportBulletinPdf(element, {
            fileName: 'bulletin.pdf',
            mapTileLoader: async () => {
                throw new Error('offline')
            },
        })

        expect(tilesDuringCapture.groupDisplay).toBe('none')
        expect(result.mapTilesHidden).toBe(true)
        // The boundary paths are still in the capture.
        expect(element.querySelector('path')).not.toBeNull()
    })

    it('restores the tiles when the capture fails', async () => {
        const { exportBulletinPdf } = require('./bulletinPdf')
        const element = buildDocument({ tiles: ['https://tiles/1.png'] })
        captureError = new Error('capture failed')

        await expect(exportBulletinPdf(element, {
            fileName: 'bulletin.pdf',
            mapTileLoader: async (href) => `data:image/png;base64,${href}`,
        })).rejects.toThrow('capture failed')

        expect(element.querySelector('[data-pdf-map-tile]').getAttribute('href')).toBe(
            'https://tiles/1.png'
        )
    })
})
