import React, { useState } from 'react';
import {
    Modal, ModalTitle, ModalContent, ModalActions,
    ButtonStrip, Button, Field, InputField, SingleSelectField, SingleSelectOption
} from '@dhis2/ui';

export const DiseaseMappingModal = ({ onClose, onSave, dataElements = [] }) => {
    const [formData, setFormData] = useState({
        displayName: '',
        dataElement: '',
        alarmElement: ''
    });

    return (
        <Modal onClose={onClose} position="middle">
            <ModalTitle>Add Disease Mapping</ModalTitle>
            <ModalContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Display Name */}
                    <Field label="Bulletin Display Name" helpText="How the disease will appear in the PDF report">
                        <InputField
                            value={formData.displayName}
                            onChange={({ value }) => setFormData({ ...formData, displayName: value })}
                            placeholder="e.g. Malaria Cases"
                        />
                    </Field>

                    {/* Primary Data Element */}
                    <Field label="Primary Data Element">
                        <SingleSelectField
                            selected={formData.dataElement}
                            onChange={({ selected }) => setFormData({ ...formData, dataElement: selected })}
                            filterable
                        >
                            {dataElements?.map(de => (
                                <SingleSelectOption key={de.id} label={de.displayName} value={de.id} />
                            ))}
                        </SingleSelectField>
                    </Field>

                    {/* Alarm Indicator */}
                    <Field label="Alarm Indication Data Element" helpText="Element used to trigger threshold alerts">
                        <SingleSelectField
                            selected={formData.alarmElement}
                            onChange={({ selected }) => setFormData({ ...formData, alarmElement: selected })}
                            filterable
                        >
                            {dataElements?.map(de => (
                                <SingleSelectOption key={de.id} label={de.displayName} value={de.id} />
                            ))}
                        </SingleSelectField>
                    </Field>
                </div>
            </ModalContent>
            <ModalActions>
                <ButtonStrip end>
                    <Button secondary onClick={onClose}>Cancel</Button>
                    <Button primary onClick={() => onSave(formData)}>Save Mapping</Button>
                </ButtonStrip>
            </ModalActions>
        </Modal>
    );
};