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
import CurrentMalariaSituation from '../widgets/currentMalariaSituation'
import MalariaRiskOverview from '../widgets/malariaRiskOverview'
import HistoricalClimateCasesChart from '../widgets/historicalClimateCasesChart'
import ForecastWidget from '../widgets/forecastWidget'
import DistrictRiskSummary from '../widgets/districtRiskSummary'
import DistrictActionsWidget from '../widgets/districtActionsWidget'
import { buildSeasonalClimateRows, getSeasonalForecastPeriods } from '../utils/seasonalClimateData'
import { homeDataQuery } from './services/getHomeData'
import { dataSettingsStoreQuery } from './services/getSettingsStore'
import { useDataEngine } from '@dhis2/app-runtime'
import { NearMe } from '@mui/icons-material'
import { exportBulletinPdf, sanitiseFileName } from '../utils/bulletinPdf'
import { normaliseHighlightsHtml, hasHighlightsContent } from '../utils/highlightsHtml'
import { useAccess } from '../context/AccessContext'
import { BulletinSection } from '../widgets/bulletinSection'
import { describeForecastWindow } from '../utils/periodLabel'
import {
    groupRows,
    numberSections,
    resolveSections,
    visibleSections,
} from '../utils/bulletinSections'

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
    const seasonalClimateRows = React.useMemo(() => buildSeasonalClimateRows({
        dataValues: bulletin?.seasonalClimate || [],
        periods: getSeasonalForecastPeriods(bulletin?.period),
        rainfallDataElement: settingsData?.dataStore?.rainfallForecast,
        temperatureDataElement: settingsData?.dataStore?.temperatureForecast,
        selectedOrgUnit: bulletin?.organisationUnit,
    }), [
        bulletin?.organisationUnit,
        bulletin?.period,
        bulletin?.seasonalClimate,
        settingsData?.dataStore?.rainfallForecast,
        settingsData?.dataStore?.temperatureForecast,
    ])

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
    const bulletinDataValues = Array.isArray(bulletin.cases?.[0]) ? bulletin.cases[0] : []
    const generatedDate = GENERATED_ON_FORMAT.format(new Date())

    // The sections the document carries, and in what order. Not memoised: the
    // list is thirteen entries and this component re-renders as a whole anyway.
    const sectionRows = groupRows(
        visibleSections(resolveSections(settingsData?.dataStore?.sections))
    )
    const sectionNumbers = numberSections(sectionRows)

    // One entry per configurable section, each closing over the bulletin and the
    // settings read above — which is why this is built here rather than at module
    // scope. An entry returns `null` when its section has nothing to show, so the
    // wrapper is never rendered empty.
    //
    // The step numeral arrives as an argument, counted in the order the rows are
    // rendered rather than hardcoded per section, so a reordered or half-hidden
    // document still reads 1, 2, 3, … down the page. Each entry also carries its
    // own wrapper class, because they are not interchangeable: the section that
    // carries `bulletinDocumentPanel` today is the one whose chart is pinned to
    // 280px by it, and applying it everywhere would resize the other charts.
    const sectionContent = {
        malariaOverview: () => ({
            node: (
                <MalariaRiskOverview
                    style={style}
                    dataValues={bulletinDataValues}
                    mapping={settingsData?.dataStore?.mapping || []}
                    period={bulletin.period}
                    orgUnits={orgUnits}
                    selectedOrgUnit={bulletin.organisationUnit}
                />
            ),
        }),

        forecastSummary: () => ({
            node: (
                <ForecastSummaryWidget
                    style={style}
                    dataValues={bulletinDataValues}
                    mapping={settingsData?.dataStore?.mapping || []}
                    period={bulletin.period}
                    organisationUnit={bulletin.organisationUnit}
                    orgUnits={orgUnits}
                />
            ),
        }),

        executiveSummary: () => {
            if (!Array.isArray(bulletin.executiveSummary) || bulletin.executiveSummary.length === 0) {
                return null
            }

            return {
                node: (
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
                ),
            }
        },

        highlights: (step) => {
            if (!hasHighlights) {
                return null
            }

            return {
                node: (
                    <BulletinSection step={step} title={i18n.t('Highlights')}>
                        <div
                            className={style.highlightsBody}
                            dangerouslySetInnerHTML={{ __html: highlightsHtml }}
                        />
                    </BulletinSection>
                ),
            }
        },

        currentMalariaSituation: () => ({
            className: `${style.bulletinDocumentPanel} ${style.currentMalariaDocumentPanel}`,
            node: (
                <CurrentMalariaSituation
                    style={style}
                    dataValues={bulletinDataValues}
                    mapping={settingsData?.dataStore?.mapping || []}
                    period={bulletin.period}
                    orgUnits={orgUnits}
                    selectedOrgUnit={bulletin.organisationUnit}
                />
            ),
        }),

        malariaForecast: (step) => ({
            className: style.bulletinDocumentPanel,
            node: (
                <HealthCasesWidget
                    dataValues={bulletinDataValues}
                    mapping={settingsData?.dataStore?.mapping}
                    orgUnits={orgUnits}
                    selectedOrgUnit={bulletin.organisationUnit}
                    period={bulletin.period}
                    style={style}
                    step={step}
                    title={i18n.t('Malaria Forecast')}
                    description={i18n.t('Recorded cases, the predicted range and the alert threshold.')}
                />
            ),
        }),

        historicalClimate: () => ({
            node: (
                <HistoricalClimateCasesChart
                    style={style}
                    dataValues={bulletinDataValues}
                    mapping={settingsData?.dataStore?.mapping || []}
                    rainfallDataElement={settingsData?.dataStore?.rainfallDataElement}
                    temperatureDataElement={settingsData?.dataStore?.temperatureDataElement}
                    period={bulletin.period}
                    orgUnits={orgUnits}
                    selectedOrgUnit={bulletin.organisationUnit}
                    initialClimateDataValues={
                        Array.isArray(bulletin.historicalClimate) && bulletin.historicalClimate.length > 0
                            ? bulletin.historicalClimate
                            : undefined
                    }
                />
            ),
        }),

        weatherForecast: (step) => ({
            className: style.bulletinDocumentPanel,
            node: (
                <ForecastWidget
                    forecast={bulletin.forecast || []}
                    organisationUnit={bulletin.organisationUnit}
                    period={bulletin.period}
                    style={style}
                    step={step}
                    title={i18n.t('Weather Forecast')}
                    description={i18n.t('Upcoming weather conditions.')}
                />
            ),
        }),

        seasonalClimate: () => ({
            className: style.bulletinDocumentPanel,
            node: (
                <SeasonalClimateChart
                    style={style}
                    rainfallDataElement={settingsData?.dataStore?.rainfallForecast}
                    temperatureDataElement={settingsData?.dataStore?.temperatureForecast}
                    selectedOrgUnit={bulletin.organisationUnit}
                    period={bulletin.period}
                    initialDataValues={Array.isArray(bulletin.seasonalClimate) && bulletin.seasonalClimate.length > 0
                        ? bulletin.seasonalClimate
                        : undefined}
                    orgUnits={orgUnits}
                />
            ),
        }),

        districtRisk: () => ({
            node: (
                <DistrictRiskSummary
                    style={style}
                    dataValues={bulletinDataValues}
                    mapping={settingsData?.dataStore?.mapping || []}
                    period={bulletin.period}
                    orgUnits={orgUnits}
                    selectedOrgUnitId={bulletin.organisationUnit}
                />
            ),
        }),

        districtActions: () => ({
            node: (
                <DistrictActionsWidget
                    style={style}
                    forecast={bulletin.forecast}
                    seasonalClimateRows={seasonalClimateRows}
                    dataValues={bulletinDataValues}
                    mapping={settingsData?.dataStore?.mapping || []}
                    period={bulletin.period}
                    selectedOrgUnitId={bulletin.organisationUnit}
                    orgUnits={orgUnits}
                />
            ),
        }),

        advisories: (step) => {
            if (!Array.isArray(bulletin.advisories) || bulletin.advisories.length === 0) {
                return null
            }

            return {
                node: (
                    <BulletinSection step={step} title={i18n.t('Health Advisories')}>
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
                ),
            }
        },

        recommendations: (step) => {
            if (!Array.isArray(bulletin.recommendations) || bulletin.recommendations.length === 0) {
                return null
            }

            return {
                node: (
                    <BulletinSection step={step} title={i18n.t('Recommendations')}>
                        <div className={style.bulletinList}>
                            {bulletin.recommendations.map((recommendation, index) => (
                                <div key={index} className={style.bulletinListItem}>
                                    <span className={style.bulletinListItemText}>{recommendation}</span>
                                </div>
                            ))}
                        </div>
                    </BulletinSection>
                ),
            }
        },
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

            {/* The document's contents, in the order and with the visibility
                configured in Settings — see `utils/bulletinSections.js`. The
                masthead above and the footer below are fixed: the export repeats
                the masthead at the top of every page after the first, so it is
                not a section that can be moved or hidden.
                Each entry returns its own wrapper class, because the wrapper
                classes are not interchangeable — `bulletinDocumentPanel` pins
                `.casesChart` to 280px and zeroes the padding of any `.sectionCard`
                inside it, so applying it everywhere would resize the charts in
                the sections that do not carry it today. */}
            {sectionRows.map(({ row, items }) => {
                const panels = items
                    .map(({ id }) => ({ id, ...(sectionContent[id]?.(sectionNumbers[id]) || {}) }))
                    // A widget that renders nothing (MalariaRiskOverview returns
                    // null with no malaria mapping configured) must not leave an
                    // empty block behind: the export treats every block edge as a
                    // page-break candidate.
                    .filter(({ node }) => Boolean(node))

                if (panels.length === 0) {
                    return null
                }

                const key = row || items[0].id

                // One section on the row keeps its class on the block itself, as
                // it has today. A shared row puts the block marker on the grid
                // and the panel class on each column: the export only counts
                // outermost blocks, and a cut at the shorter column's edge would
                // slice through the taller one.
                if (panels.length === 1) {
                    const [{ className, node }] = panels

                    return (
                        <div key={key} data-pdf-block className={className}>
                            {node}
                        </div>
                    )
                }

                return (
                    <div
                        key={key}
                        data-pdf-block
                        className={`${style.bulletinTwoColumnGrid} ${style.fullWidth}`}
                    >
                        {panels.map(({ id, className, node }) => (
                            <div key={id} className={className}>
                                {node}
                            </div>
                        ))}
                    </div>
                )
            })}
            <footer data-pdf-block className={style.bulletinDocumentFooter}>
                <span>{bulletinTitle}</span>
                <span>{getOrgUnitName(bulletin.organisationUnit)} · {formatPeriod(bulletin.period)}</span>
                <span>{i18n.t('Generated on {{date}}', { date: generatedDate })}</span>
            </footer>
            </div>
        </main>
    )
}

export default BulletinPreview