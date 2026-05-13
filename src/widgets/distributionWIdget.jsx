import React, { useState } from 'react';
import {
    Box, Field, Button, InputField, MultiSelect, 
    MultiSelectOption, ButtonStrip, Help 
} from '@dhis2/ui';
import { SettingsSection } from './settingsSectionWidget';

export const DistributionWidget = ({ styles }) => {
    return (
        <SettingsSection
            step="3"
            title="Distribution Management"
            subtitle="Set which groups receive the finalized PDF."
            pill="Mailing groups"
            styles={styles}
        >
            <Field label="Recipient User Groups">
                <MultiSelect
                    placeholder="Select groups to receive the PDF..."
                />
            </Field>
        </SettingsSection>
    );
};
