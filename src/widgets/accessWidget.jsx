import React, { useState } from 'react';
import {
    Box, Field, MultiSelect, MultiSelectOption,Button,
} from '@dhis2/ui';
import { SettingsSection } from './settingsSectionWidget';

export const AccessWorkflowWidget = ({
    styles,
    settings,
    setSettings
}) => {
    return (
        <SettingsSection
            step="2"
            title="Access and Workflow Roles"
            subtitle="Assign user groups to specific bulletin actions."
            styles={styles}
        >
            <Box marginBottom="16px">
                <Field label="Bulletin Generation (Drafting)">
                    <MultiSelect
                        selected={settings.generationRoles}
                        onChange={({ selected }) =>
                            setSettings({
                                ...settings,
                                generationRoles: selected
                            })
                        }
                    >
                        <MultiSelectOption
                            label="Data Analysts"
                            value="analysts"
                        />
                        <MultiSelectOption
                            label="Reviewers"
                            value="reviewers"
                        />
                    </MultiSelect>
                </Field>
            </Box>

            <Box marginBottom="16px">
                <Field label="Review & Publishing">
                    <MultiSelect
                        selected={settings.reviewRoles}
                        onChange={({ selected }) =>
                            setSettings({
                                ...settings,
                                reviewRoles: selected
                            })
                        }
                    >
                        <MultiSelectOption
                            label="Admin"
                            value="admin"
                        />
                        <MultiSelectOption
                            label="Health Officers"
                            value="officers"
                        />
                    </MultiSelect>
                </Field>
            </Box>

            <Field label="Configuration Access">
                <MultiSelect
                    selected={settings.configRoles}
                    onChange={({ selected }) =>
                        setSettings({
                            ...settings,
                            configRoles: selected
                        })
                    }
                >
                    <MultiSelectOption
                        label="Settings Admin"
                        value="s_admin"
                    />
                </MultiSelect>
            </Field>
        </SettingsSection>
    );
};