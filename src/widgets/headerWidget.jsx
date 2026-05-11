import React, { useState } from 'react';
import OrgUnitTreeWidget from './orgunitTreeWidget';
import { MapPin, Calendar, RefreshCw, ChevronDown } from 'lucide-react';
import dataQuery from '../Pages/services/engines/dataQuery';
import { OrganisationUnitQuery } from '../Pages/services/getOrganisationUnits';

const DashboardHeader = ({style, period,setPeriod,organisationUnit,setOrganisation}) => {
  const [showModal, setShowModal] = useState(false);

  const { loading, error, data } = dataQuery(OrganisationUnitQuery);

  const getLast12Months = () => {
  const months = [];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    
    const monthName = monthNames[d.getMonth()];
    const year = d.getFullYear();
    const monthValue = String(d.getMonth() + 1).padStart(2, '0');
    
    months.push({
      name: `${monthName} ${year}`,
      value: `${year}${monthValue}`
    });
  }
  
  return months;
};



  return (
    <div className={style.header}>
      <div className={style.titleSection}>
        <h1>Climate & Health Bulletin</h1>
        <p>Bridging Weather & Wellness For a Healthier Malawi</p>
      </div>

      <div className={style.controlsGroup}>
        
        {/* Region Selector - Opens Modal */}
        <button className={style.selectorControl} onClick={() => setShowModal(true)}>
          <MapPin size={18} color="#64748b" />
          Central Region
          <ChevronDown size={16} color="#94a3b8" />
        </button>

        {/* Period Dropdown */}
        <div className={style.selectorControl}>
          <Calendar size={18} color="#64748b" />
          <select className={style.monthSelect} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {getLast12Months().map((month, index) => (
              <option key={index} value={month.value}>
                {month.name}
              </option>
            ))}
          </select>
        </div>

        </div>

      {/* Region Selection Modal */}
      {showModal && (
        <div className={style.modalBackdrop} onClick={() => setShowModal(false)}>
          <div className={style.modalContent} onClick={e => e.stopPropagation()}>
            <h2 className={style.sectionTitle}>Select Region</h2>
            <p className={style.sectionSub}>Choose a specific region for data filtering.</p>
              <OrgUnitTreeWidget loading={loading} error={error} data={data} />
            <button className={style.buttonPrimary} onClick={() => setShowModal(false)} style={{width: '100%', justifyContent: 'center', marginTop: '16px'}}>
              Confirm Selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;