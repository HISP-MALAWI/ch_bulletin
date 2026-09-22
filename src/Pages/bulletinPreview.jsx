import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import i18n from '@dhis2/d2-i18n'
import { CircularLoader, Layer, Center, IconError24, Button, ButtonStrip, AlertBar } from '@dhis2/ui'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PublishIcon from '@mui/icons-material/Publish'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import dataQuery from './services/engines/dataQuery'
import HealthCasesWidget from '../widgets/surveilanceHighlights'
import ForecastWidget from '../widgets/forecastWidget'
import { CheckCircle } from 'lucide-react'
import { homeDataQuery } from './services/getHomeData'
import { dataSettingsStoreQuery } from './services/getSettingsStore'
import { useDataEngine } from '@dhis2/app-runtime'
import { NearMe } from '@mui/icons-material'
import { exportBulletinPdf, sanitiseFileName } from '../utils/bulletinPdf'
import { useAccess } from '../context/AccessContext'


const BulletinPreview = ({ style }) => {
    const { id } = useParams()
    const navigate = useNavigate()
    const engine = useDataEngine()
    const { canPublish } = useAccess()
    const contentRef = React.useRef(null)
    const [bulletin, setBulletin] = React.useState(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState(null)
    const [orgUnits, setOrgUnits] = React.useState([])
    const [user, setUser] = React.useState(null)
    const [isPublishing, setIsPublishing] = React.useState(false)
    const [isDownloading, setIsDownloading] = React.useState(false)
    const [publishMessage, setPublishMessage] = React.useState('')
    const [publishStatus, setPublishStatus] = React.useState(null)
    const [downloadMessage, setDownloadMessage] = React.useState('')
    const [downloadStatus, setDownloadStatus] = React.useState(null)

    const { loading: dataLoading, error: dataError, data } = dataQuery(homeDataQuery)
    // Mapping config lives in a separate datastore key from the bulletins list,
    // same query BulletinForm uses to build HealthCasesWidget's mapping.
    const { loading: settingsLoading, error: settingsError, data: settingsData } = dataQuery(dataSettingsStoreQuery)

    // Fetch bulletin data from dataStore
    React.useEffect(() => {
        if (dataLoading) return

        try {
            setLoading(true)

            const bulletinList = Array.isArray(data?.dataStore) ? data.dataStore : []
            const foundBulletin = bulletinList.find(item => item.id === id)

            if (!foundBulletin) {
                setError(i18n.t('Bulletin not found'))
                setLoading(false)
                return
            }

            setBulletin(foundBulletin)
            setOrgUnits(data?.organisationUnits || [])
            setUser(data?.me)
            setError(null)
            setLoading(false)
        } catch (err) {
            console.error('Error fetching bulletin:', err)
            setError(err.message || i18n.t('Failed to load bulletin'))
            setLoading(false)
        }
    }, [id, data, dataLoading])

    const handlePublish = async () => {
        if (!canPublish) {
            setPublishStatus('error')
            setPublishMessage(i18n.t('You do not have permission to publish bulletins'))

            setTimeout(() => {
                setPublishStatus(null)
                setPublishMessage('')
            }, 3000)
            return
        }

        try {
            setIsPublishing(true)
            
            // Update bulletin status to published
            const updatedBulletin = { ...bulletin, status: 'published' }
            
            // Get all bulletins
            const bulletinList = Array.isArray(data?.dataStore) ? data.dataStore : []
            const updatedList = bulletinList.map(item => item.id === id ? updatedBulletin : item)
            
            // Save to dataStore
            await engine.mutate({
                resource: 'dataStore/CH_Bulletin/draft_bulletin',
                type: 'update',
                data: updatedList
            })
            
            setBulletin(updatedBulletin)
            setPublishStatus('success')
            setPublishMessage(i18n.t('Bulletin published successfully'))
            
            setTimeout(() => {
                setPublishStatus(null)
                setPublishMessage('')
            }, 3000)
        } catch (err) {
            console.error('Error publishing bulletin:', err)
            setPublishStatus('error')
            setPublishMessage(err.message || i18n.t('Failed to publish bulletin'))
            
            setTimeout(() => {
                setPublishStatus(null)
                setPublishMessage('')
            }, 3000)
        } finally {
            setIsPublishing(false)
        }
    }

    // Helper to find Organisation Unit name by ID
    const getOrgUnitName = (ouId) => {
        if (!ouId) return i18n.t('Unknown Unit')
        const units = Array.isArray(orgUnits)
            ? orgUnits
            : orgUnits?.organisationUnits || []
        const unit = units.find(item => item.id === ouId)
        return unit?.displayName || unit?.name || ouId
    }

    // Helper to format DHIS2 Period strings (e.g., "202606" -> "June 2026")
    const formatPeriod = (period) => {
        if (!period || period.length !== 6) return period
        const year = period.slice(0, 4)
        const month = period.slice(4, 6)
        const monthNames = [
            i18n.t('January'),
            i18n.t('February'),
            i18n.t('March'),
            i18n.t('April'),
            i18n.t('May'),
            i18n.t('June'),
            i18n.t('July'),
            i18n.t('August'),
            i18n.t('September'),
            i18n.t('October'),
            i18n.t('November'),
            i18n.t('December'),
        ]
        return `${monthNames[parseInt(month) - 1]} ${year}`
    }

    // Helper to get status badge color
    const getStatusColor = (status) => {
        return status === 'published' ? '#10b981' : '#f59e0b'
    }

    const getStatusBgColor = (status) => {
        return status === 'published' ? '#d1fae5' : '#fef3c7'
    }

    const showDownloadMessage = (status, message) => {
        setDownloadStatus(status)
        setDownloadMessage(message)

        setTimeout(() => {
            setDownloadStatus(null)
            setDownloadMessage('')
        }, 5000)
    }

    const handleDownloadPDF = async () => {
        setIsDownloading(true)
        setDownloadMessage('')
        setDownloadStatus(null)

        try {
            const fileName = `${sanitiseFileName([
                'Bulletin',
                formatPeriod(bulletin.period),
                getOrgUnitName(bulletin.organisationUnit),
            ])}.pdf`

            const { droppedImages } = await exportBulletinPdf(contentRef.current, {
                fileName,
                title: `${i18n.t('Climate & Health Bulletin')} - ${formatPeriod(bulletin.period)}`,
            })

            if (droppedImages > 0) {
                showDownloadMessage(
                    'warning',
                    i18n.t(
                        'PDF downloaded, but {{count}} image(s) could not be included. Check the icon URLs in Settings.',
                        { count: droppedImages }
                    )
                )
            }
        } catch (err) {
            console.error('Error generating PDF:', err)
            showDownloadMessage(
                'error',
                err.message || i18n.t('Failed to generate the PDF')
            )
        } finally {
            setIsDownloading(false)
        }
    }

    if (dataLoading || settingsLoading || loading) {
        return (
            <Layer translucent>
                <Center>
                    <CircularLoader />
                </Center>
            </Layer>
        )
    }

    if (error || dataError || settingsError) {
        return (
            <Layer translucent>
                <Center>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <IconError24 />
                        <p>{error || dataError?.message || settingsError?.message}</p>
                        <Button onClick={() => navigate('/')}>
                            {i18n.t('Back to Home')}
                        </Button>
                    </div>
                </Center>
            </Layer>
        )
    }

    if (!bulletin) {
        return (
            <Layer>
                <Center>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <p>{i18n.t('No bulletin data available')}</p>
                        <Button onClick={() => navigate('/')}>
                            {i18n.t('Back to Home')}
                        </Button>
                    </div>
                </Center>
            </Layer>
        )
    }

    return (
        <main className={style.main}>
            {publishMessage && (
                <AlertBar style={{ marginBottom: '16px' }} complete={publishStatus === 'success'} permanent error={publishStatus === 'error'}>
                    {publishMessage}
                </AlertBar>
            )}

            {downloadMessage && (
                <AlertBar
                    style={{ marginBottom: '16px' }}
                    permanent
                    warning={downloadStatus === 'warning'}
                    critical={downloadStatus === 'error'}
                >
                    {downloadMessage}
                </AlertBar>
            )}

            <ButtonStrip style={{ marginBottom: '24px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} end>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Button 
                        onClick={handleDownloadPDF}
                        loading={isDownloading}
                        icon={<FileDownloadIcon />}
                    >
                        {i18n.t('Download PDF')}
                    </Button>
                    {bulletin?.status === 'draft' && canPublish && (
                        <Button
                            onClick={handlePublish}
                            loading={isPublishing}
                            icon={<NearMe />}
                            primary
                        >
                            {i18n.t('Publish')}
                        </Button>
                    )}
                </div>
                </ButtonStrip>

            <div ref={contentRef}>
            {/* Preview Header */}
            <div data-pdf-block style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '4px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    {/* Centres the title and tagline; the Organisation Unit /
                        Period row below is a flex container, so it keeps its
                        left alignment. */}
                    <div style={{ width: '100%', textAlign: 'center' }}>
                        <h1 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: 'bold' }}>
                            {i18n.t('Climate & Health Bulletin')}
                        </h1>
                        <p style={{ margin: '0 0 16px 0', color: '#6B7280', fontSize: '14px' }}>
                            {i18n.t('Bridging Weather & Wellness For a Healthier Malawi')}
                        </p>
                        <div style={{ display: 'flex', gap: '24px', textAlign: 'left' }}>
                            <div>
                                <span style={{ color: '#6B7280', fontSize: '12px' }}>{i18n.t('Organisation Unit')}</span>
                                <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: '500' }}>
                                    {getOrgUnitName(bulletin.organisationUnit)}
                                </p>
                            </div>
                            <div>
                                <span style={{ color: '#6B7280', fontSize: '12px' }}>{i18n.t('Period')}</span>
                                <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: '500' }}>
                                    {formatPeriod(bulletin.period)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 1. Highlights — now shown first, matching the numbered document order */}
            {bulletin.highlights && (
                <div data-pdf-block style={{ marginBottom: '24px', backgroundColor: '#fff', padding: '16px', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                        {i18n.t('1. Highlights')}
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: bulletin.highlights }} />
                </div>
            )}

            <div data-pdf-block style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '4px' }}>
                    <HealthCasesWidget
                        dataValues={Array.isArray(bulletin.cases?.[0]) ? bulletin.cases[0] : []}
                        mapping={settingsData?.dataStore?.mapping}
                        style={style}
                        step="2"
                        title={i18n.t('Recorded Health Cases')}
                        description={i18n.t('Summary of recorded health cases.')}
                    />
                </div>
                <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '4px' }}>
                    <ForecastWidget
                        forecast={bulletin.forecast || []}
                        organisationUnit={bulletin.organisationUnit}
                        period={bulletin.period}
                        style={style}
                        step="3"
                        title={i18n.t('Weather Forecast')}
                        description={i18n.t('Upcoming weather conditions.')}
                    />
                </div>
            </div>

            {bulletin.advisories && bulletin.advisories.length > 0 && (
                <div data-pdf-block style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '4px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#1e3a8a',
                            color: '#fff',
                            borderRadius: '50%',
                            fontWeight: 'bold',
                            fontSize: '16px'
                        }}>
                            4
                        </div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {i18n.t('Health Advisories')}
                        </h2>
                    </div>
                    <div>
                        {bulletin.advisories.map((advisory, index) => (
                            <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
                                <CheckCircle size={20} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
                                <span style={{ color: '#334155', fontSize: '14px', lineHeight: '1.5' }}>
                                    {advisory}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            </div>
        </main>
    )
}

export default BulletinPreview