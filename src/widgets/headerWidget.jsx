import React, { useState } from 'react';
import OrgUnitTreeWidget from './orgunitTreeWidget';
import { MapPin, Calendar, RefreshCw, ChevronDown } from 'lucide-react';

const DashboardHeader = ({
  style,
  period,
  setPeriod,
  organisationUnit,
  setOrganisation,
  orgUnits = [],
  orgUnitsLoading,
  orgUnitsError,
}) => {
  const [showModal, setShowModal] = useState(false);

  const [selectedOrgUnit, setSelectedOrgUnit] = useState(null);
  
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

  React.useEffect(()=>{
    setPeriod(getLast12Months()[0].value)
  },[])

  const getOrgUnitNameById = (id) => {
    const orgUnit = orgUnits.find(unit => unit.id === id);
    return orgUnit ? orgUnit.displayName : 'Select Region';
  }

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
          <span className={style.selectorLabel}>{getOrgUnitNameById(organisationUnit)}</span>
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
              <OrgUnitTreeWidget
                loading={orgUnitsLoading}
                error={orgUnitsError}
                orgUnits={orgUnits}
                setSelectedOrgUnit={setSelectedOrgUnit}
              />
            <button className={style.buttonPrimary} style={{width: '100%', justifyContent: 'center', marginTop: '16px'}} onClick={() => {
              setOrganisation(selectedOrgUnit);
              setShowModal(false);
            }}>
              Confirm Selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;