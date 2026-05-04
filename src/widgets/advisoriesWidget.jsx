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

const AdvisoriesWidget = ({ style, step, title, advisories = [], setAdvisories }) => {
    const [hideModal, setHideModal] = useState(true);
    const [newAdvisory, setNewAdvisory] = useState('');

    const handleAddAdvisory = () => {
        if (newAdvisory.trim()) {
            setAdvisories([...advisories, newAdvisory.trim()]);
            setNewAdvisory('');
            setHideModal(true);
        }
    };

    const handleDelete = (index) => {
        setAdvisories(advisories.filter((_, i) => i !== index));
    };

    return (
        <section className={style.sectionCard}>
            <div className={style.sectionHeader}>
                <div className={style.stepBadge}>{step || 4}</div>
                <span className={style.sectionTitle}>{title || 'Health advisories'}</span>
            </div>

            <div className={style.advisoryList}>
                {advisories.map((text, i) => (
                    <div key={i} className={style.advisoryItem} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        padding: '12px', 
                        border: '1px solid #e2e8f0', 
                        marginBottom: '8px', 
                        borderRadius: '6px',
                        alignItems: 'center'
                    }}>
                        <span>{text}</span>
                        <DeleteIcon 
                            style={{ color: '#ef4444', cursor: 'pointer' }} 
                            fontSize="small" 
                            onClick={() => handleDelete(i)}
                        />
                    </div>
                ))}

                <button 
                    onClick={() => setHideModal(false)}
                    className={style.addAdvisory} 
                    style={{ 
                        width: '100%', 
                        padding: '10px', 
                        border: '1px dashed #3b82f6', 
                        background: '#eff6ff', 
                        color: '#3b82f6', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                >
                    <AddIcon fontSize="small" /> Add Advisory
                </button>
            </div>

            {!hideModal && (
                <Modal onClose={() => setHideModal(true)} small>
                    <ModalTitle>Add New Health Advisory</ModalTitle>
                    <ModalContent>
                        <InputField
                            label="Advisory Text"
                            onChange={({ value }) => setNewAdvisory(value)}
                            value={newAdvisory}
                            placeholder="e.g., Use mosquito nets and repellents"
                        />
                    </ModalContent>
                    <ModalActions>
                        <ButtonStrip end>
                            <Button secondary onClick={() => setHideModal(true)}>
                                Cancel
                            </Button>
                            <Button primary onClick={handleAddAdvisory}>
                                Add Advisory
                            </Button>
                        </ButtonStrip>
                    </ModalActions>
                </Modal>
            )}
        </section>
    );
};

export default AdvisoriesWidget;