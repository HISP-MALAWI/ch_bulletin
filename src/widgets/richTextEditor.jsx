    import React, { useEffect, useRef } from 'react';
    import Quill from 'quill';
    import 'quill/dist/quill.snow.css'; 
    import style from '../App.module.css';

    const RichTextEditor = ({ value, onChange, placeholder }) => {
        const containerRef = useRef(null);
        const quillRef = useRef(null);

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
                    if (onChange) {
                        onChange(html);
                    }
                });
            }
        }, []); 

        useEffect(() => {
            if (quillRef.current) {
                const currentContents = quillRef.current.root.innerHTML;
                if (value !== undefined && value !== currentContents) {
                    quillRef.current.root.innerHTML = value;
                }
            }
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