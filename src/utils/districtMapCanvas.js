/**
 * The map inside the Maps plugin's iframe, as something the PDF export can
 * rasterise.
 *
 * html2canvas does render a same-origin iframe — it clones the frame's document
 * and draws it into the page — and it clones a WebGL canvas by drawing it into
 * a new one. When that clone comes back empty the export still counts it as a
 * success, so a bulletin would ship a blank map box with nothing raised and
 * nothing to detect afterwards. Reading the map's own canvas is instead a
 * question with a definite answer: either `toDataURL` hands back pixels, or we
 * know we have no map and can fall back to the drawing underneath.
 *
 * This is possible at all because maps-gl asks for its WebGL context with
 * `preserveDrawingBuffer: true` — without it the drawing buffer is cleared once
 * composited and the canvas reads back blank — and because MapLibre requests its
 * tiles with `crossOrigin: 'anonymous'`, which keeps the canvas untainted.
 */

const MAP_CANVAS_SELECTOR = 'canvas.maplibregl-canvas';
const HOST_ATTRIBUTE = '[data-pdf-plugin]';

const frameOf = (host) => host?.querySelector?.('iframe') || null;

/**
 * Looks inside a plugin frame: `{ state, doc }`, where state is one of
 * `missing` (no frame in the host yet), `empty` (no document yet — the frame is
 * still loading), `cross-origin` (the document is not ours to look at) or
 * `readable`.
 *
 * `empty` and `cross-origin` have to be told apart by anything waiting for a map
 * to appear. An empty frame is one worth waiting on; a cross-origin frame will
 * never become readable however long one waits — that is the dev server, where
 * the app runs on localhost and the plugin is served by the instance.
 */
export const readFrame = (host) => {
    const iframe = frameOf(host);
    if (!iframe) return { state: 'missing' };

    try {
        const doc = iframe.contentDocument;
        return doc ? { state: 'readable', doc } : { state: 'empty' };
    } catch (error) {
        return { state: 'cross-origin' };
    }
};

/**
 * The embedded maps in an element — its descendants, and the element itself if
 * it happens to be one. The export hands this the whole document, but a caller
 * holding a single map host should not get nothing back.
 */
const hostsOf = (element) => {
    if (!element?.querySelectorAll) return [];

    const found = Array.from(element.querySelectorAll(HOST_ATTRIBUTE));

    return element.matches?.(HOST_ATTRIBUTE) ? [element, ...found] : found;
};

/**
 * The map as a PNG data URL, or null when there is no map to read — no frame, a
 * frame that has not loaded, a frame that is not ours to read, or a canvas that
 * refuses to be exported.
 *
 * The canvas keeps its device-pixel backing store, so this is normally a little
 * more resolution than the box it is drawn in — which matters because the
 * document is rasterised at `scale: 2`.
 */
export const readFrameCanvas = (host) => {
    const { doc } = readFrame(host);
    if (!doc) return null;

    const canvas = doc.querySelector(MAP_CANVAS_SELECTOR) || doc.querySelector('canvas');
    if (!canvas || typeof canvas.toDataURL !== 'function') return null;

    try {
        return canvas.toDataURL('image/png');
    } catch (error) {
        // A tainted canvas reads back as a SecurityError.
        return null;
    }
};

/**
 * Stands an image of each embedded map in for its iframe, for the duration of
 * one capture. Returns how many map hosts were found, how many yielded an
 * image, and a function that puts the page back.
 *
 * Every frame is hidden whether or not it produced an image: left in the page
 * html2canvas re-renders it, and when the plugin's canvas inside it clones empty
 * that re-render is a blank box. With the frame out of the way a host that could
 * not be read uncovers the bulletin's own drawing, which is mounted underneath
 * for exactly this — a computed map on the page is worth more than an empty one,
 * and it is the same map a reader sees if the plugin never paints.
 *
 * The image is absolutely positioned, so it takes no space in the flow: the
 * viewport's height is fixed and must stay fixed, because `exportBulletinPdf`
 * measures page breaks from the live layout after the capture.
 */
export const swapMapCanvases = (element) => {
    const hosts = hostsOf(element);
    const restores = [];
    let captured = 0;

    hosts.forEach((host) => {
        const iframe = frameOf(host);
        if (!iframe) return;

        const dataUrl = readFrameCanvas(host);
        const previousDisplay = iframe.style.display;

        iframe.style.display = 'none';
        restores.push(() => {
            iframe.style.display = previousDisplay;
        });

        if (!dataUrl) return;

        const doc = host.ownerDocument || document;
        const image = doc.createElement('img');
        image.src = dataUrl;
        image.setAttribute('data-pdf-map-image', '');
        image.style.cssText = [
            'position:absolute',
            'inset:0',
            'width:100%',
            'height:100%',
            'object-fit:contain',
            'background:#ffffff',
        ].join(';');

        host.appendChild(image);
        restores.push(() => image.remove());
        captured += 1;
    });

    return {
        maps: hosts.length,
        captured,
        restore: () => {
            // Drained, so a second call (the export's `finally` after an early
            // failure) is a no-op rather than a double restore.
            while (restores.length) {
                restores.pop()();
            }
        },
    };
};
