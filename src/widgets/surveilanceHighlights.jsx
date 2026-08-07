import React from 'react';
import { 
    Table, TableHead, TableRowHead, TableCellHead, 
    TableBody, TableRow, TableCell,Tag, IconWarningFilled16 
} from '@dhis2/ui';


const PredictionCell = ({ value }) => {
    const isOutbreak = Number(value) === 1

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Tag positive={!isOutbreak} negative={isOutbreak}>
                {isOutbreak ? 'Outbreak expected' : 'No outbreak'}
            </Tag>
        </div>
    )
}

const HealthCasesWidget = ({ style, step, title, description, dataValues = [], mapping }) => {
    
    
    const getValue = (dataElement) => {
        const arr = dataValues?.findLast(row => row[0] === dataElement);
        return arr?.at(-1) ?? 0; 
    }

    return (
        <div>
            <div className={style.sectionHeader}>
                <div className={style.stepBadge}>{step}</div>
                <span className={style.sectionTitle}>{title}</span>
            </div>
            
            {description && <p className={style.sectionSub}>{description}</p>}
            
            <Table>
                <TableHead>
                    <TableRowHead>
                        <TableCellHead></TableCellHead>
                        <TableCellHead>Disease</TableCellHead>
                        <TableCellHead>Number of Cases</TableCellHead>
                        <TableCellHead>Outbreak Predictions</TableCellHead>
                    </TableRowHead>
                </TableHead>
                <TableBody>
                    {Array.isArray(mapping) && mapping.map((item) => (
                         <TableRow key={item.dataElement}>
                                <TableCell><img src={item.iconURL} height={40} /></TableCell>
                                <TableCell>{item.displayName}</TableCell>
                                <TableCell>{getValue(item.dataElement)}</TableCell>
                                <TableCell>
                                    <PredictionCell value={getValue(item.alarmElement)} />
                                </TableCell>
                            </TableRow>
                        
                    ))}
                    </TableBody>
            </Table>
        </div>
    );
};

export default HealthCasesWidget;