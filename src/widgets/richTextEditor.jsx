    import React, { useEffect, useRef } from 'react';
    import Quill from 'quill';
    import 'quill/dist/quill.snow.css'; 
    import style from '../App.module.css';

    const RichTextEditor = ({ value, onChange, placeholder }) => {
        const containerRef = useRef(null);
        const quillRef = useRef(null);
        // Quill's output comes back in through `value` on the next render.
        // Remembering the last thing the editor emitted is what stops the load
        // effect from reading its own text as content to load, which would put
        // the cursor back at the start on every keystroke.
        const lastEmitted = useRef(null);

        useEffect(() => {
            if (containerRef.current && !quillRef.current) {
                const quill = new Quill(containerRef.current, {
                    theme: 'snow',
                    placeholder: placeholder || 'Provide a summary...',
                    modules: {
                        toolbar: [
                            [{ font: [] }],
                            [{ 'header': [1, 2,3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['link', 'clean'],
                        ],
                    },
                });

                quillRef.current = quill;

                quill.on('text-change', () => {
                    const html = quill.root.innerHTML;
                    lastEmitted.current = html;
                    if (onChange) {
                        onChange(html);
                    }
                });
            }
        }, []);

        useEffect(() => {
            const quill = quillRef.current;
            if (!quill || typeof value !== 'string' || value === '') {
                return;
            }
            if (value === lastEmitted.current) {
                return;
            }
            // Loaded through Quill rather than by assigning `root.innerHTML`:
            // assigning the DOM leaves Quill's own model empty, so the next
            // keystroke re-renders from nothing and wipes what was just loaded.
            const delta = quill.clipboard.convert({ html: value, text: '' });
            quill.setContents(delta, Quill.sources.SILENT);
            lastEmitted.current = value;
        }, [value]);

        return (
            <div className={style.editorWrapper}>
                <div ref={containerRef} />
                <div className={style.charCount}>
                    {/* Strip HTML tags to get accurate character count like in form.jpg */}
                    {(value || "").replace(/<[^>]*>/g, '').length} characters
                </div>
            </div>
        );
    };

    export default RichTextEditor;