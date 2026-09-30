import React, { useState } from 'react';
import { 
    Modal, 
    ModalTitle, 
    ModalContent, 
    ModalActions, 
    ButtonStrip, 
    Button, 
    InputField 
} from '@dhis2/ui';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

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
}) => {
    const [hideModal, setHideModal] = useState(true);
    const [activeList, setActiveList] = useState('advisory');
    const [newText, setNewText] = useState('');

    const getListProps = (type) => type === 'advisory'
        ? { items: advisories, setItems: setAdvisories, suggestions: advisorySuggestions }
        : { items: recommendations, setItems: setRecommendations, suggestions: recommendationSuggestions };

    const handleAddText = () => {
        const text = newText.trim();
        if (!text) return;
        const { setItems } = getListProps(activeList);
        setItems((items) => [...items, text]);
        setNewText('');
        setHideModal(true);
    };

    const handleDelete = (type, index) => {
        const { setItems } = getListProps(type);
        setItems((items) => items.filter((_, itemIndex) => itemIndex !== index));
    };

    const addSuggestion = (type, suggestion) => {
        const { setItems } = getListProps(type);
        setItems((items) => items.includes(suggestion) ? items : [...items, suggestion]);
    };

    const renderList = (type, label) => {
        const { items, suggestions } = getListProps(type);
        return (
            <div style={{ marginTop: type === 'recommendation' ? '24px' : '0' }}>
                <h4 style={{ margin: '0 0 10px', color: '#1e293b', fontSize: '15px' }}>{label}</h4>
                {items.map((text, index) => (
                    <div key={`${text}-${index}`} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '12px',
                        border: '1px solid #e2e8f0',
                        marginBottom: '8px',
                        borderRadius: '6px',
                        alignItems: 'center',
                    }}>
                        <span>{text}</span>
                        <button
                            type="button"
                            aria-label={`Delete ${label.toLowerCase()} ${index + 1}`}
                            onClick={() => handleDelete(type, index)}
                            style={{ color: '#ef4444', cursor: 'pointer', border: 0, background: 'none' }}
                        >
                            <DeleteIcon fontSize="small" />
                        </button>
                    </div>
                ))}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '10px 0' }}>
                    <Button
                        secondary
                        icon={<AddIcon />}
                        onClick={() => {
                            setActiveList(type);
                            setNewText('');
                            setHideModal(false);
                        }}
                    >
                        Add {type === 'advisory' ? 'advisory' : 'recommendation'}
                    </Button>
                </div>
                {suggestions.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                        <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '13px' }}>
                            Suggested from available forecast and malaria data
                        </p>
                        {suggestions.map((suggestion) => (
                            <div key={suggestion} style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: '12px',
                                padding: '10px 0',
                                borderTop: '1px solid #e2e8f0',
                            }}>
                                <span>{suggestion}</span>
                                <Button
                                    secondary
                                    onClick={() => addSuggestion(type, suggestion)}
                                    disabled={items.includes(suggestion)}
                                >
                                    {items.includes(suggestion) ? 'Added' : 'Add'}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <section className={style.sectionCard}>
            <div className={style.sectionHeader}>
                <div className={style.stepBadge}>{step || 4}</div>
                <span className={style.sectionTitle}>{title || 'Health advisories'}</span>
            </div>
            {description && (
                <p className={style.sectionSub}>{description}</p>
            )}
            {renderList('advisory', 'Health advisories')}
            {renderList('recommendation', 'Recommendations')}

            {!hideModal && (
                <Modal onClose={() => setHideModal(true)} small>
                    <ModalTitle>Add {activeList === 'advisory' ? 'Health Advisory' : 'Recommendation'}</ModalTitle>
                    <ModalContent>
                        <InputField
                            label={activeList === 'advisory' ? 'Advisory text' : 'Recommendation text'}
                            onChange={({ value }) => setNewText(value)}
                            value={newText}
                            placeholder={activeList === 'advisory'
                                ? 'Enter a health advisory'
                                : 'Enter a recommendation'}
                        />
                    </ModalContent>
                    <ModalActions>
                        <ButtonStrip end>
                            <Button secondary onClick={() => setHideModal(true)}>
                                Cancel
                            </Button>
                            <Button primary onClick={handleAddText}>
                                Add {activeList === 'advisory' ? 'Advisory' : 'Recommendation'}
                            </Button>
                        </ButtonStrip>
                    </ModalActions>
                </Modal>
            )}
        </section>
    );
};

export default AdvisoriesWidget;