import React from 'react'
import i18n from '@dhis2/d2-i18n'
import AddIcon from "@mui/icons-material/Add"
import { CircularLoader, Layer, Center, IconError24 } from '@dhis2/ui'
import dataQuery from './services/engines/dataQuery'
import { homeDataQuery } from './services/getHomeData'
import {
    bulletinStatus,
    isPublished,
    selectDraftBulletins,
    selectPublishedBulletins,
} from '../utils/bulletinList'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAccess } from '../context/AccessContext'

const HomePage = ({ style }) => {
    const { loading, error, data, refetch } = dataQuery(homeDataQuery)
    const { canDraft } = useAccess()

    const location = useLocation()
    const navigate = useNavigate()

    const [organisationUnit, setOrganisationUnit] = React.useState(null)
    const [bulletins, setBulletins] = React.useState([])

    // The two lists are the same records split by whether they have been
    // published: Home holds the drafts, Archived Bulletins the published ones.
    // The two routes render this same component, so which list it is comes from
    // the route rather than from two code paths.
    const isArchive = location.pathname === '/archived-bulletins'

    React.useEffect(() => {
        if (data) {
            console.log('Fetched Data:', data)
            setBulletins(isArchive
                ? selectPublishedBulletins(data?.dataStore)
                : selectDraftBulletins(data?.dataStore))
            setOrganisationUnit(data?.organisationUnits)
        }
        // Navigating between the two routes reuses this instance rather than
        // remounting it, so the effect has to re-run on the route as well.
    }, [data, isArchive])

    // A save in the editor lands here, and what was just saved is what the
    // officer came back to look at, so the list is fetched again on arrival
    // rather than left to whatever the query returned on mount.
    React.useEffect(() => {
        if (location.state?.refresh) refetch()
    }, [location.state, refetch])

    // Helper to find Organisation Unit name by ID
    const getOrgUnitName = (ouId) => {
        if (!ouId) return i18n.t('Unknown Unit')
        const units = Array.isArray(organisationUnit) 
            ? organisationUnit 
            : organisationUnit?.organisationUnits || []
            
        const unit = units.find(item => item.id === ouId)
        return unit?.displayName || unit?.name || ouId
    }

    // Helper to format DHIS2 Period strings (e.g., "202606" -> "June 2026")
    const formatPeriod = (pe) => {
        if (!pe) return i18n.t('N/A')
        if (/^\d{6}$/.test(pe)) {
            const year = pe.slice(0, 4)
            const monthIndex = parseInt(pe.slice(4, 6), 10) - 1
            const date = new Date(year, monthIndex)
            return date.toLocaleString('default', { month: 'long', year: 'numeric' })
        }
        return pe
    }

    // The loader is for having nothing to show, not for fetching: arriving from
    // a save fetches the list again, and replacing the page with a spinner hides
    // the bulletin that was just added for as long as that takes.
    if (loading && !data) {
        return (
            <Layer translucent>
                <Center>
                    <CircularLoader />
                </Center>
            </Layer>
        )
    }

    return (
        <main className={style.main}>
            <header className={style.header}>
                <div className={style.titleSection}>
                    <h1>{isArchive ? i18n.t('Archived Bulletins') : i18n.t('Home')}</h1>
                    <p>{i18n.t('Welcome to your bulletin management dashboard.')}</p>
                </div>
                {canDraft && !isArchive && (
                    <button
                        className={style.buttonPrimary}
                        onClick={() => window.location.hash = '/new-bulletin'}
                    >
                        <AddIcon fontSize="small" /> {i18n.t('New Bulletin')}
                    </button>
                )}
            </header>

            {error ? (
                <div
                    style={{
                        border: "1px dashed #cbd5e1",
                        padding: "32px",
                        textAlign: "center",
                        borderRadius: "8px",
                        backgroundColor: "#f8fafc",
                    }}
                >
                    <span
                        style={{
                            display: "inline-block",
                            transform: "scale(2)",
                            color: "#9CA3AF",
                            marginBottom: "16px",
                        }}
                    >
                        <IconError24 />
                    </span>
                    <p style={{ fontSize: "15px", color: "#4B5563" }}>
                        {i18n.t("No bulletins found. Please check your data store or create a new bulletin.")}
                    </p>
                </div>
            ) : (
                <div className={style.tableContainer}>
                    <table className={style.table}>
                        <thead>
                            <tr>
                                <th className={style.th}>{i18n.t('Organisation Unit')}</th>
                                <th className={style.th}>{i18n.t('Period')}</th>
                                <th className={style.th}>{i18n.t('Status')}</th>
                                {!isArchive && (
                                    <th className={style.th}>{i18n.t('Actions')}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {bulletins && bulletins.length > 0 ? (
                                bulletins.map((bulletin) => {
                                    // Extract period from cases array structure: cases[0][0][1]
                                    const rawPeriod = bulletin.cases?.[0]?.[0]?.[1]
                                    const periodDisplay = formatPeriod(rawPeriod)
                                    const orgUnitName = getOrgUnitName(bulletin.organisationUnit)
                                    const status = bulletinStatus(bulletin)

                                    return (
                                        <tr 
                                            key={bulletin.id || bulletin.organisationUnit}
                                            onClick={() => navigate(`/bulletin/${bulletin.id}`)}
                                            style={{ cursor: 'pointer' }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                                        >
                                            <td className={style.td}>{orgUnitName}</td>
                                            <td className={style.td}>{periodDisplay}</td>
                                            <td className={style.td}>
                                                <span className={status === 'draft' ? style.statusDraft : style.statusSubmitted}>
                                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                                </span>
                                            </td>
                                            {!isArchive && (
                                                <td className={style.td}>
                                                    {canDraft && !isPublished(bulletin) && (
                                                        <button
                                                            className={style.buttonSecondary}
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                navigate(`/edit-bulletin/${bulletin.id}`)
                                                            }}
                                                            style={{ padding: '6px 10px', borderRadius: '6px' }}
                                                        >
                                                            {i18n.t('Edit')}
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan="4" className={style.td} style={{ textAlign: 'center', color: '#6B7280' }}>
                                        {i18n.t('No bulletins available.')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    )
}

export default HomePage