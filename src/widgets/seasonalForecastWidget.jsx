import React from 'react';
import { Field, SingleSelectField, SingleSelectOption } from '@dhis2/ui';
import { dataElementsQuery } from '../Pages/services/getDataelemente';
import dataQuery from '../Pages/services/engines/dataQuery';
import { SettingsSection } from './settingsSectionWidget';

export const SeasonalForecastWidget = ({ styles, settings, setSettings }) => {
    const { data } = dataQuery(dataElementsQuery);
    const dataElements = data?.dataElements?.dataElements || [];

    const handleDataElementChange = (key, selected) => {
        setSettings(prev => ({
            ...prev,
            [key]: selected
        }));
    };

    return (
        <SettingsSection
            step="3"
            title="Seasonal forecast"
            subtitle="Select the data elements used for the seasonal forecast."
            styles={styles}
        >
            <Field label="Rainfall">
                <SingleSelectField
                    selected={settings.rainfallDataElement}
                    onChange={({ selected }) =>
                        handleDataElementChange('rainfallDataElement', selected)
                    }
                    filterable
                >
                    {dataElements.map(dataElement => (
                        <SingleSelectOption
                            key={dataElement.id}
                            label={dataElement.displayName}
                            value={dataElement.id}
                        />
                    ))}
                </SingleSelectField>
            </Field>

            <Field label="Temperature">
                <SingleSelectField
                    selected={settings.temperatureDataElement}
                    onChange={({ selected }) =>
                        handleDataElementChange('temperatureDataElement', selected)
                    }
                    filterable
                >
                    {dataElements.map(dataElement => (
                        <SingleSelectOption
                            key={dataElement.id}
                            label={dataElement.displayName}
                            value={dataElement.id}
                        />
                    ))}
                </SingleSelectField>
            </Field>
        </SettingsSection>
    );
};