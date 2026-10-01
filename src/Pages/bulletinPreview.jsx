import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import i18n from '@dhis2/d2-i18n'
import { CircularLoader, Layer, Center, IconError24, Button, ButtonStrip, AlertBar } from '@dhis2/ui'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PublishIcon from '@mui/icons-material/Publish'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import dataQuery from './services/engines/dataQuery'
import ForecastSummaryWidget from '../widgets/forecastSummaryWidget'
import SeasonalClimateChart from '../widgets/seasonalClimateChart'
import HealthCasesWidget from '../widgets/surveilanceHighlights'
import ForecastWidget from '../widgets/forecastWidget'
import { homeDataQuery } from './services/getHomeData'
import { dataSettingsStoreQuery } from './services/getSettingsStore'
import { useDataEngine } from '@dhis2/app-runtime'
import { NearMe } from '@mui/icons-material'
import { exportBulletinPdf, sanitiseFileName } from '../utils/bulletinPdf'
import { normaliseHighlightsHtml, hasHighlightsContent } from '../utils/highlightsHtml'
import { useAccess } from '../context/AccessContext'
import { BulletinSection } from '../widgets/bulletinSection'
import { describeForecastWindow } from '../utils/periodLabel'

const GENERATED_ON_FORMAT = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
})

// An executive summary line reads "September 2026: ...". The month leads it and
// is picked out in the accent colour. A line the author has rewritten without a
// colon simply comes back as one piece of text.
const splitSummaryLine = (line) => {
    const separator = line.indexOf(': ')

    return separator === -1
        ? { lead: null, rest: line }
        : { lead: line.slice(0, separator), rest: line.slice(separator) }
}

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

    // Both come from Global Settings, so they are available before the bulletin
    // loads and can be used by the download handler as well as the heading.
    const bulletinTitle =
        settingsData?.dataStore?.titlePrefix?.trim() || i18n.t('Climate & Health Bulletin')
    const displayIcon = settingsData?.dataStore?.displayIcon?.trim()

    // Bulletins saved before this ran hold Quill's own markup, in which a
    // bullet list is an <ol> with no bullet in it and a font is a class only
    // Quill's stylesheet understands, so the rewrite happens here as well as on
    // save. Display only: the datastore keeps whatever was stored.
    const highlightsHtml = React.useMemo(
        () => normaliseHighlightsHtml(bulletin?.highlights),
        [bulletin?.highlights]
    )

    // A bulletin is written for one month but forecasts over four. The scenario
    // cards report that window, so the letterhead says the same thing rather
    // than naming only the first month of it.
    const forecastWindow = React.useMemo(
        () => describeForecastWindow(bulletin?.period),
        [bulletin?.period]
    )

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
            const organisationUnitResponse = data?.organisationUnits
            const organisationUnitList = Array.isArray(organisationUnitResponse)
                ? organisationUnitResponse
                : organisationUnitResponse?.organisationUnits
            setOrgUnits(Array.isArray(organisationUnitList) ? organisationUnitList : [])
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
                title: `${bulletinTitle} - ${formatPeriod(bulletin.period)}`,
            })

            if (droppedImages > 0) {
                showDownloadMessage(
                    'warning',
                    i18n.t('PDF downloaded, but {{total}} image(s) could not be included. Check the image URLs in Settings.', {
                        total: droppedImages,
                    })
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

    const isDraft = (bulletin.status || 'draft') === 'draft'
    const statusLabel = isDraft ? i18n.t('Draft') : i18n.t('Published')
    const hasHighlights = hasHighlightsContent(highlightsHtml)

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

            {/* Everything inside this wrapper is the document: the design
                system is scoped to `.bulletinDocument` so the editor form,
                which renders the same widgets, keeps the app's own look.
                No box-shadow on the cards: html2canvas renders it, so on paper
                it is a grey smudge around the heading. */}
            <div ref={contentRef} className={style.bulletinDocument}>
            <div data-pdf-block className={style.bulletinMasthead}>
                {/* Logo, title and tagline only: this is the part the export
                    repeats at the top of every page after the first. The
                    letterhead facts below it stay on page one. */}
                <div data-pdf-masthead className={style.bulletinMastheadHead}>
                    {displayIcon && (
                        <img
                            src={displayIcon}
                            alt=""
                            style={{ height: '56px', maxWidth: '100%', marginBottom: '12px' }}
                        />
                    )}
                    <h1 className={style.bulletinMastheadTitle}>
                        {bulletinTitle}
                    </h1>
                    <p className={style.bulletinMastheadTagline}>
                        {i18n.t('Bridging Weather & Wellness For a Healthier Malawi')}
                    </p>
                </div>

                {/* Letterhead strip: the facts at one end, the status and the
                    generation date at the other. */}
                <div className={style.bulletinLetterhead}>
                    <div className={style.bulletinLetterheadFacts}>
                        <div>
                            <span className={style.bulletinFactLabel}>{i18n.t('Organisation Unit')}</span>
                            <p className={style.bulletinFactValue}>
                                {getOrgUnitName(bulletin.organisationUnit)}
                            </p>
                        </div>
                        <div>
                            <span className={style.bulletinFactLabel}>{i18n.t('Period')}</span>
                            <p className={style.bulletinFactValue}>
                                {forecastWindow.label
                                    ? `${forecastWindow.label} · ${i18n.t('{{total}} months', { total: forecastWindow.months })}`
                                    : formatPeriod(bulletin.period)}
                            </p>
                        </div>
                    </div>
                    <div className={style.bulletinLetterheadStatus}>
                        <span className={isDraft ? style.statusDraft : style.statusSubmitted}>
                            {statusLabel}
                        </span>
                        <span className={style.bulletinGeneratedOn}>
                            {i18n.t('Generated on {{date}}', {
                                date: GENERATED_ON_FORMAT.format(new Date()),
                            })}
                        </span>
                    </div>
                </div>
            </div>

            <div data-pdf-block style={{ marginBottom: '20px' }}>
                <ForecastSummaryWidget
                    style={style}
                    dataValues={Array.isArray(bulletin.cases?.[0]) ? bulletin.cases[0] : []}
                    mapping={settingsData?.dataStore?.mapping || []}
                    period={bulletin.period}
                    organisationUnit={bulletin.organisationUnit}
                    orgUnits={orgUnits}
                />
            </div>

            {/* Leads the document, so it carries no numeral — nothing is
                numbered before it. */}
            {bulletin.executiveSummary && bulletin.executiveSummary.length > 0 && (
                <div data-pdf-block>
                    <BulletinSection title={i18n.t('Executive Summary')}>
                        <div className={style.bulletinList}>
                            {bulletin.executiveSummary.map((line, index) => {
                                const { lead, rest } = splitSummaryLine(line)

                                return (
                                    <div key={index} className={style.bulletinListItem}>
                                        <span className={style.bulletinListItemText}>
                                            {lead && (
                                                <span className={style.bulletinSummaryMonth}>{lead}</span>
                                            )}
                                            {rest}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </BulletinSection>
                </div>
            )}

            {/* 1. Highlights — now shown first, matching the numbered document order */}
            {hasHighlights && (
                <div data-pdf-block>
                    {/* The numeral is a literal, as in every other section; only
                        the label is translated. */}
                    <BulletinSection step="1" title={i18n.t('Highlights')}>
                        <div
                            className={style.highlightsBody}
                            dangerouslySetInnerHTML={{ __html: highlightsHtml }}
                        />
                    </BulletinSection>
                </div>
            )}

            <div data-pdf-block style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className={style.sectionCard}>
                    <HealthCasesWidget
                        dataValues={Array.isArray(bulletin.cases?.[0]) ? bulletin.cases[0] : []}
                        mapping={settingsData?.dataStore?.mapping}
                        orgUnits={orgUnits}
                        selectedOrgUnit={bulletin.organisationUnit}
                        period={bulletin.period}
                        style={style}
                        step="2"
                        title={i18n.t('Recorded Health Cases')}
                        description={i18n.t('Summary of recorded health cases.')}
                    />
                </div>
                <div className={style.sectionCard}>
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

            <div data-pdf-block style={{ marginBottom: '20px' }}>
                <SeasonalClimateChart
                    style={style}
                    rainfallDataElement={settingsData?.dataStore?.rainfallDataElement}
                    temperatureDataElement={settingsData?.dataStore?.temperatureDataElement}
                    selectedOrgUnit={bulletin.organisationUnit}
                    period={bulletin.period}
                    initialDataValues={Array.isArray(bulletin.seasonalClimate) && bulletin.seasonalClimate.length > 0
                        ? bulletin.seasonalClimate
                        : undefined}
                    orgUnits={orgUnits}
                />
            </div>

            {bulletin.advisories && bulletin.advisories.length > 0 && (
                <div data-pdf-block>
                    <BulletinSection step="4" title={i18n.t('Health Advisories')}>
                        {/* A left-border accent rather than an icon, which is how
                            the reference marks advisories and messages. */}
                        <div className={style.bulletinList}>
                            {bulletin.advisories.map((advisory, index) => (
                                <div
                                    key={index}
                                    className={`${style.bulletinListItem} ${style.bulletinListItemAdvisory}`}
                                >
                                    <span className={style.bulletinListItemText}>{advisory}</span>
                                </div>
                            ))}
                        </div>
                    </BulletinSection>
                </div>
            )}

            {bulletin.recommendations && bulletin.recommendations.length > 0 && (
                <div data-pdf-block>
                    <BulletinSection step="5" title={i18n.t('Recommendations')}>
                        <div className={style.bulletinList}>
                            {bulletin.recommendations.map((recommendation, index) => (
                                <div key={index} className={style.bulletinListItem}>
                                    <span className={style.bulletinListItemText}>{recommendation}</span>
                                </div>
                            ))}
                        </div>
                    </BulletinSection>
                </div>
            )}
            </div>
        </main>
    )
}

export default BulletinPreview