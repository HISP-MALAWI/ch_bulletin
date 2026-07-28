import React,{useMemo} from "react";
import i18n from "@dhis2/d2-i18n";
import { Button, Center, CircularLoader, IconError24, Layer } from "@dhis2/ui";
import SaveIcon from "@mui/icons-material/Save";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import HighlightsInput from "../widgets/highlightsInput";
import HealthCasesWidget from "../widgets/surveilanceHighlights";
import ForecastWidget from "../widgets/forecastWidget";
import AdvisoriesWidget from "../widgets/advisoriesWidget";
import DashboardHeader from "../widgets/headerWidget";
import dataQuery from "./services/engines/dataQuery";
import { dataSettingsStoreQuery } from "./services/getSettingsStore";
import { useDataEngine } from "@dhis2/app-runtime";
import  getDataValues from "../utils/getDataValues";

const BulletinForm = ({ style }) => {
  const [advisories, setAdvisories] = React.useState([]);
  const [period, setPeriod] = React.useState();
  const [organisationUnit, setOrganisation] = React.useState();
  const [cases, setCases] = React.useState([
  ]);
  const [orgUnits,setOrgUnits] = React.useState([]);
  const [recordedCases, setRecordedCases] = React.useState([]);
  const [highlights, setHighlights] = React.useState("");

  const { loading, error, data } = dataQuery(dataSettingsStoreQuery);
  const engine = useDataEngine();

  const [forecast, setForecast] = React.useState([]);
  const [datavalues, setDatavalues] = React.useState([]);

  const forecastData = useMemo(() => {
    const orgUnitForecast = orgUnits?.find(unit => unit.id === organisationUnit);
    console.log("Forecast Data for selected org unit:", orgUnitForecast);
  }, [organisationUnit, period,orgUnits]);

React.useEffect(() => {
    if (!data?.dataStore?.mapping || !period || !organisationUnit) {
        setDatavalues([]);
        return;
    }

    const fetchDataValues = async () => {
        try {
            const values = await getDataValues(
                data.dataStore.mapping,
                period,
                organisationUnit,
                engine
            );
            
            setDatavalues(values);
            
        } catch (error) {
            console.error("Error setting data values:", error);
            setDatavalues([]); // Fallback to empty array on error
        }
    };

    // 4. Execute the fetch
    fetchDataValues();

}, [data, period, organisationUnit, engine]);


  return (
    <div className={style.main}>
      {/* Header Area */}
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
            {/* 1. Highlights Section */}
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

            {/* 2. Recorded Health Cases */}
            <section className={style.sectionCard}>
              <HealthCasesWidget
                key={datavalues}
                dataValues={datavalues}
                mapping={data?.dataStore?.mapping}
                style={style}
                step="2"
                title="Recorded Health Cases"
                description="Summary of recorded health cases."
              />
            </section>

            {/* 3. Weather Forecast */}
            <section className={style.sectionCard}>
              <ForecastWidget
                style={style}
                step="3"
                organisationUnit={organisationUnit}
                period={period}
                forecast={forecast}
                setForecast={setForecast}
                title="Weather Forecast"
                description="Upcoming weather conditions."
              />
            </section>

            {/* 4. Health Advisories */}
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

          {/* Form Footer Actions */}
          <footer className={style.footerActions}>
            <Button icon={<SaveIcon />} secondary>
              {i18n.t("Save Draft")}
            </Button>
            <Button icon={<PictureAsPdfIcon />} primary>
              {i18n.t("Generate Bulletin (PDF)")}
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

              <p
                style={{
                  margin: "0 0 12px 0",
                  color: "#4A5768",
                  fontSize: "15px",
                }}
              >
                {i18n.t("The app is not able to connect to the DataStore.")}
              </p>

              <p
                style={{
                  margin: "0 0 24px 0",
                  color: "#4A5768",
                  fontSize: "15px",
                }}
              >
                {i18n.t(
                  "Please check your network connection and make sure the settings exist.",
                )}
              </p>

              <a
                href="#"
                style={{
                  color: "#105C9E",
                  textDecoration: "underline",
                  fontSize: "15px",
                }}
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
                  transform: "scale(2)" /* Scales the 24px icon up to 48px */,
                  color: "#9CA3AF",
                  marginBottom: "16px",
                }}
              >
                <IconError24 />
              </span>
              <p style={{ fontSize: "15px", color: "#4B5563" }}>
                {i18n.t(
                  "Please select a period and organisation unit to start creating the bulletin.",
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BulletinForm;
