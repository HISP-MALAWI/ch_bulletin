import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css'; // Modern snow theme
import style from '../App.module.css';

const RichTextEditor = ({ value, onChange, placeholder }) => {
    const containerRef = useRef(null);
    const quillRef = useRef(null);

    useEffect(() => {
        if (containerRef.current && !quillRef.current) {
            // Initialize Quill 2.0.3
            quillRef.current = new Quill(containerRef.current, {
                theme: 'snow',
                placeholder: placeholder || 'Provide a summary...',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['link', 'clean'],
                    ],
                },
            });

            // Handle content changes
            quillRef.current.on('text-change', () => {
                const html = quillRef.current.root.innerHTML;
                if (onChange) onChange(html);
            });
        }
        
        // Set initial value if provided
        if (value && quillRef.current && quillRef.current.root.innerHTML !== value) {
            quillRef.current.root.innerHTML = value;
        }
    }, []);

    return (
        <div className={style.editorWrapper}>
            <div ref={containerRef} />
            <div className={style.charCount}>
                {/* Simple logic to strip HTML for character count */}
                {(value || "").replace(/<[^>]*>/g, '').length} characters
            </div>
        </div>
    );
};

export default RichTextEditor;