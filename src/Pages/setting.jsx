import React, { useState,useEffect } from 'react';
import { 
    Box, Field, Button, InputField, MultiSelect, 
    MultiSelectOption, ButtonStrip, Help 
} from '@dhis2/ui';
import { DiseaseMappingWidget } from '../widgets/diseasemappingWIdget';
import { AccessWorkflowWidget } from '../widgets/accessWidget';
import { DistributionWidget } from '../widgets/distributionWIdget';
import { RolesQuery } from './services/getRoles';
import dataQuery from '../Pages/services/engines/dataQuery';

const SettingsPage = ({styles}) => {

    // State management for form values
    const [settings, setSettings] = useState({
        titlePrefix: 'Climate & Health Bulletin',
        generationRoles: ['analysts'],
        reviewRoles: ['admin'],
        configRoles: ['s_admin']
    });

    const {error,loading,data} = dataQuery(RolesQuery);

    useEffect(() => {
            console.log('Roles data:', data?.userRoles?.userRoles);
            console.log('Groups data:', data?.userGroups?.userGroups);
        },[data]);
    
    
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
                <DiseaseMappingWidget styles={styles} />

                {/* SECTION 2: ACCESS & WORKFLOW */}
                <AccessWorkflowWidget roles={[...data?.userRoles?.userRoles, ...data?.userGroups?.userGroups]} styles={styles} settings={settings} setSettings={setSettings} />

                {/* SECTION 3: DISTRIBUTION */}
                <DistributionWidget styles={styles} />

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
                    </Box>
                </section>
            </div>

            {/* Footer Actions */}
            <div className={styles.footerActions}>
                <Button secondary>Cancel Changes</Button>
                <Button primary onClick={() => console.log('Saving:', settings)}>
                    Save Configurations
                </Button>
            </div>
        </div>
    );
};

export default SettingsPage;