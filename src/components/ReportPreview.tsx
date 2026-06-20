import React from "react";
import { Compass, Clock, TrendingUp, Heart } from "lucide-react";
import { InteractiveMap } from "./InteractiveMap";
import { ActivityChart } from "./ActivityChart";
import { type FitActivity } from "../utils/fitParser";
import "./ReportPreview.css";

interface ReportPreviewProps {
  activity: FitActivity;
  showMap: boolean;
  showHeartRate: boolean;
  showSpeed: boolean;
  showElevation: boolean;
  showSplits: boolean;
  theme: "garmin" | "strava" | "mono";
  fontFamily: string;
  customTitle: string;
  notes: string;
  mapStyle: "osm" | "satellite" | "tourist";
  mapColoredBySpeed: boolean;
}

export const ReportPreview: React.FC<ReportPreviewProps> = ({
  activity,
  showMap,
  showHeartRate,
  showSpeed,
  showElevation,
  showSplits,
  theme,
  fontFamily,
  customTitle,
  notes,
  mapStyle,
  mapColoredBySpeed,
}) => {
  // Helper to format duration seconds to string
  const formatDuration = (secs: number): string => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Determine accent color value
  const accentColor =
    theme === "garmin"
      ? "var(--color-accent-garmin)"
      : theme === "strava"
      ? "var(--color-accent-strava)"
      : "var(--color-accent-mono)";

  // Dynamic Pagination Logic
  // A4 content height is 1123px - 96px (margins) = 1027px. We target 980px for a safety margin.
  const getNotesHeight = (text: string): number => {
    if (!text) return 0;
    const charsPerLine = 85;
    const lines = Math.ceil(text.length / charsPerLine);
    return 40 + lines * 20; // base padding + line height estimation
  };

  const summaryHeight = 180 + getNotesHeight(notes);
  const mapHeight = showMap ? 290 : 0;

  const numCharts = (showHeartRate ? 1 : 0) + (showSpeed ? 1 : 0) + (showElevation ? 1 : 0);
  const chartsHeight = numCharts > 0 ? (numCharts * 145 + 60) : 0; // Header + charts + margin

  const splitsList = (showSplits && activity.splits) ? activity.splits : [];
  const splitsRowHeight = 38;
  const splitsHeaderHeight = 80;

  interface PageBlock {
    type: "summary" | "map" | "charts" | "splits";
    splits?: typeof activity.splits;
    isFirstSplitsChunk?: boolean;
  }

  const pages: PageBlock[][] = [];

  // Build Page 1
  let page1Blocks: PageBlock[] = [{ type: "summary" }];
  let page1Height = summaryHeight;

  if (showMap) {
    page1Blocks.push({ type: "map" });
    page1Height += mapHeight;
  }

  // Check if charts fit on Page 1
  let chartsPlaced = false;
  if (numCharts > 0) {
    if (page1Height + chartsHeight <= 980) {
      page1Blocks.push({ type: "charts" });
      page1Height += chartsHeight;
      chartsPlaced = true;
    }
  }

  pages.push(page1Blocks);

  // If charts were not placed on Page 1, they go to Page 2
  let currentPageIndex = 0;
  let currentPageHeight = page1Height;

  if (numCharts > 0 && !chartsPlaced) {
    pages.push([{ type: "charts" }]);
    currentPageIndex = 1;
    currentPageHeight = chartsHeight;
  }

  // Handle Splits
  if (splitsList.length > 0) {
    const remainingSpace = 980 - currentPageHeight;
    const minSplitsHeightToStart = splitsHeaderHeight + 3 * splitsRowHeight; // Need space for title + header + 3 rows (approx 194px)

    if (remainingSpace >= minSplitsHeightToStart) {
      // Fit what we can on the current page
      const availableForRows = remainingSpace - splitsHeaderHeight;
      const rowsThatFit = Math.floor(availableForRows / splitsRowHeight);

      if (rowsThatFit >= splitsList.length) {
        pages[currentPageIndex].push({
          type: "splits",
          splits: splitsList,
          isFirstSplitsChunk: true
        });
      } else {
        const firstChunk = splitsList.slice(0, rowsThatFit);
        const remainingSplits = splitsList.slice(rowsThatFit);

        pages[currentPageIndex].push({
          type: "splits",
          splits: firstChunk,
          isFirstSplitsChunk: true
        });

        // Split the rest across new page(s)
        let splitsLeft = remainingSplits;
        const maxRowsPerPage = 22;

        while (splitsLeft.length > 0) {
          const chunk = splitsLeft.slice(0, maxRowsPerPage);
          splitsLeft = splitsLeft.slice(maxRowsPerPage);
          pages.push([{
            type: "splits",
            splits: chunk,
            isFirstSplitsChunk: false
          }]);
        }
      }
    } else {
      // Start splits on a brand new page
      let splitsLeft = splitsList;
      const maxRowsPerPage = 22;
      let isFirst = true;

      while (splitsLeft.length > 0) {
        const chunk = splitsLeft.slice(0, maxRowsPerPage);
        splitsLeft = splitsLeft.slice(maxRowsPerPage);
        pages.push([{
          type: "splits",
          splits: chunk,
          isFirstSplitsChunk: isFirst
        }]);
        isFirst = false;
      }
    }
  }

  return (
    <div id="report-preview-container" className="report-preview-container">
      {pages.map((pageBlocks, pageIdx) => (
        <div 
          key={pageIdx}
          id={`a4-page-${pageIdx}`}
          className={`a4-page theme-${theme} page-${pageIdx + 1}`} 
          style={{ 
            fontFamily: fontFamily,
            "--color-theme-accent": accentColor
          } as React.CSSProperties}
        >
          {pageBlocks.map((block, blockIdx) => {
            switch (block.type) {
              case "summary":
                return (
                  <React.Fragment key={blockIdx}>
                    {/* Report Header */}
                    <div className="report-header">
                      <div className="report-title-row">
                        <div>
                          <h1 className="report-title">{customTitle || activity.name}</h1>
                          <span className="report-type-badge">{activity.sport}</span>
                        </div>
                        <span className="report-date">{activity.date}</span>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="report-grid">
                      <div className="stat-card">
                        <span className="stat-label">
                          <Compass size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                          Vzdálenost
                        </span>
                        <span className="stat-value">
                          {activity.distance}
                          <span className="stat-unit">km</span>
                        </span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-label">
                          <Clock size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                          Čas trvání
                        </span>
                        <span className="stat-value">
                          {formatDuration(activity.durationSeconds)}
                        </span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-label">
                          <TrendingUp size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                          Rychlost ø
                        </span>
                        <span className="stat-value">
                          {activity.avgSpeed}
                          <span className="stat-unit">km/h</span>
                        </span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-label">
                          <Heart size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                          Průměrný tep
                        </span>
                        <span className="stat-value">
                          {activity.avgHr}
                          <span className="stat-unit">bpm</span>
                        </span>
                      </div>
                    </div>

                    {/* Personal Notes Box */}
                    {notes && (
                      <div className="report-section">
                        <div className="notes-box">
                          <strong>Poznámky k aktivitě:</strong><br />
                          {notes}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              case "map":
                return (
                  <div className="report-section" key={blockIdx}>
                    <h2 className="report-section-title">Mapa trasy</h2>
                    <div className="map-wrapper" style={{ height: "250px", position: "relative" }}>
                      <InteractiveMap 
                        coordinates={activity.coordinates} 
                        telemetryData={mapColoredBySpeed ? activity.telemetryData : undefined}
                        mapStyle={mapStyle}
                        strokeColor={accentColor}
                      />
                    </div>
                  </div>
                );
              case "charts":
                return (
                  <div className="report-section charts-section" key={blockIdx}>
                    <h2 className="report-section-title">Výkonové grafy</h2>
                    
                    {showHeartRate && (
                      <div className="chart-item" id="chart-item-hr">
                        <div className="chart-info-header">
                          <span>Graf srdečního tepu</span>
                          <span>Max: {activity.maxHr} bpm | Průměr: {activity.avgHr} bpm</span>
                        </div>
                        <div className="chart-container-wrapper" style={{ height: "105px" }}>
                          <ActivityChart 
                            data={activity.hrData}
                            label="Srdeční tep"
                            color="#ef4444"
                            fillColor="rgba(239, 68, 68, 0.08)"
                            unit="bpm"
                            minY={80}
                            maxY={200}
                            lightMode={true}
                          />
                        </div>
                      </div>
                    )}

                    {showSpeed && (
                      <div className="chart-item" id="chart-item-speed">
                        <div className="chart-info-header">
                          <span>Graf rychlosti</span>
                          <span>Max: {activity.maxSpeed} km/h | Průměr: {activity.avgSpeed} km/h</span>
                        </div>
                        <div className="chart-container-wrapper" style={{ height: "105px" }}>
                          <ActivityChart 
                            data={activity.speedData}
                            label="Rychlost"
                            color={accentColor}
                            fillColor={
                              theme === "garmin"
                                ? "rgba(0, 119, 200, 0.08)"
                                : theme === "strava"
                                ? "rgba(252, 82, 0, 0.08)"
                                : "rgba(59, 130, 246, 0.08)"
                            }
                            unit="km/h"
                            minY={0}
                            lightMode={true}
                          />
                        </div>
                      </div>
                    )}

                    {showElevation && (
                      <div className="chart-item" id="chart-item-elevation">
                        <div className="chart-info-header">
                          <span>Výškový profil</span>
                          <span>Nastoupáno: {activity.elevationGain} m</span>
                        </div>
                        <div className="chart-container-wrapper" style={{ height: "105px" }}>
                          <ActivityChart 
                            data={activity.elevationData}
                            label="Nadmořská výška"
                            color="#10b981"
                            fillColor="rgba(16, 185, 129, 0.08)"
                            unit="m"
                            lightMode={true}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              case "splits":
                return (
                  <div className="report-section splits-section" key={blockIdx}>
                    <h2 className="report-section-title">
                      {block.isFirstSplitsChunk ? "Úseky a mezičasy" : "Úseky a mezičasy (pokračování)"}
                    </h2>
                    <table className="splits-table">
                      <thead>
                        <tr>
                          <th>Kilometr (Úsek)</th>
                          <th>Čas úseku</th>
                          <th>Průměrný tep</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.splits?.map((split, idx) => (
                          <tr key={idx}>
                            <td><strong>{split.km} km</strong></td>
                            <td>{split.time}</td>
                            <td>{split.avgHr} bpm</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              default:
                return null;
            }
          })}
        </div>
      ))}
    </div>
  );
};
