import { readFrame, readFrameCanvas, swapMapCanvases } from './districtMapCanvas';

const DATA_URL = 'data:image/png;base64,AAAA';

const mapCanvas = () => ({ toDataURL: jest.fn().mockReturnValue(DATA_URL) });

const docWith = (canvas) => ({
    querySelector: (selector) => (canvas && selector === 'canvas.maplibregl-canvas' ? canvas : null),
});

/**
 * A host holding a plugin iframe, with the frame's document stood in for.
 *
 * jsdom's own `toDataURL` needs a canvas implementation this project does not
 * install, so the frame is faked rather than rendered — the helper's job is
 * deciding what to do with what it finds, not drawing.
 */
const hostWith = (contentDocument) => {
    const host = document.createElement('div');
    const iframe = document.createElement('iframe');
    // The attribute the widget puts on the frame it is showing, which is what
    // the export looks for.
    host.setAttribute('data-pdf-plugin', '');
    host.appendChild(iframe);

    Object.defineProperty(iframe, 'contentDocument', {
        configurable: true,
        get:
            contentDocument === 'cross-origin'
                ? () => {
                      throw new Error('Blocked a frame with origin');
                  }
                : () => contentDocument ?? null,
    });

    return { host, iframe };
};

describe('readFrame', () => {
    it('reads the plugin frame', () => {
        const doc = docWith(mapCanvas());
        const { host } = hostWith(doc);

        expect(readFrame(host)).toEqual({ state: 'readable', doc });
    });

    it('tells a frame that has not loaded yet from one that never can be read', () => {
        // The dev server: the app on localhost, the plugin from the instance.
        // Everything waiting for a map has to tell these apart — the first is
        // worth waiting for, the second never becomes readable.
        expect(readFrame(hostWith('cross-origin').host).state).toBe('cross-origin');
        expect(readFrame(hostWith(null).host).state).toBe('empty');
        expect(readFrame(document.createElement('div')).state).toBe('missing');
        expect(readFrame(null).state).toBe('missing');
    });
});

describe('readFrameCanvas', () => {
    it('reads the map as a PNG', () => {
        const canvas = mapCanvas();
        const { host } = hostWith(docWith(canvas));

        expect(readFrameCanvas(host)).toBe(DATA_URL);
        expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
    });

    it('takes any canvas when the map has not drawn one yet', () => {
        const canvas = mapCanvas();
        const { host } = hostWith({ querySelector: (selector) => (selector === 'canvas' ? canvas : null) });

        expect(readFrameCanvas(host)).toBe(DATA_URL);
    });

    it('answers null when the canvas refuses to be read', () => {
        const tainted = {
            toDataURL: jest.fn(() => {
                throw new Error('Tainted canvas may not be exported');
            }),
        };
        const { host } = hostWith(docWith(tainted));

        expect(readFrameCanvas(host)).toBeNull();
    });

    it('answers null when there is no canvas in the frame', () => {
        const { host } = hostWith(docWith(null));

        expect(readFrameCanvas(host)).toBeNull();
    });

    it('answers null on a cross-origin frame', () => {
        const { host } = hostWith('cross-origin');

        expect(readFrameCanvas(host)).toBeNull();
    });
});

describe('swapMapCanvases', () => {
    it('stands an image of the map in for the frame', () => {
        const { host, iframe } = hostWith(docWith(mapCanvas()));

        const swap = swapMapCanvases(host);
        const image = host.querySelector('[data-pdf-map-image]');

        expect(swap.maps).toBe(1);
        expect(swap.captured).toBe(1);
        expect(iframe.style.display).toBe('none');
        expect(image).not.toBeNull();
        expect(image.src).toBe(DATA_URL);
        // Out of flow: the viewport's height is what the page breaks are
        // measured from and must not move during a capture.
        expect(image.style.position).toBe('absolute');
    });

    it('hides a frame it cannot read, leaving the drawing underneath showing', () => {
        const { host, iframe } = hostWith('cross-origin');

        const swap = swapMapCanvases(host);

        expect(swap.maps).toBe(1);
        expect(swap.captured).toBe(0);
        expect(iframe.style.display).toBe('none');
        expect(host.querySelector('[data-pdf-map-image]')).toBeNull();
    });

    it('counts each map rather than trusting the first', () => {
        const holder = document.createElement('div');
        const readable = hostWith(docWith(mapCanvas()));
        const unreadable = hostWith('cross-origin');
        [readable.host, unreadable.host].forEach((host) => holder.appendChild(host));

        const swap = swapMapCanvases(holder);

        expect(swap.maps).toBe(2);
        expect(swap.captured).toBe(1);
    });

    it('puts the page back, and again without complaint', () => {
        const { host, iframe } = hostWith(docWith(mapCanvas()));

        const swap = swapMapCanvases(host);
        swap.restore();

        expect(iframe.style.display).toBe('');
        expect(host.querySelector('[data-pdf-map-image]')).toBeNull();

        // The export calls this from a `finally` that can follow an early
        // failure, so it has to survive being reached twice.
        expect(() => swap.restore()).not.toThrow();
    });

    it('ignores a marked host with no frame in it', () => {
        const holder = document.createElement('div');
        const empty = document.createElement('div');
        empty.setAttribute('data-pdf-plugin', '');
        holder.appendChild(empty);

        const swap = swapMapCanvases(holder);

        expect(swap.maps).toBe(1);
        expect(swap.captured).toBe(0);
    });

    it('finds nothing on a page with no map in it', () => {
        expect(swapMapCanvases(document.createElement('div'))).toMatchObject({
            maps: 0,
            captured: 0,
        });
        expect(() => swapMapCanvases(null).restore()).not.toThrow();
    });
});
