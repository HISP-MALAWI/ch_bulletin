import React, { useState } from 'react';
import {
    Box, Field, Button, InputField, MultiSelect, 
    MultiSelectOption, ButtonStrip, Help 
} from '@dhis2/ui';
import { SettingsSection } from './settingsSectionWidget';

export const DistributionWidget = ({ styles, group,setSettings,settings }) => {
    return (
        <SettingsSection
            step="4"
            title="Distribution Management"
            subtitle="Set which groups receive the finalized PDF."
            pill="Mailing groups"
            styles={styles}
        >
            <Field label="Recipient User Groups">
                <MultiSelect
                    placeholder="Select groups to receive the PDF..."
                    selected={settings.distributionRoles}
                    onChange={({ selected }) =>
                        setSettings(prev => ({
                            ...prev,
                            distributionRoles: selected
                        }))
                    }
                >
                    {group?.map((g) => (
                        <MultiSelectOption
                            key={g.id}
                            label={g.displayName}
                            value={g.id}
                        />
                    ))}
                </MultiSelect>
            </Field>
        </SettingsSection>
    );
};
