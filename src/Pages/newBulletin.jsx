import React from 'react';
import i18n from '@dhis2/d2-i18n';
import { Button, Switch, Table, TableHead, TableRowHead, TableCellHead, TableBody, TableRow, TableCell } from '@dhis2/ui';
import SaveIcon from '@mui/icons-material/Save';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import HighlightsInput from '../widgets/highlightsInput';
import HealthCasesWidget from '../widgets/surveilanceHighlights';
import ForecastWidget from '../widgets/forecastWidget';

const BulletinForm = ({style}) => {
    return (
        <div className={style.main}>
            {/* Header Area */}
            <div className={style.header}>
                <div className={style.titleSection}>
                    <h1 style={{fontSize: '28px'}}>Climate & Health Bulletin</h1>
                    <p>Bridging Weather & Wellness For a Healthier Malawi</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {/* Region and Date Pickers would go here */}
                </div>
            </div>

            <div className={style.formGrid}>
                
                {/* 1. Highlights Section */}
                <section className={`${style.sectionCard} ${style.fullWidth}`}>
                    <HighlightsInput style={style} step="1" title="Highlights" description="Key takeaways for the bulletin."/>
                </section>

                {/* 2. Recorded Health Cases */}
                <section className={style.sectionCard}>
                    <HealthCasesWidget style={style} step="2" title="Recorded Health Cases" />
                </section>

                {/* 3. Weather Forecast */}
                <section className={style.sectionCard}>
                    <ForecastWidget style={style} step="3" title="Weather Forecast" />
                </section>

                {/* 4. Health Advisories */}
                <section className={`${style.sectionCard} ${style.fullWidth}`}>
                    <div className={style.sectionHeader}>
                        <div className={style.stepBadge}>4</div>
                        <span className={style.sectionTitle}>Health advisories</span>
                    </div>
                    <div className={style.advisoryList}>
                        {['Stay warm', 'Drink more water'].map((text, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', border: '1px solid #e2e8f0', marginBottom: '8px', borderRadius: '6px' }}>
                                <span>{text}</span>
                                <DeleteIcon style={{ color: '#ef4444', cursor: 'pointer' }} fontSize="small" />
                            </div>
                        ))}
                        <button className={style.addAdvisory} style={{ width: '100%', padding: '10px', border: '1px dashed #3b82f6', background: '#eff6ff', color: '#3b82f6', borderRadius: '6px', cursor: 'pointer' }}>
                            <AddIcon fontSize="small" /> Add Advisory
                        </button>
                    </div>
                </section>
            </div>

            {/* Form Footer Actions */}
            <footer className={style.footerActions}>
                <Button icon={<SaveIcon />} secondary>{i18n.t('Save Draft')}</Button>
                <Button icon={<PictureAsPdfIcon />} primary>{i18n.t('Generate Bulletin (PDF)')}</Button>
            </footer>
        </div>
    );
};

export default BulletinForm;