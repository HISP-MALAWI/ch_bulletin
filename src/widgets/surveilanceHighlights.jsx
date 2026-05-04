import React from 'react';
import { 
    Table, 
    TableHead, 
    TableRowHead, 
    TableCellHead, 
    TableBody, 
    TableRow, 
    TableCell 
} from '@dhis2/ui';

const HealthCasesWidget = ({ style, step, title, description, cases = [] }) => {
    return (
        <div> {/* Wrapper for texture */}
            <div className={style.sectionHeader}>
                <div className={style.stepBadge}>{step}</div> {/* Use prop */}
                <span className={style.sectionTitle}>{title}</span> {/* Use prop */}
                <span className={style.pill}>Auto-fetched from API</span>
            </div>
            {description && (
                            <p className={style.sectionSub}>{description}</p>
                        )}
            <Table>
                <TableHead>
                    <TableRowHead>
                        <TableCellHead>Disease</TableCellHead>
                        <TableCellHead>Number of Cases</TableCellHead>
                    </TableRowHead>
                </TableHead>
                <TableBody>
                    {Array.isArray(cases) && cases.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell>{item.disease}</TableCell>
                            <TableCell>{item.count.toLocaleString()}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export default HealthCasesWidget;