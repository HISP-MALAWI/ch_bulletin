import React, { useState } from 'react';
import {
    Button,
} from '@dhis2/ui';
import { SettingsSection } from './settingsSectionWidget';

export const DiseaseMappingWidget = ({ styles }) => {
    return (
        <SettingsSection
            step="1"
            title="Disease Mapping Parameters"
            subtitle="Manage data elements and their display aliases."
            styles={styles}
        >
            <div
                style={{
                    border: '1px dashed #cbd5e1',
                    padding: '32px',
                    textAlign: 'center',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc'
                }}
            >
                <Button
                    secondary
                    onClick={() => console.log('Open Modal')}
                >
                    + Add Disease Element
                </Button>
            </div>
        </SettingsSection>
    );
};