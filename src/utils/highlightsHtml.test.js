import { normaliseHighlightsHtml, hasHighlightsContent } from './highlightsHtml'

// Quill's own markup for a list item: the kind lives in the attribute and the
// visible marker in an empty span.
const item = (kind, text) =>
    `<li data-list="${kind}"><span class="ql-ui" contenteditable="false"></span>${text}</li>`

describe('normaliseHighlightsHtml', () => {
    it('turns a bullet list into a real <ul>, without Quill’s marker spans', () => {
        const stored = `<ol>${item('bullet', 'Rain')}${item('bullet', 'Heat')}</ol>`

        expect(normaliseHighlightsHtml(stored)).toBe(
            '<ul><li>Rain</li><li>Heat</li></ul>'
        )
    })

    it('turns an ordered list into a real <ol>', () => {
        const stored = `<ol>${item('ordered', 'First')}${item('ordered', 'Second')}</ol>`

        expect(normaliseHighlightsHtml(stored)).toBe(
            '<ol><li>First</li><li>Second</li></ol>'
        )
    })

    it('splits a list whose items change kind into one element per run', () => {
        const stored = `<ol>${item('bullet', 'A')}${item('bullet', 'B')}${item(
            'ordered',
            'C'
        )}</ol>`

        expect(normaliseHighlightsHtml(stored)).toBe(
            '<ul><li>A</li><li>B</li></ul><ol><li>C</li></ol>'
        )
    })

    it('keeps a nested list inside the item that holds it', () => {
        const stored = `<ol>${item('bullet', 'Outer')}`.replace(
            '</li>',
            `<ol>${item('bullet', 'Inner')}</ol></li>`
        ) + '</ol>'

        expect(normaliseHighlightsHtml(stored)).toBe(
            '<ul><li>Outer<ul><li>Inner</li></ul></li></ul>'
        )
    })

    it('keeps paragraphs, headings and inline formatting', () => {
        const stored =
            '<h2>Summary</h2><p><strong>Bold</strong>, <em>italic</em>, <u>under</u> and <s>struck</s>.</p><p>Next<br>line</p>'

        expect(normaliseHighlightsHtml(stored)).toBe(stored)
    })

    it('keeps a link with a safe href and drops one that could run script', () => {
        expect(
            normaliseHighlightsHtml('<p><a href="https://example.com/x">ok</a></p>')
        ).toBe('<p><a href="https://example.com/x">ok</a></p>')

        // Unwrapped, not deleted: the text is the author's.
        expect(
            normaliseHighlightsHtml('<p><a href="javascript:alert(1)">no</a></p>')
        ).toBe('<p>no</p>')
    })

    it('drops script, style and frame elements along with their contents', () => {
        const stored =
            '<p>a</p><script>alert(1)</script><style>p{color:red}</style><iframe src="//x"></iframe><p>b</p>'

        expect(normaliseHighlightsHtml(stored)).toBe('<p>a</p><p>b</p>')
    })

    it('drops script inside pasted SVG, whose tag names stay lower case', () => {
        expect(
            normaliseHighlightsHtml('<p>a</p><svg><script>alert(1)</script></svg>')
        ).toBe('<p>a</p>')
    })

    it('drops every attribute except a safe href and a font class', () => {
        const stored =
            '<p onclick="alert(1)" style="color:red" class="ql-align-center">a</p>'

        expect(normaliseHighlightsHtml(stored)).toBe('<p>a</p>')
    })

    it('keeps Quill’s font classes so the font survives re-editing', () => {
        expect(
            normaliseHighlightsHtml('<p><span class="ql-font-serif">x</span></p>')
        ).toBe('<p><span class="ql-font-serif">x</span></p>')
    })

    it('unwraps elements it does not allow, keeping their text', () => {
        expect(
            normaliseHighlightsHtml('<div><p>kept</p><span>and this</span></div>')
        ).toBe('<p>kept</p>and this')
    })

    it('returns an empty string for anything with no markup to rewrite', () => {
        expect(normaliseHighlightsHtml('')).toBe('')
        expect(normaliseHighlightsHtml('   ')).toBe('')
        expect(normaliseHighlightsHtml(null)).toBe('')
        expect(normaliseHighlightsHtml(undefined)).toBe('')
        expect(normaliseHighlightsHtml(42)).toBe('')
    })

    it('is idempotent, so re-saving cleaned markup changes nothing', () => {
        const stored = `<h1>Title</h1><ol>${item('bullet', 'Rain')}</ol><p><a href="https://x.test">link</a></p>`

        const once = normaliseHighlightsHtml(stored)

        expect(normaliseHighlightsHtml(once)).toBe(once)
    })
})

describe('hasHighlightsContent', () => {
    it('reports false for an editor that was never typed in', () => {
        expect(hasHighlightsContent('<p><br></p>')).toBe(false)
        expect(hasHighlightsContent('<p>&nbsp;</p>')).toBe(false)
        expect(hasHighlightsContent('')).toBe(false)
        expect(hasHighlightsContent(null)).toBe(false)
    })

    it('reports true as soon as there is text, on any line', () => {
        expect(hasHighlightsContent('<p>Rain</p>')).toBe(true)
        expect(hasHighlightsContent('<p><br></p><p>Rain</p>')).toBe(true)
        expect(hasHighlightsContent(`<ol>${item('bullet', 'Rain')}</ol>`)).toBe(true)
    })
})
