import React from 'react';
import { IconEdit24, IconDelete24, Button } from '@dhis2/ui';

export default function DataElementTable({ initialData, setDiseaseElements,setMappingEditRow, dataElements, setIsModalOpen }) {
  const rows = Array.isArray(initialData) ? initialData : [];

  const getName = (id) => {
    const element = dataElements?.find(de => de.id === id);
    return element ? element.displayName : id;
  }

  function ActionButton({ children, color, hoverColor, onClick, style: btnStyle }) {
    const [hover, setHover] = React.useState(false);
    return (
      <button
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={onClick}
        style={{
          background: 'none',
          border: 'none',
          color: hover ? hoverColor : color,
          cursor: 'pointer',
          padding: 0,
          marginLeft: btnStyle?.marginLeft || 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <div style={{
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      padding: '24px',
      background: '#F7F8F9',
      minHeight: '100%'
    }}>
      <div style={{ margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px'
        }}>
          <div>
            <h2 style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#1F2937',
              marginBottom: '2px',
              letterSpacing: '-0.01em'
            }}>
              Surveillance Data Elements
            </h2>
            <p style={{
              fontSize: '12.5px',
              color: '#6B7280',
              margin: 0
            }}>
              Configured indicators and their linked alarm thresholds
            </p>
          </div>
          <Button
            primary
            onClick={() => setIsModalOpen(true)}
          >
            + Add Disease Element
          </Button>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(16,24,40,0.04)'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px'
          }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                <th style={thStyle}>Display Name</th>
                <th style={thStyle}>Data Element ID</th>
                <th style={thStyle}>Alarm Element ID</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{
                  borderTop: '1px solid #F1F2F4'
                }}>
                  <td style={{ ...tdStyle, fontWeight: 500, color: '#111827' }}>
                    {row.displayName}
                  </td>
                  <td style={tdStyle}>
                    <code style={codeStyle}>{getName(row.dataElement)}</code>
                  </td>
                  <td style={tdStyle}>
                    <code style={codeStyle}>{getName(row.alarmElement)}</code>
                  </td>
                  <td style={tdStyle}>
                    <ActionButton
                      color="#3B82F6"
                      hoverColor="#1E40AF"
                      onClick={() => {
                        setMappingEditRow(row)
                        setIsModalOpen(true)
                      }}
                      style={{ marginLeft: '8px' }}
                    >
                      <IconEdit24 />
                    </ActionButton>
                    <ActionButton
                      color="#EF4444"
                      hoverColor="#B91C1C"
                      onClick={() => {
                        setDiseaseElements(prev => prev.filter(item => item.dataElement !== row.dataElement));
                        console.log('Delete action for:', row);
                      }}
                      style={{ marginLeft: '8px' }}
                    >
                      <IconDelete24 />
                    </ActionButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid #E5E7EB'
};

const tdStyle = {
  padding: '12px 16px',
  color: '#374151',
  verticalAlign: 'middle'
};

const codeStyle = {
  background: '#F3F4F6',
  color: '#4B5563',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '12px',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace'
};