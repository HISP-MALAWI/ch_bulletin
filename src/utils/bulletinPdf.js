import i18n from '@dhis2/d2-i18n'

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const DEFAULT_MARGIN_MM = 10
const IMAGE_TIMEOUT_MS = 8000
const MAX_FILE_NAME_LENGTH = 120

// Space between the repeated masthead and the content beneath it on pages after
// the first.
const REPEAT_HEADER_GAP_MM = 6

// A 1x1 transparent GIF, used to stand in for images that cannot be captured.
const TRANSPARENT_PIXEL =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/**
 * Builds a filename-safe string from the given parts, joined with underscores.
 * Strips anything that is not alphanumeric, dot, underscore or dash, so that a
 * "/" or ":" in a DHIS2 display name cannot produce an invalid path.
 */
export const sanitiseFileName = (parts, { maxLength = MAX_FILE_NAME_LENGTH } = {}) => {
    const joined = (Array.isArray(parts) ? parts : [parts])
        .filter((part) => part !== null && part !== undefined && String(part).trim() !== '')
        .join('_')

    const cleaned = joined
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[._]+/, '')

    const trimmed = cleaned
        .slice(0, maxLength)
        .replace(/[._]+$/, '')

    return trimmed || 'bulletin'
}

/**
 * Splits a document of `totalHeightMm` into per-page slices of at most
 * `contentHeightMm`.
 *
 * A cut is placed at the last block boundary falling within the page, so pages
 * break between cards rather than through them; a block taller than a page
 * still cuts at the limit, since there is no alternative. Because the loop is
 * driven by `start < totalHeightMm` and every slice has a positive height, a
 * trailing empty page is impossible.
 *
 * `options.restHeightMm` narrows every page after the first, which is how a
 * running header is paid for: the masthead is already part of the flow on page
 * one, so only the later pages need the room reserved.
 *
 * @returns {Array<{start: number, height: number}>} slices in page order
 */
export const computePageSlices = (totalHeightMm, contentHeightMm, boundaries = [], options = {}) => {
    if (!(totalHeightMm > 0) || !(contentHeightMm > 0)) {
        return []
    }

    const restHeightMm = options.restHeightMm ?? contentHeightMm

    if (!(restHeightMm > 0)) {
        // Nothing could be laid out, and the loop below would never advance.
        return []
    }

    const cuts = boundaries
        .filter((value) => Number.isFinite(value) && value > 0 && value < totalHeightMm)
        .sort((a, b) => a - b)

    const slices = []
    let start = 0
    let pageIndex = 0

    while (start < totalHeightMm) {
        const limit = start + (pageIndex === 0 ? contentHeightMm : restHeightMm)

        if (limit >= totalHeightMm) {
            slices.push({ start, height: totalHeightMm - start })
            break
        }

        const boundary = cuts.filter((value) => value > start && value <= limit).pop()
        const end = boundary ?? limit

        slices.push({ start, height: end - start })
        start = end
        pageIndex += 1
    }

    return slices
}

/**
 * Loads an image over a CORS request and re-encodes it as a data URL.
 *
 * Deliberately an `<img>` and not `fetch`. The on-screen `<img>` that displays
 * the icon loads it without `crossorigin`, so the browser caches a response
 * carrying no `Access-Control-Allow-Origin`. A later `fetch` is served that
 * cached copy and fails the CORS check, even though the server does send the
 * header. An `<img crossorigin>` load forces a genuine CORS request instead,
 * and because it only resolves on success the drawn canvas is never tainted,
 * so `toDataURL` is safe.
 */
const loadAsDataUrl = (src, timeoutMs = IMAGE_TIMEOUT_MS) =>
    new Promise((resolve, reject) => {
        const image = new Image()
        let settled = false
        let timer = null

        const fail = (error) => {
            if (settled) {
                return
            }
            settled = true
            clearTimeout(timer)
            reject(error)
        }

        const succeed = (value) => {
            if (settled) {
                return
            }
            settled = true
            clearTimeout(timer)
            resolve(value)
        }

        timer = setTimeout(() => fail(new Error('Timed out loading image')), timeoutMs)

        image.crossOrigin = 'anonymous'
        image.onerror = () => fail(new Error('Image could not be loaded with CORS'))
        image.onload = () => {
            if (settled) {
                return
            }

            try {
                const canvas = document.createElement('canvas')
                canvas.width = image.naturalWidth || 1
                canvas.height = image.naturalHeight || 1
                canvas.getContext('2d').drawImage(image, 0, 0)
                succeed(canvas.toDataURL('image/png'))
            } catch (error) {
                fail(error)
            }
        }
        image.src = src
    })

const withCacheBuster = (src) =>
    `${src}${src.includes('?') ? '&' : '?'}_bulletin_pdf=${Date.now()}`

