import React from 'react'
import style from '../App.module.css'
import RichTextEditor from './richTextEditor' // Adjust path as needed

// The editor is given `highlights` itself, not a copy of it. A local copy used
// to shadow the prop, so editing an existing bulletin opened a blank editor and
// the first keystroke replaced the stored highlights with that one keystroke.
const HighlightsInput = ({style, step, title, description, fullWidth = false, highlights, setHighlights }) => {
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
                    value={highlights || ''}
                    onChange={setHighlights}
                    placeholder="Provide a summary of key past weather and climate observations for the selected period..." 
                />
            </div>
        </section>
    )
}

export default HighlightsInput