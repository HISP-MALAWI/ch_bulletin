import React, { useState } from 'react'
import style from '../App.module.css'
import RichTextEditor from './richTextEditor' // Adjust path as needed

const HighlightsInput = ({style, step, title, description, fullWidth = false, highlights, setHighlights }) => {
    const [content, setContent] = useState('');

    const handleContentChange = (html) => {
        console.log('Highlights content updated:', html);
        setContent(html);
        setHighlights(html);
    };

    return (
        <section className={`${style.sectionCard} ${fullWidth ? style.fullWidth : ''}`}>
            <div className={style.sectionHeader}>
                <div className={style.stepBadge}>{step}</div>
                <span className={style.sectionTitle}>{title}</span>
            </div>
            
            {description && (
                <p className={style.sectionSub}>{description}</p>
            )}

            <div className={style.sectionContent}>
                <RichTextEditor 
                    value={content}
                    onChange={handleContentChange}
                    placeholder="Provide a summary of key past weather and climate observations for the selected period..." 
                />
            </div>
        </section>
    )
}

export default HighlightsInput