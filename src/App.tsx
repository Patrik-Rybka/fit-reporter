import { useState, useEffect } from "react";
import { 
  FolderOpen, 
  FileDown, 
  Info, 
  Sliders, 
  LineChart, 
  Palette, 
  FileEdit, 
  Loader,
  Bike,
  Footprints,
  Activity
} from "lucide-react";
import { open, save, ask } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import "./App.css";

import { parseFitFile, type FitActivity } from "./utils/fitParser";
import { ReportPreview } from "./components/ReportPreview";
import { generateWordDocument } from "./utils/wordExporter";


const mockActivity: FitActivity = {
  name: "Odpolední silniční švih podél řeky",
  sport: "Cyklistika",
  date: "16. 6. 2026, 15:42",
  distance: 34.25,
  durationSeconds: 5214, // 1h 26m 54s
  avgSpeed: 23.6,
  maxSpeed: 42.1,
  avgHr: 142,
  maxHr: 172,
  calories: 840,
  elevationGain: 312,
  splits: [
    { km: 5, time: "12:15", avgHr: 132 },
    { km: 10, time: "11:58", avgHr: 138 },
    { km: 15, time: "12:45", avgHr: 145 },
    { km: 20, time: "13:10", avgHr: 149 },
    { km: 25, time: "12:05", avgHr: 140 },
    { km: 30, time: "14:20", avgHr: 155 },
    { km: 34.2, time: "10:21", avgHr: 151 },
  ],
  hrData: [110, 115, 122, 128, 132, 135, 138, 142, 145, 147, 149, 148, 142, 139, 141, 146, 150, 155, 158, 162, 168, 172, 169, 160, 154, 148, 146, 144, 142, 145, 148, 150, 152],
  elevationData: [210, 212, 215, 220, 225, 232, 238, 245, 252, 260, 275, 290, 310, 325, 335, 342, 345, 340, 320, 295, 270, 250, 235, 222, 215, 212, 218, 225, 235, 242, 248, 250, 246],
  speedData: [18.5, 21.0, 22.5, 24.0, 25.5, 26.2, 25.8, 23.5, 20.2, 18.0, 15.2, 12.8, 14.5, 16.8, 19.5, 22.0, 24.2, 26.8, 28.5, 32.1, 35.6, 42.1, 38.2, 30.5, 27.2, 25.0, 24.8, 26.5, 28.0, 27.2, 26.0, 25.5, 22.0],
  coordinates: [
    [50.0755, 14.4378], [50.0768, 14.4390], [50.0782, 14.4405], [50.0795, 14.4422], [50.0810, 14.4440],
    [50.0832, 14.4455], [50.0855, 14.4470], [50.0880, 14.4485], [50.0905, 14.4492], [50.0930, 14.4502],
    [50.0955, 14.4515], [50.0980, 14.4532], [50.1005, 14.4548], [50.1032, 14.4562], [50.1060, 14.4578],
    [50.1085, 14.4595], [50.1110, 14.4612], [50.1135, 14.4630], [50.1160, 14.4645], [50.1182, 14.4658],
    [50.1205, 14.4672], [50.1228, 14.4688], [50.1250, 14.4705], [50.1272, 14.4720], [50.1295, 14.4735],
    [50.1318, 14.4752], [50.1340, 14.4768], [50.1362, 14.4782], [50.1385, 14.4798], [50.1408, 14.4812],
    [50.1430, 14.4828], [50.1452, 14.4842], [50.1475, 14.4858]
  ]
};

