import React from 'react';
import { 
    Table, TableHead, TableRowHead, TableCellHead, 
    TableBody, TableRow, TableCell 
} from '@dhis2/ui';

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
                    </TableRowHead>
                </TableHead>
                <TableBody>
                    {Array.isArray(mapping) && mapping.map((item) => (
                         <TableRow key={item.dataElement}>
                                <TableCell><img src={item.iconURL} height={40} /></TableCell>
                                <TableCell>{item.displayName}</TableCell>
                                <TableCell>{getValue(item.dataElement)}</TableCell>
                            </TableRow>
                        
                    ))}
                    </TableBody>
            </Table>
        </div>
    );
};

export default HealthCasesWidget;