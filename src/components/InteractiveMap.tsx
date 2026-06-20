import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { mkdir, writeFile, exists } from "@tauri-apps/plugin-fs";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";

interface TelemetryPoint {
  speed: number;
  hr: number;
}

interface InteractiveMapProps {
  coordinates: [number, number][];
  telemetryData?: TelemetryPoint[];
  mapStyle?: "osm" | "satellite" | "tourist";
  strokeColor?: string;
}

// Convert speed to heat-map HSL color (Blue -> Green -> Red)
function getColorForSpeed(speed: number, maxSpeed: number): string {
  if (speed === undefined || speed === null || speed === 0) return "#3b82f6";
  
  // Scale between 0 and maxSpeed (cap at 45 km/h for cycling to make changes visible)
  const speedCap = Math.min(Math.max(maxSpeed, 15), 45);
  const percent = Math.min(Math.max(speed / speedCap, 0), 1);
  
  // Mapping to HSL color:
  // 0% (Slow) -> Hue 240 (Blue)
  // 50% (Medium) -> Hue 120 (Green)
  // 100% (Fast) -> Hue 0 (Red)
  const hue = 240 - (percent * 240);
  return `hsl(${hue}, 90%, 45%)`;
}

// Custom tile loading helper with disk caching
async function getCachedTileOrDownload(z: number, x: number, y: number, onlineUrl: string, mapStyle: string): Promise<string> {
  try {
    const appDataPath = await appLocalDataDir();
    // Save to AppData/Local/com.lenovo.tauri-app/map-tiles/[style]/z/x/y.png
    const tileDir = await join(appDataPath, "map-tiles", mapStyle, `${z}`, `${x}`);
    const tilePath = await join(tileDir, `${y}.png`);

    const isOnline = navigator.onLine;

    if (isOnline) {
      try {
        // Download fresh tile, overwriting the old one on disk
        const response = await fetch(onlineUrl);
        if (response.ok) {
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          await mkdir(tileDir, { recursive: true });
          await writeFile(tilePath, uint8Array);

          // Return the local path src
          return convertFileSrc(tilePath);
        }
      } catch (err) {
        console.warn("Failed to fetch online tile, trying disk cache:", err);
      }
    }

    // Offline or download failed -> look for cached file on disk
    const cached = await exists(tilePath);
    if (cached) {
      return convertFileSrc(tilePath);
    }

    // Completely offline and no cache -> return transparent base64 spacer
    if (!isOnline) {
      return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'></svg>";
    }

    return onlineUrl;
  } catch (error) {
    console.error("Error in tile cache manager:", error);
    return onlineUrl;
  }
}

// Create custom Leaflet TileLayer that routes requests to our caching loader
const CacheTileLayer = L.TileLayer.extend({
  initialize: function (urlTemplate: string, options: any) {
    this.mapStyle = options.mapStyle || "osm";
    (L.TileLayer.prototype as any).initialize.call(this, urlTemplate, options);
  },
  createTile: function (coords: any, done: any) {
    const tile = document.createElement("img");
    const { x, y, z } = coords;
    
    // Get online URL using standard tile layer logic
    const onlineUrl = this.getTileUrl(coords);

    getCachedTileOrDownload(z, x, y, onlineUrl, this.mapStyle)
      .then((src) => {
        tile.src = src;
        done(null, tile);
      })
      .catch((err) => {
        console.error("CacheTileLayer failed:", err);
        tile.src = onlineUrl;
        done(null, tile);
      });

    return tile;
  },
});

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  coordinates,
  telemetryData,
  mapStyle = "osm",
  strokeColor = "var(--color-accent, #3b82f6)",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || !coordinates || coordinates.length < 2) return;

    // Create map instance
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false, // Hide for clean look
    });
    mapInstanceRef.current = map;

    // Pick tile URL template based on style
    let tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    if (mapStyle === "tourist") {
      tileUrl = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
    } else if (mapStyle === "satellite") {
      tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    }

    // Add our custom caching tile layer
    // @ts-ignore - Leaflet custom class instantiation
    const cacheLayer = new CacheTileLayer(tileUrl, { 
      mapStyle,
      subdomains: mapStyle === "tourist" ? "abc" : ""
    });
    cacheLayer.addTo(map);

    let mainBounds: L.LatLngBounds;

    if (telemetryData && telemetryData.length === coordinates.length) {
      // Find max speed for coloring scale
      const speeds = telemetryData.map(t => t.speed || 0);
      const maxSpeed = Math.max(...speeds, 12); // Fallback min cap

      // Draw multicolored segments
      for (let i = 0; i < coordinates.length - 1; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[i + 1];
        const speedVal = telemetryData[i]?.speed || 0;
        const color = getColorForSpeed(speedVal, maxSpeed);

        L.polyline([p1, p2], {
          color: color,
          weight: 5,
          opacity: 0.95,
        }).addTo(map);
      }
      mainBounds = L.latLngBounds(coordinates);
    } else {
      // Draw single solid line if no telemetry data is available
      const polyline = L.polyline(coordinates, {
        color: strokeColor,
        weight: 5,
        opacity: 0.85,
      }).addTo(map);
      mainBounds = polyline.getBounds();
    }

    // Fit map view to route bounds
    map.fitBounds(mainBounds, { padding: [35, 35] });

    // Custom HTML/CSS styled markers for Start and Finish
    const startIcon = L.divIcon({
      html: `<div style="background-color: #10b981; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
      className: "custom-marker",
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    const endIcon = L.divIcon({
      html: `<div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
      className: "custom-marker",
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    // Add markers
    L.marker(coordinates[0], { icon: startIcon }).addTo(map);
    L.marker(coordinates[coordinates.length - 1], { icon: endIcon }).addTo(map);

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [coordinates, telemetryData, mapStyle, strokeColor]);

  if (!coordinates || coordinates.length < 2) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        backgroundColor: "#f3f4f6",
        color: "#9ca3af",
        fontSize: "0.9rem",
        borderRadius: "8px",
        border: "1px solid #e5e7eb"
      }}>
        Žádná GPS data pro vykreslení trasy.
      </div>
    );
  }

  return (
    <div 
      ref={mapContainerRef} 
      style={{ 
        width: "100%", 
        height: "100%", 
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid #e5e7eb"
      }} 
    />
  );
};