const toDataUrl = async (src) => {
    try {
        return await loadAsDataUrl(src)
    } catch (error) {
        // A cache entry stored without CORS headers is the likeliest cause, so
        // retry at a URL the cache has never seen before giving up.
        return await loadAsDataUrl(withCacheBuster(src))
    }
}

/**
 * Rewrites every `<img>` to point at an inlined data URL, returning a restore
 * function and the number of images left out.
 *
 * Inlining is what makes the capture reliable. A data URL is same-origin as far
 * as the canvas is concerned, so it can never taint it and `toDataURL()` can
 * never throw a SecurityError. It also takes html2canvas out of the image
 * loading business entirely, so a slow or CORS-refusing host can no longer
 * leave a blank icon with no explanation.
 *
 * An image that cannot be fetched keeps its box but draws nothing, so the
 * table layout survives a broken icon URL.
 */
const inlineImages = async (element) => {
    const images = Array.from(element.querySelectorAll('img'))

    if (images.length === 0) {
        return { restore: () => {}, dropped: 0 }
    }

    const replacements = await Promise.all(
        images.map(async (img) => {
            const src = img.currentSrc || img.getAttribute('src')

            if (!src || src.startsWith('data:')) {
                return src
            }

            try {
                return await toDataUrl(src)
            } catch (err) {
                console.warn('Bulletin PDF: could not include image', src, err)
                return null
            }
        })
    )

    const swapped = []
    let dropped = 0

    images.forEach((img, index) => {
        const replacement = replacements[index]
        const usable = typeof replacement === 'string' && replacement.startsWith('data:')

        swapped.push({
            img,
            src: img.getAttribute('src'),
            srcset: img.getAttribute('srcset'),
        })
        img.setAttribute('src', usable ? replacement : TRANSPARENT_PIXEL)
        img.removeAttribute('srcset')

        if (!usable) {
            dropped += 1
        }
    })

    return {
        dropped,
        restore: () =>
            swapped.forEach(({ img, src, srcset }) => {
                if (src === null) {
                    img.removeAttribute('src')
                } else {
                    img.setAttribute('src', src)
                }

                if (srcset === null) {
                    img.removeAttribute('srcset')
                } else {
                    img.setAttribute('srcset', srcset)
                }
            }),
    }
}

const waitForFonts = async () => {
    if (document.fonts?.ready) {
        await document.fonts.ready
    }
}

const waitForImages = async (element) => {
    const pending = Array.from(element.querySelectorAll('img'))
        .filter((img) => !img.complete)
        .map(
            (img) =>
                new Promise((resolve) => {
                    img.addEventListener('load', resolve, { once: true })
                    img.addEventListener('error', resolve, { once: true })
                })
        )

    if (pending.length === 0) {
        return
    }

    await Promise.race([
        Promise.all(pending),
        new Promise((resolve) => setTimeout(resolve, IMAGE_TIMEOUT_MS)),
    ])
}

/**
 * Reads the bottom edge of every outermost `[data-pdf-block]` element as a
 * distance in millimetres from the top of the captured area.
 *
 * Positions are taken as a fraction of the element's rendered height and scaled
 * by the captured height, so the result stays correct whatever pixel ratio
 * html2canvas used.
 *
 * Only outermost blocks count. A marker nested inside another one is ignored,
 * because cutting at a nested block's edge breaks its parent. That is not
 * hypothetical: the two-column grids put a marker on each column, and since the
 * columns differ in height, a cut at the shorter column's edge sliced through
 * the taller one mid-chart. Marking the grid instead fixes that particular case;
 * ignoring nested markers means the next one cannot recur.
 */
const readBlockBoundaries = (element, totalHeightMm) => {
    const rect = element.getBoundingClientRect()

    if (!rect.height) {
        return []
    }

    return Array.from(element.querySelectorAll('[data-pdf-block]'))
        .filter((node) => !node.parentElement?.closest('[data-pdf-block]'))
        .map(
            (node) => ((node.getBoundingClientRect().bottom - rect.top) / rect.height) * totalHeightMm
        )
}

/**
 * Locates one element within the captured area, in both millimetres and source
 * pixels, using the same fraction-of-the-render maths as the block boundaries so
 * the two stay consistent whatever pixel ratio html2canvas chose.
 */
const readRegion = (element, node, totalHeightMm, pxPerMm) => {
    const root = element.getBoundingClientRect()
    const rect = node.getBoundingClientRect()

    if (!root.height || !rect.height) {
        return null
    }

    const topMm = ((rect.top - root.top) / root.height) * totalHeightMm
    const heightMm = (rect.height / root.height) * totalHeightMm

    return {
        topMm,
        heightMm,
        topPx: Math.max(0, Math.round(topMm * pxPerMm)),
        heightPx: Math.max(1, Math.round(heightMm * pxPerMm)),
    }
}

/**
 * Cuts the running header out of the captured canvas so it can be drawn again on
 * every page. Taken from the existing capture rather than a second html2canvas
 * pass, so it is never out of step with the page it came from and costs nothing
 * extra to render.
 */
