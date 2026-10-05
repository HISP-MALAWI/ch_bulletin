import React from 'react';
import { AlertBar, Field, SingleSelectField, SingleSelectOption } from '@dhis2/ui';
import { dataElementsQuery } from '../Pages/services/getDataelemente';
import dataQuery from '../Pages/services/engines/dataQuery';
import { SettingsSection } from './settingsSectionWidget';

export const SeasonalForecastWidget = ({ styles, settings, setSettings }) => {
    const { data, error, loading } = dataQuery(dataElementsQuery);
    const dataElements = data?.dataElements?.dataElements || [];
    const getSelectedDataElement = value =>
        dataElements.some(dataElement => dataElement.id === value)
            ? value
            : undefined;

    const handleDataElementChange = (key, selected) => {
        setSettings(prev => ({
            ...prev,
            [key]: selected
        }));
    };

    return (
        <SettingsSection
            step="2"
            title="Climate Data"
            subtitle="Select the data elements used for the seasonal forecast."
            styles={styles}
        >
            <Field label="HistoricalRainfall">
                <SingleSelectField
                    selected={getSelectedDataElement(settings.rainfallDataElement)}
                    onChange={({ selected }) =>
                        handleDataElementChange('rainfallDataElement', selected)
                    }
                    disabled={loading || Boolean(error)}
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

            <Field label="Historical Temperature">
                <SingleSelectField
                    selected={getSelectedDataElement(settings.temperatureDataElement)}
                    onChange={({ selected }) =>
                        handleDataElementChange('temperatureDataElement', selected)
                    }
                    disabled={loading || Boolean(error)}
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

            <Field label="Rainfall Forecast">
                <SingleSelectField
                    selected={getSelectedDataElement(settings.rainfallForecast)}
                    onChange={({ selected }) =>
                        handleDataElementChange('rainfallForecast', selected)
                    }
                    disabled={loading || Boolean(error)}
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

             <Field label="Rainfall forecast class">
                <SingleSelectField
                    selected={getSelectedDataElement(settings.rainfallForecastClass)}
                    onChange={({ selected }) =>
                        handleDataElementChange('rainfallForecastClass', selected)
                    }
                    disabled={loading || Boolean(error)}
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

            <Field label="Temperature Forecast">
                <SingleSelectField
                    selected={getSelectedDataElement(settings.temperatureForecast)}
                    onChange={({ selected }) =>
                        handleDataElementChange('temperatureForecast', selected)
                    }
                    disabled={loading || Boolean(error)}
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
            <Field label="Temperature forecast class">
                <SingleSelectField
                    selected={getSelectedDataElement(settings.temperatureForecastClass)}
                    onChange={({ selected }) =>
                        handleDataElementChange('temperatureForecastClass', selected)
                    }
                    disabled={loading || Boolean(error)}
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
            {error && (
                <AlertBar critical>
                    Unable to load data elements. Please refresh the page and try again.
                </AlertBar>
            )}
        </SettingsSection>
    );
};