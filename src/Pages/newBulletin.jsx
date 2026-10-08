import React from "react";
import i18n from "@dhis2/d2-i18n";
import { Button, Center, CircularLoader, IconError24, Layer, AlertBar } from "@dhis2/ui";
import SaveIcon from "@mui/icons-material/Save";
import { useNavigate, useParams } from "react-router-dom";
import HighlightsInput from "../widgets/highlightsInput";
import ForecastSummaryWidget from "../widgets/forecastSummaryWidget";
import SeasonalClimateChart from "../widgets/seasonalClimateChart";
import HealthCasesWidget from "../widgets/surveilanceHighlights";
import CurrentMalariaSituation from "../widgets/currentMalariaSituation";
import MalariaRiskOverview from "../widgets/malariaRiskOverview";
import HistoricalClimateCasesChart from "../widgets/historicalClimateCasesChart";
import ForecastWidget from "../widgets/forecastWidget";
import AdvisoriesWidget from "../widgets/advisoriesWidget";
import ExecutiveSummaryWidget from "../widgets/executiveSummaryWidget";
import DistrictRiskSummary from "../widgets/districtRiskSummary";
import DistrictActionsWidget from "../widgets/districtActionsWidget";
import DashboardHeader from "../widgets/headerWidget";
import dataQuery from "./services/engines/dataQuery";
import { homeDataQuery } from "./services/getHomeData";
import { dataSettingsStoreQuery } from "./services/getSettingsStore";
import { useDataEngine } from "@dhis2/app-runtime";
import getDataValues, { getMonthlyPeriods } from "../utils/getDataValues";
import { buildSeasonalClimateRows, getSeasonalForecastPeriods } from "../utils/seasonalClimateData";
import { buildHealthGuidance } from "../utils/healthGuidance";
import { buildExecutiveSummaryDrafts } from "../utils/executiveSummary";
import { getDistrictDescendants, getZoneDescendants } from "../utils/districtForecasts";
import getOrgUnitCentroid from "../utils/getCentroid";
import savebulletinToDataStore from "../utils/saveBulletin";
import { generateDhis2Uid } from "../utils/idGenerator";
import { normaliseHighlightsHtml, hasHighlightsContent } from "../utils/highlightsHtml";
import { resolveSections } from "../utils/bulletinSections";
import { useAccess } from "../context/AccessContext";

const ALERT_AUTO_HIDE_MS = 5000;

