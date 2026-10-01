import React from 'react';
import SuggestibleList from './suggestibleList';
import { BulletinSectionHeader } from './bulletinSection';

/**
 * The executive summary: one line per month of the forecast period, drafted
 * from the data and edited by the author.
 *
 * It leads the document rather than sitting in its numbered sequence, so it
 * carries no step numeral.
 */
const ExecutiveSummaryWidget = ({ style, summary = [], setSummary, drafts = [] }) => (
    <section className={`${style.sectionCard} ${style.fullWidth}`}>
        <BulletinSectionHeader
            title="Executive summary"
            description="What each month of the forecast period holds."
        />

        <SuggestibleList
            singular="summary line"
            modalTitle="Summary Line"
            confirmLabel="Add Summary Line"
            placeholder="Enter a summary line"
            items={summary}
            setItems={setSummary}
            suggestions={drafts}
            suggestionHint="Drafted from the forecast and seasonal climate data for each month"
        />
    </section>
);

export default ExecutiveSummaryWidget;
