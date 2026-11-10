import React from 'react'
import style from '../App.module.css'

/**
 * The heading shared by every section of the bulletin document.
 *
 * Two levels only: the section's own heading, and — where a section holds more
 * than one block — a block heading. Sections used to disagree about both, so a
 * chart title could be larger than the section title above it.
 *
 * The sections used to carry step badges numbered down the page. They were
 * dropped: the document is read, not worked through, and the numerals read as
 * instructions. The Settings page kept its own, which are steps.
 */
export const BulletinSectionHeader = ({ title, description }) => (
    <>
        <div className={style.sectionHeader}>
            <span className={style.sectionTitle}>{title}</span>
        </div>
        {description && <p className={style.sectionSub}>{description}</p>}
    </>
)

/**
 * A complete section: card frame plus heading. Used where the preview renders
 * a section itself, rather than through one of the chart widgets.
 */
export const BulletinSection = ({ title, description, children }) => (
    <section className={style.bulletinCard}>
        <BulletinSectionHeader title={title} description={description} />
        {children}
    </section>
)

export default BulletinSection
