import React from 'react';
import { Plugin } from '@dhis2/app-runtime/experimental';
import { readFrame, readFrameCanvas } from '../utils/districtMapCanvas';

/**
 * The DHIS2 map the author chose for this bulletin, drawn by the Maps app
 * itself.
 *
 * The plugin is handed nothing but the map's id, and fetches the map, its
 * basemap and its tiles the way the Dashboard does — so what lands in the
 * bulletin is the mapping the reader already knows rather than a redrawing of
 * it. Two consequences of that shape everything below.
 *
 * **The plugin has no error state.** Given a map it cannot read — one deleted
 * since the author chose it, one a reader has no access to — it spins a loader
 * for ever. Nothing here can tell "still loading" from "will never load" except
 * by watching for the map's own canvas, so the section watches, and after
 * `PAINT_TIMEOUT_MS` it stops waiting and lets the drawing underneath be the
 * map. The watcher keeps looking afterwards at a slower pace, because a plugin
 * that is merely slow on a mobile connection should still win when it arrives.
 *
 * **The frame is the one thing the export cannot read from the outside.**
 * `width` and `height` are passed as numbers rather than left to CSS, because
 * html2canvas reads an iframe's `width`/`height` *attributes*, where `100%`
 * parses as 100 px and is then stretched over the box. The width is measured
 * from the host rather than fixed, so the map is drawn at the size it is shown.
 */

/** How often the plugin is asked whether its map has painted yet. */
const PAINT_POLL_MS = 300;

/** The same question, asked rarely, once the section has given up waiting. */
const SLOW_POLL_MS = 3000;

/** How long the map is waited for before the drawing underneath takes over. */
const PAINT_TIMEOUT_MS = 8000;

/**
 * `loading` until the map is there, then `shown`; `drawing` once the wait has
 * run out and the section has fallen back to the map it computes itself.
 */
const DistrictRiskMapEmbed = ({ style, uid, height, deferMount = false, onStateChange }) => {
    const hostRef = React.useRef(null);
    const [width, setWidth] = React.useState(0);
    const [mounted, setMounted] = React.useState(!deferMount);
    const [painted, setPainted] = React.useState(false);
    const [unreadable, setUnreadable] = React.useState(false);
    const [timedOut, setTimedOut] = React.useState(false);

    // The plugin is sized from the box it is in, so the box is measured rather
    // than assumed: the section is a third of a row when districts are on alert
    // and the whole width when none are.
    React.useEffect(() => {
        const host = hostRef.current;
        if (!host) return undefined;

        const measure = () => setWidth(Math.round(host.getBoundingClientRect().width));
        measure();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measure);
            return () => window.removeEventListener('resize', measure);
        }

        const observer = new ResizeObserver(measure);
        observer.observe(host);

        return () => observer.disconnect();
    }, []);

    // The editor is a long form and the map is one section of it, so the Maps
    // app — a whole mapping library, fetched from the instance — is not loaded
    // until the section is close to being on screen. The preview mounts at once
    // instead: it is the page the PDF is exported from, and a map that exists
    // only once the author has scrolled to it would be missing from the export.
    React.useEffect(() => {
        if (mounted) return undefined;

        const host = hostRef.current;
        if (!host || typeof IntersectionObserver === 'undefined') {
            setMounted(true);
            return undefined;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) setMounted(true);
            },
            { rootMargin: '600px 0px' }
        );

        observer.observe(host);

        return () => observer.disconnect();
    }, [mounted]);

    React.useEffect(() => {
        if (!mounted || painted || unreadable) return undefined;

        const host = hostRef.current;
        if (!host) return undefined;

        let waited = 0;
        let timer = null;

        const look = () => {
            const { state } = readFrame(host);

            // A frame this app is not allowed to look inside — the dev server,
            // where the plugin is another origin. There is nothing to watch
            // for, so the map is taken to be there and the export is the part
            // that has to cope.
            if (state === 'cross-origin') {
                setUnreadable(true);
                return;
            }

            if (readFrameCanvas(host)) {
                setPainted(true);
                return;
            }

            waited += PAINT_POLL_MS;
            if (waited >= PAINT_TIMEOUT_MS) setTimedOut(true);

            timer = window.setTimeout(look, waited >= PAINT_TIMEOUT_MS ? SLOW_POLL_MS : PAINT_POLL_MS);
        };

        timer = window.setTimeout(look, PAINT_POLL_MS);

        return () => window.clearTimeout(timer);
    }, [mounted, painted, unreadable]);

    const showing = painted || unreadable;
    const state = showing ? 'shown' : timedOut ? 'drawing' : 'loading';

    // Memoised because the plugin memoises its props by comparing their values:
    // a fresh literal would count as a change and send the plugin a message on
    // every render.
    const visualization = React.useMemo(() => ({ id: uid }), [uid]);

    React.useEffect(() => {
        onStateChange?.(state);
    }, [state, onStateChange]);

    // Exactly one of these at a time, and they mean different things to the
    // export: a map still being waited for holds a download back, a map that is
    // there is the thing to capture, and a map that never arrived is not in the
    // page at all — the drawing underneath is.
    const exportAttribute =
        state === 'shown' ? { 'data-pdf-plugin': '' } : state === 'loading' ? { 'data-pdf-pending': '' } : {};

    return (
        <div
            ref={hostRef}
            className={`${style.districtRiskEmbed} ${state === 'shown' ? style.districtRiskEmbedShown : ''}`}
            aria-hidden={state === 'shown' ? undefined : 'true'}
            {...exportAttribute}
        >
            {mounted && width > 0 ? (
                <Plugin
                    pluginShortName="maps"
                    visualization={visualization}
                    width={width}
                    height={height}
                />
            ) : null}
        </div>
    );
};

export default DistrictRiskMapEmbed;
