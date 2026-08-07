import React from "react";
import i18n from "@dhis2/d2-i18n";
import { Button, Center, CircularLoader, IconError24, Layer, AlertBar } from "@dhis2/ui";
import SaveIcon from "@mui/icons-material/Save";
import HighlightsInput from "../widgets/highlightsInput";
import HealthCasesWidget from "../widgets/surveilanceHighlights";
import ForecastWidget from "../widgets/forecastWidget";
import AdvisoriesWidget from "../widgets/advisoriesWidget";
import DashboardHeader from "../widgets/headerWidget";
import dataQuery from "./services/engines/dataQuery";
import { dataSettingsStoreQuery } from "./services/getSettingsStore";
import { useDataEngine } from "@dhis2/app-runtime";
import getDataValues from "../utils/getDataValues";
import getOrgUnitCentroid from "../utils/getCentroid";
import savebulletinToDataStore from "../utils/saveBulletin";
import { generateDhis2Uid } from "../utils/idGenerator";

const ALERT_AUTO_HIDE_MS = 5000;

const BulletinForm = ({ style }) => {
  const [advisories, setAdvisories] = React.useState([]);
  const [period, setPeriod] = React.useState();
  const [organisationUnit, setOrganisation] = React.useState();
  const [orgUnits, setOrgUnits] = React.useState([]);
  const [highlights, setHighlights] = React.useState("");
  const [forecast, setForecast] = React.useState([]);
  const [datavalues, setDatavalues] = React.useState([]);

  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState(null); // 'success' | 'error' | null

  const { loading, error, data } = dataQuery(dataSettingsStoreQuery);
  const engine = useDataEngine();

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

  // Fetch recorded case data values for the selected period/org unit
  React.useEffect(() => {
    if (!data?.dataStore?.mapping || !period || !organisationUnit) {
      setDatavalues([]);
      return;
    }

    let cancelled = false;

    const fetchDataValues = async () => {
      try {
        const values = await getDataValues(
          data.dataStore.mapping,
          period,
          organisationUnit,
          engine
        );
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
  }, [data, period, organisationUnit, engine]);

  const handleSave = async () => {
    if (!highlights || highlights.trim() === "") {
      showTransientMessage("error", i18n.t("Please add highlights before saving"));
      return;
    }

    if (!advisories || advisories.length === 0) {
      showTransientMessage("error", i18n.t("Please add at least one advisory before saving"));
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    setSaveMessage("");

    try {
      await savebulletinToDataStore(
        {
          id: generateDhis2Uid(),
          highlights,
          organisationUnit,
          cases: [datavalues],
          forecast,
          advisories,
          status: "draft",
          period,
        },
        engine
      );
      showTransientMessage("success", i18n.t("Bulletin saved to draft successfully!"));
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
            <section className={`${style.sectionCard} ${style.fullWidth}`}>
              <HighlightsInput
                style={style}
                step="1"
                title="Highlights"
                description="Key takeaways for the bulletin."
                highlights={highlights}
                setHighlights={setHighlights}
              />
            </section>

            <section className={style.sectionCard}>
              <HealthCasesWidget
                dataValues={datavalues}
                mapping={data?.dataStore?.mapping}
                style={style}
                step="2"
                title="Recorded Health Cases"
                description="Summary of recorded health cases."
              />
            </section>

            <section className={style.sectionCard}>
              <ForecastWidget
                style={style}
                step="3"
                organisationUnit={organisationUnit}
                period={period}
                forecast={forecast}
                title="Weather Forecast"
                description="Upcoming weather conditions."
              />
            </section>

            <section className={`${style.sectionCard} ${style.fullWidth}`}>
              <AdvisoriesWidget
                style={style}
                advisories={advisories}
                setAdvisories={setAdvisories}
                step="4"
                title="Health Advisories"
                description="Important health advisories for the region."
              />
            </section>
          </div>

          {isSaving && (
            <Layer dataTest="dhis2-uicore-layer" level="auto" position="fixed" translucent>
              <Center>
                <CircularLoader />
              </Center>
            </Layer>
          )}

          {saveStatus === "success" && (
            <AlertBar success permanent={false} onHidden={() => setSaveStatus(null)}>
              {saveMessage}
            </AlertBar>
          )}

          {saveStatus === "error" && (
            <AlertBar critical permanent={false} onHidden={() => setSaveStatus(null)}>
              {saveMessage}
            </AlertBar>
          )}

          <footer className={style.footerActions}>
            <Button icon={<SaveIcon />} disabled={isSaving} onClick={handleSave} primary>
              {i18n.t("Save to Draft")}
            </Button>
          </footer>
        </>
      ) : (
        <div className={style.loadingMessage} style={{ height: "100%" }}>
          {loading ? (
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