import React from 'react';
import i18n from '@dhis2/d2-i18n';
import { Button, Switch, Table, TableHead, TableRowHead, TableCellHead, TableBody, TableRow, TableCell } from '@dhis2/ui';
import SaveIcon from '@mui/icons-material/Save';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AddIcon from '@mui/icons-material/Add';
import HighlightsInput from '../widgets/highlightsInput';
import HealthCasesWidget from '../widgets/surveilanceHighlights';
import ForecastWidget from '../widgets/forecastWidget';
import AdvisoriesWidget from '../widgets/advisoriesWidget';

const BulletinForm = ({style}) => {

    const [advisories, setAdvisories] = React.useState([]);
    const [cases, setCases] = React.useState([
        { disease: 'Malaria', count: 1500 },
        { disease: 'Dengue', count: 300 },
        { disease: 'Cholera', count: 120 },
    ]);
    const [highlights, setHighlights] = React.useState('');
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
                    <HighlightsInput style={style} step="1" title="Highlights" description="Key takeaways for the bulletin." highlights={highlights} setHighlights={setHighlights} />
                </section>

                {/* 2. Recorded Health Cases */}
                <section className={style.sectionCard}>
                    <HealthCasesWidget cases={cases} style={style} step="2" title="Recorded Health Cases" description="Summary of recorded health cases." />
                </section>

                {/* 3. Weather Forecast */}
                <section className={style.sectionCard}>
                    <ForecastWidget style={style} step="3" title="Weather Forecast" description="Upcoming weather conditions." />
                </section>

                {/* 4. Health Advisories */}
                <section className={`${style.sectionCard} ${style.fullWidth}`}>
                    
                    <AdvisoriesWidget style={style} advisories={advisories} setAdvisories={setAdvisories} step="4" title="Health Advisories" description="Important health advisories for the region." />
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