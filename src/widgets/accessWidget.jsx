import React, { useState } from 'react';
import {
    Box, Field, MultiSelect, MultiSelectOption,Button,
} from '@dhis2/ui';
import { SettingsSection } from './settingsSectionWidget';

export const AccessWorkflowWidget = ({
    styles,
    settings,
    setSettings,
    roles
}) => {
    const handleRoleChange = (key, selected) => {
        setSettings(prev => ({
            ...prev,
            [key]: selected
        }));
    };
    return (
        <SettingsSection
            step="3"
            title="Access and Workflow Roles"
            subtitle="Assign user groups to specific bulletin actions."
            styles={styles}
        >
            <Box marginBottom="16px">
                <Field label="Bulletin Generation (Drafting)">
                    <MultiSelect
                        selected={settings.generationRoles}
                        onChange={({ selected }) =>
                            handleRoleChange('generationRoles', selected)
                        }
                    >
                        {roles.map((role) => (
                            <MultiSelectOption
                                key={role.id}
                                label={role.displayName}
                                value={role.id}
                            />
                        ))}
                    </MultiSelect>
                </Field>
            </Box>

            <Box marginBottom="16px">
                <Field label="Review & Publishing">
                    <MultiSelect
                        selected={settings.reviewRoles}
                        onChange={({ selected }) =>
                            handleRoleChange('reviewRoles', selected)
                        }
                    >
                        {roles.map((role) => (
                            <MultiSelectOption
                                key={role.id}
                                label={role.displayName}
                                value={role.id}
                            />
                        ))}
                    </MultiSelect>
                </Field>
            </Box>

            <Field label="Configuration Access">
                <MultiSelect
                    selected={settings.configRoles}
                    onChange={({ selected }) =>
                        handleRoleChange('configRoles', selected)
                    }
                >
                    {roles.map((role) => (
                        <MultiSelectOption
                            key={role.id}
                            label={role.displayName}
                            value={role.id}
                        />
                    ))}
                </MultiSelect>
            </Field>
        </SettingsSection>
    );
};