// The bulletin document's design system, taken from the reference bulletin.
//
// One source for both the stylesheet and the charts. A CSS custom property
// cannot be read by a recharts prop, and `var()` inside an SVG presentation
// attribute does not resolve, so the palette has to exist in JavaScript as
// well as CSS. This object is that single source; `applyBulletinTokens`
// publishes the same values as custom properties for the stylesheet to use.

export const palette = {
    lake: '#10324A',
    shire: '#2F8A93',
    alert: '#C8352E',
    maize: '#D9A23A',
    leaf: '#2E7D4F',
    ink: '#16222C',
    mute: '#5E6C77',
    line: '#DCE3E8',
    paper: '#F3F6F7',
}

// One rule for every hazard, as the reference has it: a district-month is alert,
// watch or normal, and the colour says which.
export const statusPalette = {
    alert: palette.alert,
    watch: palette.maize,
    normal: palette.leaf,
}

export const fontFamily = {
    display: "'Bricolage Grotesque', system-ui, sans-serif",
    body: "'IBM Plex Sans', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
}

// Chart series. Named by what they measure rather than by colour, so a widget
// asks for `series.rainfall` and the palette decides what that looks like.
export const series = {
    rainfall: '#86BEC3',
    temperature: '#E0443E',
    cases: palette.shire,
    // A fan chart of two bands: the wider 80% interval drawn lighter, with the
    // 50% interval inside it darker, as the reference bulletin has it.
    predictionRange: '#CFE6E8',
    predictionQuartile: '#8FC3C8',
    threshold: palette.alert,
}

const toCustomProperties = () => {
    const properties = {}

    Object.entries(palette).forEach(([name, value]) => {
        properties[`--bz-${name}`] = value
    })
    Object.entries(fontFamily).forEach(([name, value]) => {
        properties[`--bz-font-${name}`] = value
    })

    return properties
}

/**
 * Publishes the palette and font stacks to the document root, so the stylesheet
 * and the charts cannot drift apart. Safe to call more than once.
 */
export const applyBulletinTokens = (target) => {
    const root = target || (typeof document === 'undefined' ? null : document.documentElement)

    if (!root) {
        return
    }

    Object.entries(toCustomProperties()).forEach(([name, value]) => {
        root.style.setProperty(name, value)
    })
}
