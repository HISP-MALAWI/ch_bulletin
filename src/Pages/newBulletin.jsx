import React from "react";
import i18n from "@dhis2/d2-i18n";
import { Button, Center, CircularLoader, IconError24, Layer, AlertBar, SingleSelectField, SingleSelectOption, InputField } from "@dhis2/ui";
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
import DistrictRiskSummary, { DEFAULT_MAP_HEIGHT } from "../widgets/districtRiskSummary";
import DistrictActionsWidget from "../widgets/districtActionsWidget";
import DashboardHeader from "../widgets/headerWidget";
import dataQuery from "./services/engines/dataQuery";
import { homeDataQuery } from "./services/getHomeData";
import { mapsQuery } from "./services/getMaps";
import { dataSettingsStoreQuery } from "./services/getSettingsStore";
import { useDataEngine } from "@dhis2/app-runtime";
import getDataValues, { getMonthlyPeriods } from "../utils/getDataValues";
import { buildSeasonalClimateRows, getSeasonalForecastPeriods } from "../utils/seasonalClimateData";
import { getDistrictDescendants, getZoneDescendants, hasRegionalRiskView } from "../utils/districtForecasts";
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
  const [historicalClimate, setHistoricalClimate] = React.useState([]);
  // The saved DHIS2 map the district risk section is drawn from, if the author
  // has chosen one: `{ uid, name, height }`.
  const [districtRiskMap, setDistrictRiskMap] = React.useState(null);

  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState(null); // 'error' | null
  const [existingBulletin, setExistingBulletin] = React.useState(null);

  const { id } = useParams();
  const navigate = useNavigate();
  const { loading, error, data } = dataQuery(dataSettingsStoreQuery);
  const { loading: homeLoading, data: homeData } = dataQuery(homeDataQuery);
  // Only the picker needs these, and a saved map is a few hundred bytes.
  const { loading: mapsLoading, data: mapsData } = dataQuery(mapsQuery);
  const savedMaps = mapsData?.maps?.maps || [];
  const engine = useDataEngine();
  const { canDraft } = useAccess();
  const seasonalClimateRows = React.useMemo(() => buildSeasonalClimateRows({
    dataValues: seasonalClimate,
    periods: getSeasonalForecastPeriods(period),
    rainfallDataElement: data?.dataStore?.rainfallForecast,
    temperatureDataElement: data?.dataStore?.temperatureForecast,
    selectedOrgUnit: organisationUnit,
  }), [data, organisationUnit, period, seasonalClimate]);

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
      setDistrictRiskMap(null);
      return;
    }

    const bulletinList = Array.isArray(homeData?.dataStore) ? homeData.dataStore : [];
    const foundBulletin = bulletinList.find((item) => item.id === id);

    if (!foundBulletin) {
      setExistingBulletin(null);
      setHistoricalClimate([]);
      setDistrictRiskMap(null);
      return;
    }

    setExistingBulletin(foundBulletin);
    setHighlights(foundBulletin.highlights || "");
    setPeriod(foundBulletin.period || undefined);
    setOrganisation(foundBulletin.organisationUnit || undefined);
    setForecast(foundBulletin.forecast || []);
    setDatavalues(Array.isArray(foundBulletin.cases?.[0]) ? foundBulletin.cases[0] : []);
    setSeasonalClimate(Array.isArray(foundBulletin.seasonalClimate) ? foundBulletin.seasonalClimate : []);
    setHistoricalClimate(Array.isArray(foundBulletin.historicalClimate) ? foundBulletin.historicalClimate : []);
    setDistrictRiskMap(foundBulletin.districtRiskMap?.uid ? foundBulletin.districtRiskMap : null);
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
      showTransientMessage("error", i18n.t("Please add an executive summary before saving"));
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    setSaveMessage("");

    // Built before the write so that the same record can be handed to the list
    // below: what was written is known here, whatever the list's own query
    // happens to be holding.
    const bulletin = {
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
      status: existingBulletin?.status || "draft",
      period,
      // Stored as a number, and null rather than absent when no map is
      // chosen: the section keeps drawing from the bulletin's own data, and
      // the record says so.
      districtRiskMap: districtRiskMap?.uid
        ? {
            uid: districtRiskMap.uid,
            name: districtRiskMap.name || null,
            height:
              Number(districtRiskMap.height) > 0
                ? Math.round(Number(districtRiskMap.height))
                : DEFAULT_MAP_HEIGHT,
          }
        : null,
    };

    try {
      await savebulletinToDataStore(bulletin, engine);
      // Straight back to the list. There is no success message to show here: it
      // would go with the page a moment later, and the list holding the bulletin
      // is the better confirmation that the save worked.
      //
      // The record travels with the navigation because the list's query is
      // cached and re-fetched in the background, so on a slow link the list can
      // paint without it for long enough to look like the save was lost. Home
      // merges it in and lets the refetch reconcile.
      navigate("/", { state: { refresh: true, saved: bulletin } });
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
  // a hidden section still has to be fillable, and the executive summary is
  // required to save a bulletin at all. This count is only so that a section
  // being filled in does not silently go nowhere.
  const hiddenSectionCount = resolveSections(data?.dataStore?.sections)
    .filter((section) => !section.visible).length;

  // A map this bulletin carries but the list does not offer: deleted since it was
  // chosen, or not shared with this user.
  const chosenMapIsMissing =
    Boolean(districtRiskMap?.uid) &&
    !mapsLoading &&
    !savedMaps.some((map) => map.id === districtRiskMap.uid);

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

            {/* Mirrors where the band sits in the document: above the cards.
                The card goes with the band, so a district bulletin — where the
                band does not render at all — does not leave an empty frame
                behind. */}
            {hasRegionalRiskView(orgUnits, organisationUnit) && (
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
            )}

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

            {/* Leads the document, so it leads the form. The section is the
                document's executive summary; the field behind it is still the
                record's `highlights`. */}
            <HighlightsInput
              style={style}
              fullWidth
              title="Executive Summary"
              description="The bulletin's key takeaways, in the author's own words."
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
                districtMap={districtRiskMap}
                // The editor is a long form, so the Maps app is only loaded once
                // this section is close to the screen. The preview mounts it as
                // soon as it opens instead: its map is what the PDF captures.
                deferMap
              />
            </div>

            {/* The district risk section draws its own map from the bulletin's
                forecast data. A saved DHIS2 map is a different map — its own
                indicator, period and class breaks, edited in the Maps app — so
                it is the author's choice per bulletin rather than a setting. */}
            <section className={`${style.sectionCard} ${style.fullWidth}`}>
              <div className={style.sectionHeader}>
                <span className={style.sectionTitle}>
                  {i18n.t("District risk map")}
                </span>
              </div>
              <p className={style.sectionSub}>
                {i18n.t(
                  "Use a map saved in the DHIS2 Maps app in place of the map drawn from this bulletin's forecast data. Its extent and styling are edited in the Maps app, and it follows its own period and organisation units rather than this bulletin's."
                )}
              </p>
              {mapsLoading ? (
                <CircularLoader small />
              ) : (
                <div className={style.bulletinTwoColumnGrid}>
                  <SingleSelectField
                    filterable
                    label={i18n.t("Map")}
                    selected={districtRiskMap?.uid || ""}
                    onChange={({ selected }) => {
                      if (!selected) {
                        setDistrictRiskMap(null);
                        return;
                      }

                      const chosen = savedMaps.find((map) => map.id === selected);

                      setDistrictRiskMap({
                        uid: selected,
                        name: chosen?.displayName || selected,
                        // Kept when switching between maps, so comparing two of
                        // them does not resize the document each time.
                        height: districtRiskMap?.height || DEFAULT_MAP_HEIGHT,
                      });
                    }}
                    helpText={i18n.t(
                      "The map is added to the bulletin by id, so editing it in the Maps app changes it in every bulletin that uses it."
                    )}
                  >
                    <SingleSelectOption
                      value=""
                      label={i18n.t("None — draw from bulletin data")}
                    />
                    {/* The chosen map can be gone from the list: deleted, or not
                        shared with this user. It stays selected so the author
                        sees which map the bulletin is carrying rather than
                        finding the choice quietly reset. */}
                    {chosenMapIsMissing ? (
                      <SingleSelectOption
                        value={districtRiskMap.uid}
                        label={districtRiskMap.name || districtRiskMap.uid}
                      />
                    ) : null}
                    {savedMaps.map((map) => (
                      <SingleSelectOption
                        key={map.id}
                        value={map.id}
                        label={map.displayName}
                      />
                    ))}
                  </SingleSelectField>
                  <InputField
                    type="number"
                    label={i18n.t("Map height (px)")}
                    min="200"
                    max="900"
                    step="20"
                    disabled={!districtRiskMap?.uid}
                    value={String(districtRiskMap?.height || DEFAULT_MAP_HEIGHT)}
                    onChange={({ value }) =>
                      setDistrictRiskMap((current) =>
                        current ? { ...current, height: value } : current
                      )
                    }
                    helpText={i18n.t(
                      "How tall the map is in the document. It is drawn to fit the box, so its shape does not change."
                    )}
                  />
                </div>
              )}
            </section>

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