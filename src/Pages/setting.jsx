import React, { useState,useEffect } from 'react';
import { 
    Box, Field, Button, InputField, MultiSelect, 
    MultiSelectOption, ButtonStrip, Help, 
    Layer,
    CircularLoader,
    AlertBar
} from '@dhis2/ui';
import { DiseaseMappingWidget } from '../widgets/diseasemappingWIdget';
import { AccessWorkflowWidget } from '../widgets/accessWidget';
import { DistributionWidget } from '../widgets/distributionWIdget';
import { RolesQuery } from './services/getRoles';
import { dataSettingsStoreQuery } from './services/getSettingsStore';
import { dataStoreQuery } from './services/getDataSoreItem';
import dataQuery from '../Pages/services/engines/dataQuery';
import saveSettings from '../utils/saveSettings';
import { useDataEngine } from '@dhis2/app-runtime';
import { useAccess } from '../context/AccessContext';


const SettingsPage = ({styles}) => {

    const [diseaseElementsMapping, setdiseaseElementsMapping] = useState([]);
    // State management for form values
    const [settings, setSettings] = useState({
        titlePrefix: 'Climate & Health Bulletin',
        generationRoles: [],
        mapping : diseaseElementsMapping,
        reviewRoles: [],
        configRoles: [],
        distributionRoles: []
    });

    // State management for save operations
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [saveStatus, setSaveStatus] = useState(null); // 'success', 'error', or null

    const {error,loading,data} = dataQuery(RolesQuery);
    const {loading: dataStoreLoading, data: dataStore, error: dataStoreError} = dataQuery(dataStoreQuery);
    const {loading: settingsLoading, data: settingsData, error: settingsError} = dataQuery(dataSettingsStoreQuery);
    const engine = useDataEngine();
    const { canConfigure } = useAccess();
    
    useEffect(() => {
        setSettings(prevSettings => ({
            ...prevSettings,
            mapping: diseaseElementsMapping
        }));
    }, [diseaseElementsMapping]);

    useEffect(() => {
        if(settingsData){
            setSettings(prevSettings => ({
                ...prevSettings,
                ...settingsData?.dataStore
            }));
            setdiseaseElementsMapping(settingsData?.dataStore?.mapping || []);
        }
    }, [settingsData]);

    if (loading || dataStoreLoading || settingsLoading) return (
    <Layer
        dataTest="dhis2-uicore-layer"
        level="auto"
        position="fixed"
        translucent
    >
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%'
        }}>
            <CircularLoader />
        </div>
    </Layer>
);

    return (
        <div className={styles.main}>
            {/* Header Section */}
            <header className={styles.header}>
                <div className={styles.titleSection}>
                    <h1>Bulletin Configuration</h1>
                    <p>Define data mappings, user permissions, and global defaults.</p>
                </div>
            </header>

            {/* Main Form Grid */}
            <div >
                
                {/* SECTION 1: DISEASE MAPPING */}
                <DiseaseMappingWidget styles={styles} diseaseElements={diseaseElementsMapping} setDiseaseElements={setdiseaseElementsMapping} />

                {/* SECTION 2: ACCESS & WORKFLOW */}
                <AccessWorkflowWidget roles={[
                        ...(data?.userRoles?.userRoles || []), 
                        ...(data?.userGroups?.userGroups || [])
                    ]} styles={styles} settings={settings} setSettings={setSettings} />

                {/* SECTION 3: DISTRIBUTION */}
                <DistributionWidget group={data?.userGroups?.userGroups} setSettings={setSettings} settings={settings} styles={styles} />

                {/* SECTION 4: GLOBAL SETTINGS */}
                <section className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                        <span className={styles.stepBadge}>4</span>
                        <h3 className={styles.sectionTitle}>Global Settings</h3>
                    </div>
                    <p className={styles.sectionSub}>General app-wide defaults.</p>
                    
                    <Box marginBottom="16px">
                        <Field label="Bulletin Title Prefix">
                            <InputField 
                                value={settings.titlePrefix}
                                onChange={({ value }) => setSettings({...settings, titlePrefix: value})}
                            />
                        </Field>
                        <Field label="Bulletin display icon">
                            <InputField 
                                value={settings.displayIcon}
                                onChange={({ value }) => setSettings({...settings, displayIcon: value})}
                            />
                        </Field>
                    </Box>
                </section>
            </div>

            {/* Footer Actions */}
            <div className={styles.footerActions}>
                {isSaving && (
                    <Layer
                        dataTest="dhis2-uicore-layer"
                        level="auto"
                        position="fixed"
                        translucent
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            width: '100%'
                        }}>
                            <CircularLoader />
                        </div>
                    </Layer>
                )}
                
                {saveStatus === 'success' && (
                    <AlertBar success permanent={false}>
                        {saveMessage || 'Settings saved successfully!'}
                    </AlertBar>
                )}
                
                
                
                <Button primary disabled={isSaving || !canConfigure} onClick={async () => {
                    if (!canConfigure) {
                        setSaveStatus('error');
                        setSaveMessage('You do not have permission to change configurations.');
                        return;
                    }

                    setIsSaving(true);
                    setSaveStatus(null);
                    setSaveMessage('');
                    
                    try {
                        await saveSettings(settings, dataStoreError, engine);
                        setSaveStatus('success');
                        setSaveMessage('Settings saved successfully!');
                        // Auto-hide success alert after 5 seconds
                        setTimeout(() => setSaveStatus(null), 5000);
                    } catch (error) {
                        setSaveStatus('error');
                        setSaveMessage(error?.message || 'Error saving settings. Please try again.');
                        console.error('Save settings error:', error);
                    } finally {
                        setIsSaving(false);
                    }
                }}>
                    Save Configurations
                </Button>
            </div>
            {saveStatus === 'error' && (
                    
                    <AlertBar critical permanent={false}>
                        {saveMessage || 'Error saving settings. Please try again.'}
                    </AlertBar>
                )}
        </div>
    );
};

export default SettingsPage;