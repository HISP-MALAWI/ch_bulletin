// Quill 2 stores both kinds of list as <ol> and tells them apart with a
// `data-list` attribute on each <li>, drawing the bullet or the number with an
// empty `ql-ui` span that nothing but Quill's own stylesheet paints. What gets
// saved is the *contents* of the editor, so none of the `ql-editor` classes
// those rules hang off come with it, and a bullet list reaches the preview as a
// numbered one.
//
// This rewrites that markup as plain semantic HTML so the app can style it. The
// rewrite is allowlist-driven and rebuilds the tree rather than editing it,
// which is also what makes it usable as the sanitiser for the one place in the
// app that hands a stored string to `dangerouslySetInnerHTML`.

// Copied to the output, along with spans that carry a font class. Everything
// else is unwrapped, keeping its text.
const ALLOWED_TAGS = new Set([
    'P',
    'BR',
    'H1',
    'H2',
    'H3',
    'STRONG',
    'EM',
    'U',
    'S',
    'A',
    'UL',
    'OL',
    'LI',
])

// Dropped along with everything inside them.
const DROPPED_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'TEMPLATE',
    'IFRAME',
    'OBJECT',
    'EMBED',
    'LINK',
    'META',
])

// The only classes worth keeping: Quill's clipboard matchers read them back, so
// a font survives a round trip through the editor. Any other class Quill writes
// means nothing away from the editor.
const FONT_CLASSES = ['ql-font-serif', 'ql-font-monospace']

// Quill's list-marker placeholder, always empty.
const UI_CLASS = 'ql-ui'

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

const isSafeHref = (href) => {
    if (!href) {
        return false
    }

    try {
        return SAFE_URL_PROTOCOLS.has(new URL(href).protocol)
    } catch {
        // Relative or malformed. Nothing in a bulletin links to itself, and a
        // href the parser cannot read is one whose scheme cannot be checked.
        return false
    }
}

const buildChildren = (source, target, doc) => {
    Array.from(source.childNodes).forEach((node) => {
        if (node.nodeType === 3) {
            target.appendChild(doc.createTextNode(node.nodeValue))
            return
        }

        buildNode(node, target, doc)
    })
}

const buildNode = (node, target, doc) => {
    if (node.nodeType !== 1) {
        return
    }

    const tag = node.tagName

    // Compared in upper case because HTML elements report an upper-case tag
    // name but SVG ones keep theirs, so a `<script>` inside pasted SVG would
    // otherwise slip past and print as text.
    if (DROPPED_TAGS.has(tag.toUpperCase()) || node.classList.contains(UI_CLASS)) {
        return
    }

    if (tag === 'UL' || tag === 'OL') {
        buildList(node, target, doc)
        return
    }

    const fontClasses = FONT_CLASSES.filter((name) =>
        node.classList.contains(name)
    )

    // A span survives only to carry a font. Quill wraps a run of text in one to
    // hold whatever attribute applies to it, and those attributes are not worth
    // keeping, so an empty-handed span is unwrapped like any other unknown tag.
    if (!ALLOWED_TAGS.has(tag) && fontClasses.length === 0) {
        buildChildren(node, target, doc)
        return
    }

    if (tag === 'A' && !isSafeHref(node.getAttribute('href'))) {
        buildChildren(node, target, doc)
        return
    }

    const element = doc.createElement(tag.toLowerCase())

    fontClasses.forEach((name) => element.classList.add(name))

    if (tag === 'A') {
        element.setAttribute('href', node.getAttribute('href'))
    }

    target.appendChild(element)
    buildChildren(node, element, doc)
}

// Items whose kind changes part-way through — which the toolbar allows — become
// one element per consecutive run, so `<ol>` never ends up holding bullets.
const buildList = (source, target, doc) => {
    const fallback = source.tagName === 'UL' ? 'bullet' : 'ordered'

    let list = null
    let kind = null

    Array.from(source.children).forEach((child) => {
        if (child.tagName !== 'LI') {
            // Not an item: rebuild it in place and end the run, so an item after
            // it starts a list of its own.
            list = null
            kind = null
            buildNode(child, target, doc)
            return
        }

        const declared = child.getAttribute('data-list')
        const itemKind =
            declared === 'bullet' || declared === 'ordered' ? declared : fallback

        if (itemKind !== kind) {
            list = doc.createElement(itemKind === 'bullet' ? 'ul' : 'ol')
            kind = itemKind
            target.appendChild(list)
        }

        const item = doc.createElement('li')
        list.appendChild(item)
        buildChildren(child, item, doc)
    })
}

/**
 * Rewrites saved Quill HTML as plain semantic HTML, dropping everything not on
 * the allowlist. Unknown elements are unwrapped rather than deleted, so their
 * text survives; script-like elements go entirely.
 *
 * @returns {string} markup safe to render, or `''` if there was nothing usable
 */
export const normaliseHighlightsHtml = (html) => {
    if (typeof html !== 'string' || html.trim() === '') {
        return ''
    }

    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const container = parsed.createElement('div')

    buildChildren(parsed.body, container, parsed)

    return container.innerHTML
}

/**
 * Whether markup would put anything on the page.
 *
 * An untouched editor reports `<p><br></p>`, which is a truthy non-empty string
 * and so passes the save-time check; showing an empty "1. Highlights" card
 * because of it is worse than showing nothing.
 */
export const hasHighlightsContent = (html) => {
    if (typeof html !== 'string') {
        return false
    }

    // A line holding only a non-breaking space is empty as far as the reader is
    // concerned, and it arrives here as the entity rather than as the character
    // `trim` knows how to remove.
    return (
        html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
            .trim() !== ''
    )
}
