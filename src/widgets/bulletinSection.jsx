import React from 'react'
import style from '../App.module.css'

/**
 * The heading shared by every section of the bulletin document.
 *
 * Two levels only: the section's own heading, and — where a section holds more
 * than one block — a block heading. Sections used to disagree about both, so a
 * chart title could be larger than the section title above it.
 *
 * `step` is optional. The numeral sits in the badge and is deliberately not
 * translated; everything else is.
 */
export const BulletinSectionHeader = ({ step, title, description }) => (
    <>
        <div className={style.sectionHeader}>
            {step !== undefined && step !== null && step !== '' && (
                <div className={style.stepBadge}>{step}</div>
            )}
            <span className={style.sectionTitle}>{title}</span>
        </div>
        {description && <p className={style.sectionSub}>{description}</p>}
    </>
)

/**
 * A complete section: card frame plus heading. Used where the preview renders
 * a section itself, rather than through one of the chart widgets.
 */
export const BulletinSection = ({ step, title, description, children }) => (
    <section className={style.bulletinCard}>
        <BulletinSectionHeader step={step} title={title} description={description} />
        {children}
    </section>
)

export default BulletinSection