const captureRepeatedHeader = (element, source, totalHeightMm, pxPerMm, contentHeightMm) => {
    const node = element.querySelector('[data-pdf-masthead]')

    if (!node) {
        return null
    }

    const region = readRegion(element, node, totalHeightMm, pxPerMm)

    if (!region || !(region.heightMm > 0)) {
        return null
    }

    const repeatHeightMm = region.heightMm + REPEAT_HEADER_GAP_MM

    // A header that would leave no room for content is not worth repeating.
    if (repeatHeightMm >= contentHeightMm) {
        return null
    }

    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = region.heightPx

    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(
        source,
        0,
        region.topPx,
        source.width,
        region.heightPx,
        0,
        0,
        source.width,
        region.heightPx
    )

    const dataUrl = canvas.toDataURL('image/png')

    // Release the backing store; a full-width strip is still megabytes.
    canvas.width = 0
    canvas.height = 0

    return { dataUrl, heightMm: region.heightMm, repeatHeightMm }
}

/**
 * Draws one vertical slice of the captured canvas onto a fresh canvas of the
 * same width, so it can be placed in the PDF at an exact height.
 */
const renderSlice = (source, slice, pxPerMm) => {
    // Clamped so rounding can never leave a slice with no source pixels, which
    // would otherwise emit a near-blank page.
    const sourceY = Math.min(
        Math.max(0, Math.round(slice.start * pxPerMm)),
        source.height - 1
    )
    const height = Math.max(1, Math.min(Math.round(slice.height * pxPerMm), source.height - sourceY))

    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = height

    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(source, 0, sourceY, source.width, height, 0, 0, source.width, height)

    const dataUrl = canvas.toDataURL('image/png')
    const heightMm = height / pxPerMm

    // Release the backing store; a full-page canvas is several megabytes.
    canvas.width = 0
    canvas.height = 0

    return { dataUrl, heightMm }
}

/**
 * Renders `element` to a paginated A4 PDF and saves it.
 *
 * @returns {Promise<{droppedImages: number}>} how many images were left out
 */
export const exportBulletinPdf = async (element, { fileName, title } = {}) => {
    if (!element) {
        throw new Error(
            i18n.t('Nothing to export — the bulletin preview could not be found')
        )
    }

    // Loaded on demand so the PDF libraries stay out of the initial bundle.
    const [html2canvasModule, jsPdfModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
    ])
    const html2canvas = html2canvasModule.default ?? html2canvasModule
    const jsPDF = jsPdfModule.default ?? jsPdfModule

    const marginMm = DEFAULT_MARGIN_MM
    const contentWidthMm = A4_WIDTH_MM - marginMm * 2
    const contentHeightMm = A4_HEIGHT_MM - marginMm * 2

    const { dropped, restore } = await inlineImages(element)

    try {
        await waitForFonts()
        await waitForImages(element)

        const source = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            imageTimeout: IMAGE_TIMEOUT_MS,
            ignoreElements: (node) =>
                typeof node?.hasAttribute === 'function' &&
                node.hasAttribute('data-pdf-exclude'),
        })

        const pxPerMm = source.width / contentWidthMm
        const totalHeightMm = (source.height * contentWidthMm) / source.width
        const boundaries = readBlockBoundaries(element, totalHeightMm)
        const header = captureRepeatedHeader(element, source, totalHeightMm, pxPerMm, contentHeightMm)
        const slices = computePageSlices(
            totalHeightMm,
            contentHeightMm,
            boundaries,
            header ? { restHeightMm: contentHeightMm - header.repeatHeightMm } : {}
        )

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

        if (title) {
            pdf.setProperties({ title, creator: 'Climate & Health Bulletin' })
        }

        slices.forEach((slice, index) => {
            if (index > 0) {
                pdf.addPage()
            }

            const { dataUrl, heightMm } = renderSlice(source, slice, pxPerMm)

            // Page one already carries the masthead, because it is part of the
            // flow there; later pages get the copy cut out of the same capture.
            if (index > 0 && header) {
                pdf.addImage(header.dataUrl, 'PNG', marginMm, marginMm, contentWidthMm, header.heightMm)
                pdf.addImage(
                    dataUrl,
                    'PNG',
                    marginMm,
                    marginMm + header.repeatHeightMm,
                    contentWidthMm,
                    heightMm
                )
                return
            }

            pdf.addImage(dataUrl, 'PNG', marginMm, marginMm, contentWidthMm, heightMm)
        })

        pdf.save(fileName)
    } catch (err) {
        if (err?.name === 'SecurityError') {
            throw new Error(
                i18n.t(
                    'An image in this bulletin blocked the export. Check the disease icon URLs in Settings.'
                )
            )
        }

        throw err
    } finally {
        restore()
    }

    return { droppedImages: dropped }
}
