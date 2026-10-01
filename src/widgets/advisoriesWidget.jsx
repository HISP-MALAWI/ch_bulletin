import React from 'react';
import SuggestibleList from './suggestibleList';
import { BulletinSectionHeader } from './bulletinSection';

const AdvisoriesWidget = ({
    style,
    description,
    step,
    title,
    advisories = [],
    setAdvisories,
    recommendations = [],
    setRecommendations,
    advisorySuggestions = [],
    recommendationSuggestions = [],
}) => (
    <section className={style.sectionCard}>
        <BulletinSectionHeader
            step={step || 4}
            title={title || 'Health advisories'}
            description={description}
        />

        <SuggestibleList
            label="Health advisories"
            singular="advisory"
            modalTitle="Health Advisory"
            confirmLabel="Add Advisory"
            placeholder="Enter a health advisory"
            items={advisories}
            setItems={setAdvisories}
            suggestions={advisorySuggestions}
        />

        <SuggestibleList
            label="Recommendations"
            singular="recommendation"
            modalTitle="Recommendation"
            confirmLabel="Add Recommendation"
            placeholder="Enter a recommendation"
            items={recommendations}
            setItems={setRecommendations}
            suggestions={recommendationSuggestions}
            containerStyle={{ marginTop: '24px' }}
        />
    </section>
);

export default AdvisoriesWidget;
