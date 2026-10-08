/**
 * One saved map, read before it is embedded.
 *
 * This is not what draws the map — the plugin fetches the map it is told to,
 * basemap and all. It answers the two questions the plugin cannot: whether this
 * reader can open that map at all, and what it is called, so the section can
 * name it under the drawing.
 *
 * The answer matters because the plugin has no error state. Given a map it
 * cannot read it spins a loader for ever, and inside a published bulletin that
 * reads as a page that never finished loading rather than as a missing map.
 */
export const districtMapQuery = (uid) => ({
    map: {
        resource: `maps/${uid}`,
        params: {
            fields: ['id,displayName,basemap'],
        },
    },
});
