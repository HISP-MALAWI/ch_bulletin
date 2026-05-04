import React from 'react'
import i18n from '@dhis2/d2-i18n'
import AddIcon from "@mui/icons-material/Add"

const HomePage = ({style}) => {
    return (
        <main className={style.main}>
            <header className={style.header}>
                <div className={style.titleSection}>
                    <h1>{i18n.t('Home')}</h1>
                    <p>{i18n.t('Welcome to your bulletin management dashboard.')}</p>
                </div>
                <button className={style.buttonPrimary}
                    onClick={() => window.location.hash = '/new-bulletin'}
                >
                    <AddIcon fontSize="small" /> {i18n.t('New Bulletin')}
                </button>
            </header>

            <div className={style.tableContainer}>
                <table className={style.table}>
                    <thead>
                        <tr>
                            <th className={style.th}>Draft Title</th>
                            <th className={style.th}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className={style.td}>Climate & Health Bulletin - May 2026</td>
                            <td className={style.td}>
                                <span className={style.statusDraft}>Draft</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </main>
    )
}

export default HomePage;