import React, { useState, useEffect } from 'react';
import {
    Button,
} from '@dhis2/ui';
import { SettingsSection } from './settingsSectionWidget';
import dataQuery from '../Pages/services/engines/dataQuery';
import { dataElementsQuery } from '../Pages/services/getDataelemente';
import { DiseaseMappingModal } from './demappingWidget';
import DataElementTable from './dataTableWidget';

export const DiseaseMappingWidget = ({ styles, diseaseElements, setDiseaseElements, }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
        const {data,error,loading} = dataQuery(dataElementsQuery);
        const [diseaseElementsData, setDiseaseElementsData] = useState([]);

        const [mappingEditRow, setMappingEditRow] = useState(null);

    useEffect(() => { 
        setDiseaseElementsData(data?.dataElements?.dataElements || []);
    },[data])
    
    return (
        <SettingsSection
            step="1"
            title="Disease Mapping Parameters"
            subtitle="Manage data elements and their display aliases."
            styles={styles}
        >
           {diseaseElements?.length === 0 ? 
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
                    onClick={() => setIsModalOpen(true)}
                >
                    + Add Disease Element
                </Button>
            </div> 
            : 
            <div>
                <DataElementTable initialData={diseaseElements} setMappingEditRow={setMappingEditRow} setDiseaseElements={setDiseaseElements} key={diseaseElements.length} dataElements={diseaseElementsData} setIsModalOpen={setIsModalOpen} />
                </div>}
            {/* Modal for adding/editing disease mappings */}
            {isModalOpen && (
                <DiseaseMappingModal
                    onClose={() => setIsModalOpen(false)}
                    mappingEditRow={mappingEditRow}
                    setMappingEditRow={setMappingEditRow}
                    onSave={(formData, isEditMode) => {
                        if (isEditMode) {
                            setDiseaseElements(prev => prev.map(item => item.id === formData.id ? formData : item));
                        } else {
                            setDiseaseElements(prev => [...prev, formData]);
                        }
                        setMappingEditRow(null);
                        setIsModalOpen(false);
                    }}
                    dataElements={diseaseElementsData || []}
                />
            )}
        </SettingsSection>
    );
};