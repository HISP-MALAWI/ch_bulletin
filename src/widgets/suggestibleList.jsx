import React, { useState } from 'react';
import {
    Modal,
    ModalTitle,
    ModalContent,
    ModalActions,
    ButtonStrip,
    Button,
    InputField,
} from '@dhis2/ui';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * A plain list of sentences the author can edit, with a set of suggestions
 * beside it that are accepted one at a time.
 *
 * Extracted from the advisories widget, which needs exactly this for both of
 * its lists, so one behaviour serves advisories, recommendations and the
 * executive summary rather than three copies of it.
 */
const SuggestibleList = ({
    label,
    singular,
    items = [],
    setItems,
    suggestions = [],
    suggestionHint = 'Suggested from available forecast and malaria data',
    modalTitle,
    confirmLabel,
    placeholder,
    containerStyle,
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newText, setNewText] = useState('');

    const resolvedModalTitle = modalTitle || capitalise(singular);
    const resolvedConfirmLabel = confirmLabel || `Add ${capitalise(singular)}`;
    const resolvedPlaceholder = placeholder || `Enter a ${singular}`;

    const handleAddText = () => {
        const text = newText.trim();
        if (!text) {
            return;
        }

        setItems((current) => [...current, text]);
        setNewText('');
        setIsModalOpen(false);
    };

    const handleDelete = (index) => {
        setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    };

    const addSuggestion = (suggestion) => {
        setItems((current) => (current.includes(suggestion) ? current : [...current, suggestion]));
    };

    return (
        <div style={containerStyle}>
            {/* Optional: a single list under a section heading needs no heading
                of its own. */}
            {label && (
                <h4 style={{ margin: '0 0 10px', color: '#1e293b', fontSize: '15px' }}>{label}</h4>
            )}

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
                        aria-label={`Delete ${(label || singular).toLowerCase()} ${index + 1}`}
                        onClick={() => handleDelete(index)}
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
                        setNewText('');
                        setIsModalOpen(true);
                    }}
                >
                    Add {singular}
                </Button>
            </div>

            {suggestions.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                    <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '13px' }}>
                        {suggestionHint}
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
                                onClick={() => addSuggestion(suggestion)}
                                disabled={items.includes(suggestion)}
                            >
                                {items.includes(suggestion) ? 'Added' : 'Add'}
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <Modal onClose={() => setIsModalOpen(false)} small>
                    <ModalTitle>Add {resolvedModalTitle}</ModalTitle>
                    <ModalContent>
                        <InputField
                            label={`${capitalise(singular)} text`}
                            onChange={({ value }) => setNewText(value)}
                            value={newText}
                            placeholder={resolvedPlaceholder}
                        />
                    </ModalContent>
                    <ModalActions>
                        <ButtonStrip end>
                            <Button secondary onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button primary onClick={handleAddText}>
                                {resolvedConfirmLabel}
                            </Button>
                        </ButtonStrip>
                    </ModalActions>
                </Modal>
            )}
        </div>
    );
};

export default SuggestibleList;
