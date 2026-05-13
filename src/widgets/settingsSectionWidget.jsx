import React, { useState } from 'react';


export const SettingsSection = ({
    step,
    title,
    subtitle,
    children,
    pill,
    styles
}) => (
    <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
            <span className={styles.stepBadge}>{step}</span>

            <h3 className={styles.sectionTitle}>
                {title}
            </h3>

            {pill && (
                <span className={styles.pill}>
                    {pill}
                </span>
            )}
        </div>

        <p className={styles.sectionSub}>
            {subtitle}
        </p>

        {children}
    </section>
);