function App() {
  const [activeTab, setActiveTab] = useState<string>("summary");
  const [filePath, setFilePath] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("Aplikace připravena");
  const [activity, setActivity] = useState<FitActivity | null>(null);
  const [recentActivities, setRecentActivities] = useState<FitActivity[]>([]);
  
  // Customization Configuration
  const [showMap, setShowMap] = useState<boolean>(true);
  const [showHeartRate, setShowHeartRate] = useState<boolean>(true);
  const [showSpeed, setShowSpeed] = useState<boolean>(true);
  const [showElevation, setShowElevation] = useState<boolean>(true);
  const [showSplits, setShowSplits] = useState<boolean>(true);
  
  const [theme, setTheme] = useState<'garmin' | 'strava' | 'mono'>('garmin');
  const [fontFamily, setFontFamily] = useState<string>("var(--font-sans)");
  const [customTitle, setCustomTitle] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [mapStyle, setMapStyle] = useState<'osm' | 'satellite' | 'tourist'>('osm');
  const [mapColoredBySpeed, setMapColoredBySpeed] = useState<boolean>(true);

  // Set default accent color based on theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'garmin') {
      root.style.setProperty('--color-accent', 'var(--color-accent-garmin)');
      root.style.setProperty('--color-accent-hover', '#005fa0');
    } else if (theme === 'strava') {
      root.style.setProperty('--color-accent', 'var(--color-accent-strava)');
      root.style.setProperty('--color-accent-hover', '#df4300');
    } else {
      root.style.setProperty('--color-accent', 'var(--color-accent-mono)');
      root.style.setProperty('--color-accent-hover', '#2563eb');
    }
  }, [theme]);

  // Load recent activities list from localStorage on startup
  useEffect(() => {
    const saved = localStorage.getItem("recent_activities");
    if (saved) {
      try {
        setRecentActivities(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse recent activities", e);
      }
    }
    setStatusText("Aplikace připravena");
  }, []);

  // Check for updates on startup
  useEffect(() => {
    const runUpdater = async () => {
      try {
        console.log("Checking for updates...");
        const update = await check();
        if (update) {
          console.log(`Update found: ${update.version}`);
          const confirmed = await ask(
            `Nová verze v${update.version} je k dispozici. Chcete ji stáhnout a nainstalovat?\n\nPoznámky k vydání:\n${update.body || 'Žádné poznámky'}`,
            { title: "Aktualizace aplikace", kind: "info", okLabel: "Aktualizovat", cancelLabel: "Zrušit" }
          );
          if (confirmed) {
            setStatusText("Stahování a instalace aktualizace...");
            setLoading(true);
            await update.downloadAndInstall();
            setStatusText("Restartuji aplikaci...");
            await relaunch();
          }
        } else {
          console.log("Žádné nové aktualizace");
        }
      } catch (err) {
        console.error("Failed to check for updates", err);
      }
    };

    // Run update check after a brief delay so the app UI loads fully first
    const timer = setTimeout(() => {
      runUpdater();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleOpenFile = async () => {
    try {
      setStatusText("Otevírám souborový dialog...");
      const selected = await open({
        multiple: false,
        filters: [{
          name: "Sportovní aktivita (*.fit)",
          extensions: ["fit"]
        }]
      });

      if (selected && typeof selected === "string") {
        setLoading(true);
        setStatusText("Načítám soubor...");
        setFilePath(selected);
        
        // Read the file as binary array
        const bytes = await readFile(selected);
        setStatusText(`Načteno ${bytes.length} bajtů ze souboru.`);
        // Parse actual FIT file bytes using our utility
        try {
          const arrayBuffer = bytes.buffer;
          const parsedActivity = await parseFitFile(arrayBuffer);
          const fileName = selected.split(/[\\/]/).pop() || selected;
          parsedActivity.name = fileName.replace(/\.[^/.]+$/, "");
          
          setActivity(parsedActivity);
          setCustomTitle(parsedActivity.name);
          setLoading(false);
          setStatusText(`Úspěšně naparsován soubor ${fileName}`);

          // Save to recent list
          setRecentActivities(prev => {
            const filtered = prev.filter(act => act.name !== parsedActivity.name || act.date !== parsedActivity.date);
            const updated = [parsedActivity, ...filtered].slice(0, 5);
            localStorage.setItem("recent_activities", JSON.stringify(updated));
            return updated;
          });
        } catch (parseError) {
          console.error(parseError);
          setLoading(false);
          setStatusText(`Chyba při parsování FIT souboru: ${parseError}`);
        }
      } else {
        setStatusText("Výběr souboru zrušen");
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
      setStatusText(`Chyba při otevírání souboru: ${error}`);
    }
  };

  const handleExportPDF = async () => {
    if (!activity) return;
    
    try {
      setStatusText("Zahajuji export do PDF...");
      
      const pageCount = document.querySelectorAll(".a4-page").length;
      if (pageCount === 0) {
        setStatusText("Chyba: Náhled reportu nebyl nalezen.");
        return;
      }

      // Open Tauri native save dialog
      const defaultName = `${activity.name.replace(/\s+/g, "_")}_report.pdf`;
      const filePath = await save({
        filters: [{
          name: "PDF Dokument (*.pdf)",
          extensions: ["pdf"]
        }],
        defaultPath: defaultName
      });

      if (!filePath) {
        setStatusText("Export do PDF zrušen.");
        return;
      }

      setLoading(true);
      setStatusText("Generuji PDF (vykreslování stránek)...");

      // Wait 100ms to allow React to finish rerendering after setting loading=true
      await new Promise(resolve => setTimeout(resolve, 100));

      const pdf = new jsPDF("p", "mm", "a4");

      for (let i = 0; i < pageCount; i++) {
        // Query the fresh, currently attached DOM element to avoid stale/detached nodes
        const pageElement = document.getElementById(`a4-page-${i}`);
        if (!pageElement) {
          console.warn(`Element a4-page-${i} not found in DOM`);
          continue;
        }

        // Temporarily hide map zoom controls on this page
        const mapZoom = pageElement.querySelector(".leaflet-control-zoom") as HTMLElement;
        if (mapZoom) mapZoom.style.display = "none";

        // Render the page element using html2canvas
        const canvas = await html2canvas(pageElement, {
          scale: 2, // Retain high quality for printing
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          allowTaint: true
        });

        // Restore map zoom controls
        if (mapZoom) mapZoom.style.display = "";

        const imgWidth = 210; // A4 width in mm
        const imgHeight = 297; // A4 height in mm
        const imgData = canvas.toDataURL("image/png");

        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      }

      setStatusText("Ukládám PDF soubor na disk...");

      // Convert jsPDF output to Uint8Array for Tauri fs
      const pdfOutput = pdf.output("arraybuffer");
      const pdfBytes = new Uint8Array(pdfOutput);

      // Save PDF via Tauri filesystem
      await writeFile(filePath, pdfBytes);

      setLoading(false);
      const fileName = filePath.split(/[\\/]/).pop() || filePath;
      setStatusText(`PDF úspěšně exportováno do: ${fileName}`);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setStatusText(`Chyba při exportu do PDF: ${err}`);
    }
  };

  const handleExportWord = async () => {
    if (!activity) return;

    try {
      setStatusText("Zahajuji export do Wordu...");

      // Open Tauri native save dialog
      const defaultName = `${activity.name.replace(/\s+/g, "_")}_report.docx`;
      const filePath = await save({
        filters: [{
          name: "Word Dokument (*.docx)",
          extensions: ["docx"]
        }],
        defaultPath: defaultName
      });

      if (!filePath) {
        setStatusText("Export do Wordu zrušen.");
        return;
      }

      setLoading(true);
      setStatusText("Generuji Word dokument (vykreslování prvků)...");

      // Capture map if showMap is active and map container exists
      let mapImg: string | undefined = undefined;
      if (showMap) {
        const mapElement = document.querySelector(".map-wrapper") as HTMLElement;
        if (mapElement) {
          const mapZoom = mapElement.querySelector(".leaflet-control-zoom") as HTMLElement;
          if (mapZoom) mapZoom.style.display = "none";
          try {
            const canvas = await html2canvas(mapElement, {
              useCORS: true,
              logging: false,
              backgroundColor: "#ffffff"
            });
            mapImg = canvas.toDataURL("image/png");
          } catch (mapErr) {
            console.error("Failed to capture map canvas", mapErr);
          } finally {
            if (mapZoom) mapZoom.style.display = "";
          }
        }
      }

      // Capture chart wrappers using html2canvas with white backgrounds to prevent dark-mode transparency issues
      let hrChartImg: string | undefined = undefined;
      let speedChartImg: string | undefined = undefined;
      let elevChartImg: string | undefined = undefined;

      if (showHeartRate) {
        const wrapper = document.querySelector("#chart-item-hr .chart-container-wrapper") as HTMLElement;
        if (wrapper) {
          try {
            const canvas = await html2canvas(wrapper, {
              useCORS: true,
              logging: false,
              backgroundColor: "#ffffff"
            });
            hrChartImg = canvas.toDataURL("image/png");
          } catch (e) {
            console.error("Failed to capture HR chart", e);
          }
        }
      }
      if (showSpeed) {
        const wrapper = document.querySelector("#chart-item-speed .chart-container-wrapper") as HTMLElement;
        if (wrapper) {
          try {
            const canvas = await html2canvas(wrapper, {
              useCORS: true,
              logging: false,
              backgroundColor: "#ffffff"
            });
            speedChartImg = canvas.toDataURL("image/png");
          } catch (e) {
            console.error("Failed to capture speed chart", e);
          }
        }
      }
      if (showElevation) {
        const wrapper = document.querySelector("#chart-item-elevation .chart-container-wrapper") as HTMLElement;
        if (wrapper) {
          try {
            const canvas = await html2canvas(wrapper, {
              useCORS: true,
              logging: false,
              backgroundColor: "#ffffff"
            });
            elevChartImg = canvas.toDataURL("image/png");
          } catch (e) {
            console.error("Failed to capture elevation chart", e);
          }
        }
      }

      setStatusText("Skládám strukturu Word souboru...");

      const docBlob = await generateWordDocument(
        activity,
        {
          theme,
          fontFamily,
          customTitle,
          notes,
          showMap,
          showHeartRate,
          showSpeed,
          showElevation,
          showSplits
        },
        {
          mapImg,
          hrChartImg,
          speedChartImg,
          elevChartImg
        }
      );

      setStatusText("Ukládám Word soubor na disk...");

      // Convert Blob to Uint8Array for Tauri fs
      const arrayBuffer = await docBlob.arrayBuffer();
      const docBytes = new Uint8Array(arrayBuffer);

      // Save document via Tauri filesystem
      await writeFile(filePath, docBytes);

      setLoading(false);
      const fileName = filePath.split(/[\\/]/).pop() || filePath;
      setStatusText(`Word úspěšně exportován do: ${fileName}`);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setStatusText(`Chyba při exportu do Wordu: ${err}`);
    }
  };

  // Formatting helpers
  const formatDuration = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`app-container theme-${theme}`}>
      {/* Top Toolbar */}
      <header className="toolbar">
        <div className="toolbar-group">
          <button className="toolbar-btn btn-primary" onClick={handleOpenFile} disabled={loading}>
            <FolderOpen size={16} />
            Otevřít soubor
          </button>
          {filePath && (
            <span className="file-info" title={filePath}>
              {filePath.split(/[\\/]/).pop()}
            </span>
          )}
        </div>
        
        <div className="toolbar-group">
          <button 
            className="toolbar-btn" 
            onClick={handleExportPDF} 
            disabled={!activity || loading}
          >
            <FileDown size={16} />
            Export PDF
          </button>
          <button 
            className="toolbar-btn" 
            onClick={handleExportWord} 
            disabled={!activity || loading}
          >
            <FileDown size={16} />
            Export Word (.docx)
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="workspace">
        
        {/* Settings Panel */}
        <aside className="settings-panel">
          <nav className="tabs-header">
            <button 
              className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              <Info size={14} />
              Souhrn
            </button>
            <button 
              className={`tab-btn ${activeTab === 'metrics' ? 'active' : ''}`}
              onClick={() => setActiveTab('metrics')}
            >
              <Sliders size={14} />
              Metriky
            </button>
            <button 
              className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
              onClick={() => setActiveTab('charts')}
            >
              <LineChart size={14} />
              Grafy & Mapa
            </button>
            <button 
              className={`tab-btn ${activeTab === 'style' ? 'active' : ''}`}
              onClick={() => setActiveTab('style')}
            >
              <Palette size={14} />
              Vzhled
            </button>
            <button 
              className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              <FileEdit size={14} />
              Poznámky
            </button>
          </nav>

          <div className="tabs-content">
            {activeTab === 'summary' && (
              <>
                <div>
                  <h3 className="section-title">Informace o aktivitě</h3>
                  {activity ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                      <p><span style={{ color: 'var(--color-text-muted)' }}>Název:</span> {activity.name}</p>
                      <p><span style={{ color: 'var(--color-text-muted)' }}>Sport:</span> {activity.sport}</p>
                      <p><span style={{ color: 'var(--color-text-muted)' }}>Datum:</span> {activity.date}</p>
                      <p><span style={{ color: 'var(--color-text-muted)' }}>Vzdálenost:</span> {activity.distance} km</p>
                      <p><span style={{ color: 'var(--color-text-muted)' }}>Čas trvání:</span> {formatDuration(activity.durationSeconds)}</p>
                      {activity.debugText && (
                        <details className="debug-details">
                          <summary className="debug-summary">
                            <span>Struktura dat (Debug)</span>
                          </summary>
                          <div className="debug-content">
                            <textarea 
                              readOnly 
                              value={activity.debugText} 
                              className="debug-textarea"
                            />
                          </div>
                        </details>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      Nahrajte .FIT soubor pro zobrazení detailů.
                    </p>
                  )}
                </div>
              </>
            )}

            {activeTab === 'metrics' && (
              <>
                <h3 className="section-title">Co zahrnout do reportu</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label className="checkbox-label">
                    <span>Mapa trasy</span>
                    <input 
                      type="checkbox" 
                      checked={showMap} 
                      onChange={(e) => setShowMap(e.target.checked)} 
                    />
                    <span className="checkbox-custom"></span>
                  </label>
                  <label className="checkbox-label">
                    <span>Graf srdečního tepu</span>
                    <input 
                      type="checkbox" 
                      checked={showHeartRate} 
                      onChange={(e) => setShowHeartRate(e.target.checked)} 
                    />
                    <span className="checkbox-custom"></span>
                  </label>
                  <label className="checkbox-label">
                    <span>Graf rychlosti / tempa</span>
                    <input 
                      type="checkbox" 
                      checked={showSpeed} 
                      onChange={(e) => setShowSpeed(e.target.checked)} 
                    />
                    <span className="checkbox-custom"></span>
                  </label>
                  <label className="checkbox-label">
                    <span>Graf výškového profilu</span>
                    <input 
                      type="checkbox" 
                      checked={showElevation} 
                      onChange={(e) => setShowElevation(e.target.checked)} 
                    />
                    <span className="checkbox-custom"></span>
                  </label>
                  <label className="checkbox-label">
                    <span>Tabulka mezičasů (Laps)</span>
                    <input 
                      type="checkbox" 
                      checked={showSplits} 
                      onChange={(e) => setShowSplits(e.target.checked)} 
                    />
                    <span className="checkbox-custom"></span>
                  </label>
                </div>
              </>
            )}

            {activeTab === 'charts' && (
              <>
                <h3 className="section-title">Vzhled mapy a grafů</h3>
                <div className="control-group">
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Styl mapy</label>
                  <select 
                    className="select-input"
                    value={mapStyle}
                    onChange={(e) => setMapStyle(e.target.value as any)}
                  >
                    <option value="osm">Cyklistická barevná (OpenStreetMap)</option>
                    <option value="tourist">Klasická turistická (OpenTopoMap)</option>
                    <option value="satellite">Satelitní (Snímky)</option>
                  </select>
                </div>
                <div className="control-group" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="checkbox-label">
                    <span>Vybarvit trasu podle rychlosti</span>
                    <input 
                      type="checkbox" 
                      checked={mapColoredBySpeed} 
                      onChange={(e) => setMapColoredBySpeed(e.target.checked)} 
                    />
                    <span className="checkbox-custom"></span>
                  </label>
                  <label className="checkbox-label">
                    <span>Vyhladit křivky grafů</span>
                    <input type="checkbox" defaultChecked />
                    <span className="checkbox-custom"></span>
                  </label>
                </div>
              </>
            )}

            {activeTab === 'style' && (
              <>
                <h3 className="section-title">Vzhled dokumentu</h3>
                
                <div className="control-group">
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Barevné téma</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '4px' }}>
                    <button 
                      className={`toolbar-btn ${theme === 'garmin' ? 'active' : ''}`}
                      onClick={() => setTheme('garmin')}
                      style={{ borderLeft: '4px solid var(--color-accent-garmin)', justifyContent: 'center' }}
                    >
                      Garmin
                    </button>
                    <button 
                      className={`toolbar-btn ${theme === 'strava' ? 'active' : ''}`}
                      onClick={() => setTheme('strava')}
                      style={{ borderLeft: '4px solid var(--color-accent-strava)', justifyContent: 'center' }}
                    >
                      Strava
                    </button>
                    <button 
                      className={`toolbar-btn ${theme === 'mono' ? 'active' : ''}`}
                      onClick={() => setTheme('mono')}
                      style={{ borderLeft: '4px solid var(--color-accent-mono)', justifyContent: 'center' }}
                    >
                      Elegant
                    </button>
                  </div>
                </div>

                <div className="control-group" style={{ marginTop: '15px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Písmo dokumentu</label>
                  <select 
                    className="select-input"
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                  >
                    <option value="var(--font-sans)">Moderní bezpatkové (Inter)</option>
                    <option value="var(--font-display)">Výrazné sportovní (Outfit)</option>
                    <option value="Georgia, serif">Klasické patkové (Georgia)</option>
                  </select>
                </div>

                <div className="control-group" style={{ marginTop: '15px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Vlastní titulek reportu</label>
                  <input 
                    type="text" 
                    className="text-input" 
                    value={customTitle} 
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Např. Běh na 10 km"
                  />
                </div>
              </>
            )}

            {activeTab === 'notes' && (
              <>
                <h3 className="section-title">Osobní poznámky</h3>
                <div className="control-group">
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Text bude přidán na začátek vygenerovaného dokumentu.
                  </label>
                  <textarea 
                    className="textarea-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Jaký byl trénink? Jaké bylo počasí, pocity atd..."
                  />
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Live Preview Panel */}
        <main className="preview-panel" style={!activity ? { alignItems: 'center', justifyContent: 'center' } : {}}>
          {loading && !activity ? (
            <div style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>
              <Loader className="working" size={32} style={{ animation: 'spin 2s linear infinite', marginBottom: '16px' }} />
              <p>{statusText || "Nahrávám náhled reportu..."}</p>
            </div>
          ) : activity ? (
            <ReportPreview 
              activity={activity}
              showMap={showMap}
              showHeartRate={showHeartRate}
              showSpeed={showSpeed}
              showElevation={showElevation}
              showSplits={showSplits}
              theme={theme}
              fontFamily={fontFamily}
              customTitle={customTitle}
              notes={notes}
              mapStyle={mapStyle}
              mapColoredBySpeed={mapColoredBySpeed}
            />
          ) : (
            <div className="welcome-container">
              <div className="welcome-icon-wrapper">
                <FolderOpen size={36} />
              </div>
              <h2 className="welcome-title">Vytvořit report aktivity</h2>
              <p className="welcome-desc">
                Vyberte sportovní soubor .FIT z vašeho zařízení Garmin, Wahoo, Strava nebo Polar a vygenerujte čistý tištěný report.
              </p>
              
              <button className="welcome-btn-large" onClick={handleOpenFile}>
                <FolderOpen size={20} />
                Vybrat .FIT soubor
              </button>
              
              <button 
                className="welcome-demo-link" 
                onClick={() => {
                  setActivity(mockActivity);
                  setCustomTitle(mockActivity.name);
                  setStatusText("Načtena ukázková data aktivity");
                }}
              >
                Nemáte po ruce .FIT soubor? Zkuste ukázkovou aktivitu
              </button>

              {recentActivities.length > 0 && (
                <div className="recent-section">
                  <h3 className="recent-title">Nedávné aktivity</h3>
                  <div className="recent-list">
                    {recentActivities.map((act, index) => {
                      const isCycling = act.sport?.toLowerCase().includes("cyklo") || act.sport?.toLowerCase().includes("cycle") || act.sport?.toLowerCase().includes("kolo");
                      const isRun = act.sport?.toLowerCase().includes("běh") || act.sport?.toLowerCase().includes("run");
                      
                      return (
                        <div 
                          key={index} 
                          className="recent-card" 
                          onClick={() => {
                            setActivity(act);
                            setCustomTitle(act.name);
                            setStatusText(`Načtena předchozí aktivita: ${act.name}`);
                          }}
                        >
                          <div className="recent-info">
                            <div className="recent-icon">
                              {isCycling ? <Bike size={18} /> : isRun ? <Footprints size={18} /> : <Activity size={18} />}
                            </div>
                            <div className="recent-details">
                              <span className="recent-name" title={act.name}>{act.name}</span>
                              <span className="recent-meta">{act.date} • {act.sport}</span>
                            </div>
                          </div>
                          
                          <div className="recent-stats">
                            <span className="recent-stat-val"><strong>{act.distance}</strong> km</span>
                            <span className="recent-stat-val">{formatDuration(act.durationSeconds)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="statusbar">
        <div className="statusbar-item">
          <div className={`status-dot ${loading ? 'working' : ''}`} />
          <span>{statusText}</span>
        </div>
        <div>
          <span>Fit Reporter v0.1.0 (Beta)</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