const BulletinForm = ({ style }) => {
  const [period, setPeriod] = React.useState();
  const [organisationUnit, setOrganisation] = React.useState();
  const [orgUnits, setOrgUnits] = React.useState([]);
  const [highlights, setHighlights] = React.useState("");
  const [forecast, setForecast] = React.useState([]);
  const [datavalues, setDatavalues] = React.useState([]);
  const [seasonalClimate, setSeasonalClimate] = React.useState([]);
  const [advisories, setAdvisories] = React.useState([]);
  const [recommendations, setRecommendations] = React.useState([]);
  const [executiveSummary, setExecutiveSummary] = React.useState([]);
  const [historicalClimate, setHistoricalClimate] = React.useState([]);

  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState(null); // 'error' | null
  const [existingBulletin, setExistingBulletin] = React.useState(null);

  const { id } = useParams();
  const navigate = useNavigate();
  const { loading, error, data } = dataQuery(dataSettingsStoreQuery);
  const { loading: homeLoading, data: homeData } = dataQuery(homeDataQuery);
  const engine = useDataEngine();
  const { canDraft } = useAccess();
  const seasonalClimateRows = React.useMemo(() => buildSeasonalClimateRows({
    dataValues: seasonalClimate,
    periods: getSeasonalForecastPeriods(period),
    rainfallDataElement: data?.dataStore?.rainfallForecast,
    temperatureDataElement: data?.dataStore?.temperatureForecast,
    selectedOrgUnit: organisationUnit,
  }), [data, organisationUnit, period, seasonalClimate]);
  const guidanceSuggestions = React.useMemo(() => buildHealthGuidance({
    seasonalClimateRows,
    forecast,
    dataValues: datavalues,
    mapping: data?.dataStore?.mapping || [],
    period,
    selectedOrgUnit: organisationUnit,
  }), [data, datavalues, forecast, organisationUnit, period, seasonalClimateRows]);
  const summaryDrafts = React.useMemo(() => buildExecutiveSummaryDrafts({
    period,
    dataValues: datavalues,
    mapping: data?.dataStore?.mapping || [],
    selectedOrgUnit: organisationUnit,
    seasonalClimateRows,
  }), [data, datavalues, organisationUnit, period, seasonalClimateRows]);

  const showTransientMessage = (status, message) => {
    setSaveStatus(status);
    setSaveMessage(message);
    setTimeout(() => {
      setSaveStatus(null);
      setSaveMessage("");
    }, ALERT_AUTO_HIDE_MS);
  };

  // Fetch weather forecast for the selected org unit
  React.useEffect(() => {
    const orgUnitForecast = orgUnits?.find((unit) => unit.id === organisationUnit);
    if (!orgUnitForecast?.geometry) return;

    const { lat, lon } = getOrgUnitCentroid(orgUnitForecast.geometry);
    let cancelled = false;

    const fetchForecast = async () => {
      try {
        const res = await fetch(
          `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`,
          { headers: { "User-Agent": "ch_bulletin/1.0 contact@yourdomain" } }
        );
        if (!res.ok) throw new Error(`MET API error: ${res.status}`);
        const json = await res.json();
        if (!cancelled) setForecast(json);
      } catch (err) {
        console.error("Error fetching forecast:", err);
        if (!cancelled) setForecast([]);
      }
    };

    fetchForecast();
    return () => {
      cancelled = true;
    };
  }, [organisationUnit, orgUnits]);

  React.useEffect(() => {
    if (!id) {
      setExistingBulletin(null);
      setHistoricalClimate([]);
      return;
    }

    const bulletinList = Array.isArray(homeData?.dataStore) ? homeData.dataStore : [];
    const foundBulletin = bulletinList.find((item) => item.id === id);

    if (!foundBulletin) {
      setExistingBulletin(null);
      setHistoricalClimate([]);
      return;
    }

    setExistingBulletin(foundBulletin);
    setHighlights(foundBulletin.highlights || "");
    setPeriod(foundBulletin.period || undefined);
    setOrganisation(foundBulletin.organisationUnit || undefined);
    setForecast(foundBulletin.forecast || []);
    setDatavalues(Array.isArray(foundBulletin.cases?.[0]) ? foundBulletin.cases[0] : []);
    setSeasonalClimate(Array.isArray(foundBulletin.seasonalClimate) ? foundBulletin.seasonalClimate : []);
    setAdvisories(Array.isArray(foundBulletin.advisories) ? foundBulletin.advisories : []);
    setRecommendations(Array.isArray(foundBulletin.recommendations) ? foundBulletin.recommendations : []);
    setExecutiveSummary(Array.isArray(foundBulletin.executiveSummary) ? foundBulletin.executiveSummary : []);
    setHistoricalClimate(Array.isArray(foundBulletin.historicalClimate) ? foundBulletin.historicalClimate : []);
  }, [id, homeData]);

  // Fetch recorded case data values for the selected period/org unit
  React.useEffect(() => {
    if (!data?.dataStore?.mapping || !period || !organisationUnit) {
      setDatavalues([]);
      return;
    }

    let cancelled = false;

    const fetchDataValues = async () => {
      try {
        // Thirteen months back rather than twelve: the historical climate chart
        // draws from thirteen months before the period, and the case values it
        // plots come from this one fetch. At twelve the chart's oldest month
        // would have rainfall and no confirmed cases.
        const periods = getMonthlyPeriods(period, 13, 3);
        const zoneIds = getZoneDescendants(orgUnits, organisationUnit)
          .map((unit) => unit.id);
        console.log(data.dataStore)
        const districtIds = getDistrictDescendants(orgUnits, organisationUnit)
          .map((unit) => unit.id);
        const values = await getDataValues(
          data.dataStore.mapping,
          periods,
          [organisationUnit, ...zoneIds, ...districtIds],
          engine
        );
        console.log(data.dataStore.mapping);
        console.log(values)
        if (!cancelled) setDatavalues(values);
      } catch (err) {
        console.error("Error fetching data values:", err);
        if (!cancelled) setDatavalues([]);
      }
    };

    fetchDataValues();
    return () => {
      cancelled = true;
    };
  }, [data, period, organisationUnit, orgUnits, engine]);
  const handleSave = async () => {
    if (!canDraft) {
      showTransientMessage("error", i18n.t("You do not have permission to draft bulletins"));
      return;
    }

    // An untouched editor holds `<p><br></p>`, which is a non-empty string, so
    // the check is on whether it would put anything on the page.
    if (!hasHighlightsContent(highlights)) {
      showTransientMessage("error", i18n.t("Please add highlights before saving"));
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    setSaveMessage("");

    try {
      await savebulletinToDataStore(
        {
          id: existingBulletin?.id || generateDhis2Uid(),
          // Stored cleaned, so the preview can be styled by the app rather than
          // by Quill, and so the string handed to dangerouslySetInnerHTML has
          // been through an allowlist. The editor still holds raw Quill markup.
          highlights: normaliseHighlightsHtml(highlights),
          organisationUnit,
          cases: [datavalues],
          historicalClimate,
          forecast,
          seasonalClimate,
          advisories,
          recommendations,
          executiveSummary,
          status: existingBulletin?.status || "draft",
          period,
        },
        engine
      );
      // Straight back to the list, which fetches again on arrival so that the
      // bulletin just saved is in it. There is no success message to show here:
      // it would go with the page a moment later, and the reloaded list is the
      // better confirmation that the save worked.
      navigate("/", { state: { refresh: true } });
    } catch (err) {
      console.error("Save bulletin error:", err);
      showTransientMessage(
        "error",
        err?.message || i18n.t("Error saving bulletin. Please try again.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  // The editor keeps every section, whatever the document is configured to show:
  // a hidden section still has to be fillable, and Highlights is required to save
  // a bulletin at all. This count is only so that a section being filled in does
  // not silently go nowhere.
  const hiddenSectionCount = resolveSections(data?.dataStore?.sections)
    .filter((section) => !section.visible).length;

  return (
    <div className={style.main}>
      <DashboardHeader
        style={style}
        period={period}
        setOrgUnits={setOrgUnits}
        setPeriod={setPeriod}
        organisationUnit={organisationUnit}
        setOrganisation={setOrganisation}
      />

      {period && organisationUnit ? (
        <>
          <div className={style.formGrid}>
            {/* Which sections reach the document is a Settings decision and is
                made once for every issue, so it is a note here rather than a
                control: filling a section in that the document does not carry
                would otherwise be silent. */}
            {hiddenSectionCount > 0 && (
              <p className={`${style.sectionSub} ${style.fullWidth}`}>
                {i18n.t(
                  "The document does not show {{total}} of its sections. Change this in Settings.",
                  { total: hiddenSectionCount }
                )}
              </p>
            )}

            {/* Mirrors where the band sits in the document: above the cards. */}
            <section className={`${style.sectionCard} ${style.fullWidth}`}>
              <MalariaRiskOverview
                style={style}
                dataValues={datavalues}
                mapping={data?.dataStore?.mapping || []}
                period={period}
                orgUnits={orgUnits}
                selectedOrgUnit={organisationUnit}
              />
            </section>

            <section className={`${style.sectionCard} ${style.fullWidth}`}>
              <ForecastSummaryWidget
                style={style}
                dataValues={datavalues}
                mapping={data?.dataStore?.mapping}
                period={period}
                organisationUnit={organisationUnit}
                orgUnits={orgUnits}
              />
            </section>

            {/* Leads the document, so it leads the form. It carries no step
                numeral, because nothing is numbered before it. */}
            <ExecutiveSummaryWidget
              style={style}
              summary={executiveSummary}
              setSummary={setExecutiveSummary}
              drafts={summaryDrafts}
            />

            <HighlightsInput
              style={style}
              fullWidth
              step="1"
              title="Highlights"
              description="Key takeaways for the bulletin."
              highlights={highlights}
              setHighlights={setHighlights}
            />

            <div className={`${style.fullWidth} ${style.bulletinTwoColumnGrid}`}>
              <CurrentMalariaSituation
                style={style}
                dataValues={datavalues}
                mapping={data?.dataStore?.mapping || []}
                period={period}
                orgUnits={orgUnits}
                selectedOrgUnit={organisationUnit}
              />
              <section className={style.sectionCard}>
                <HealthCasesWidget
                  dataValues={datavalues}
                  mapping={data?.dataStore?.mapping}
                  orgUnits={orgUnits}
                  selectedOrgUnit={organisationUnit}
                  period={period}
                  style={style}
                  step="2"
                  title="Malaria Forecast"
                />
              </section>
            </div>

            <div className={style.fullWidth}>
              <HistoricalClimateCasesChart
                style={style}
                dataValues={datavalues}
                mapping={data?.dataStore?.mapping || []}
                rainfallDataElement={data?.dataStore?.rainfallDataElement}
                temperatureDataElement={data?.dataStore?.temperatureDataElement}
                period={period}
                orgUnits={orgUnits}
                selectedOrgUnit={organisationUnit}
                initialClimateDataValues={
                  existingBulletin?.period === period &&
                  existingBulletin?.organisationUnit === organisationUnit &&
                  Array.isArray(existingBulletin?.historicalClimate) &&
                  existingBulletin.historicalClimate.length > 0
                    ? existingBulletin.historicalClimate
                    : undefined
                }
                onClimateDataValuesChange={setHistoricalClimate}
              />
            </div>

            <section className={`${style.bulletinTwoColumnGrid} ${style.fullWidth}`}>
              <div className={style.sectionCard}>
              <ForecastWidget
                style={style}
                step="3"
                organisationUnit={organisationUnit}
                period={period}
                forecast={forecast}
                title="Weather Forecast"
                description="Upcoming weather conditions."
              />
              </div>
              <SeasonalClimateChart
                style={style}
                rainfallDataElement={data?.dataStore?.rainfallForecast}
                temperatureDataElement={data?.dataStore?.temperatureForecast}
                selectedOrgUnit={organisationUnit}
                period={period}
                onDataValuesChange={setSeasonalClimate}
                orgUnits={orgUnits}
              />
            </section>

            <div className={style.fullWidth}>
              <DistrictRiskSummary
                style={style}
                dataValues={datavalues}
                mapping={data?.dataStore?.mapping || []}
                period={period}
                orgUnits={orgUnits}
                selectedOrgUnitId={organisationUnit}
              />
            </div>

            <div className={style.fullWidth}>
              <DistrictActionsWidget
                style={style}
                forecast={forecast}
                seasonalClimateRows={seasonalClimateRows}
                dataValues={datavalues}
                mapping={data?.dataStore?.mapping || []}
                period={period}
                selectedOrgUnitId={organisationUnit}
                orgUnits={orgUnits}
              />
            </div>

            <AdvisoriesWidget
              style={style}
              advisories={advisories}
              setAdvisories={setAdvisories}
              recommendations={recommendations}
              setRecommendations={setRecommendations}
              advisorySuggestions={guidanceSuggestions.advisories}
              recommendationSuggestions={guidanceSuggestions.recommendations}
              step="4"
              title="Health Advisories"
              description="Important health advisories for the region."
            />

          </div>

          {isSaving && (
            <Layer dataTest="dhis2-uicore-layer" level="auto" position="fixed" translucent>
              <Center>
                <CircularLoader />
              </Center>
            </Layer>
          )}

          {/* Errors only. A save leaves for the list of bulletins, so a success
              bar here would be gone before it could be read. */}
          {saveStatus === "error" && (
            <AlertBar critical permanent={false} onHidden={() => setSaveStatus(null)}>
              {saveMessage}
            </AlertBar>
          )}

          <footer className={style.footerActions}>
            <Button icon={<SaveIcon />} disabled={isSaving} onClick={handleSave} primary>
              {existingBulletin ? i18n.t("Save Changes") : i18n.t("Save to Draft")}
            </Button>
          </footer>
        </>
      ) : (
        <div className={style.loadingMessage} style={{ height: "100%" }}>
          {loading || homeLoading ? (
            <Layer translucent dataTest="dhis2-uicore-layer" level="auto" position="fixed">
              <Center>
                <CircularLoader />
              </Center>
            </Layer>
          ) : error ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "64px 24px",
                textAlign: "center",
                backgroundColor: "#F3F5F7",
                minHeight: "400px",
                fontFamily: "Roboto, sans-serif",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  transform: "scale(2.5)",
                  marginBottom: "32px",
                  color: "#4A5768",
                }}
              >
                <IconError24 />
              </span>

              <h2
                style={{
                  fontSize: "22px",
                  fontWeight: 500,
                  color: "#212934",
                  margin: "0 0 16px 0",
                }}
              >
                {i18n.t("Could not load settings")}
              </h2>

              <p style={{ margin: "0 0 12px 0", color: "#4A5768", fontSize: "15px" }}>
                {i18n.t("The app is not able to connect to the DataStore.")}
              </p>

              <p style={{ margin: "0 0 24px 0", color: "#4A5768", fontSize: "15px" }}>
                {i18n.t("Please check your network connection and make sure the settings exist.")}
              </p>

              <a
                href="#"
                style={{ color: "#105C9E", textDecoration: "underline", fontSize: "15px" }}
              >
                {i18n.t("Learn more about Bulletin settings")}
              </a>
            </div>
          ) : (
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
                {i18n.t("Please select a period and organisation unit to start creating the bulletin.")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BulletinForm;