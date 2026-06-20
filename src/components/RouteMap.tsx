import React from "react";

interface RouteMapProps {
  coordinates: [number, number][];
  strokeColor?: string;
  width?: number;
  height?: number;
}

export const RouteMap: React.FC<RouteMapProps> = ({ 
  coordinates, 
  strokeColor = "var(--color-accent, #3b82f6)",
  width = 600,
  height = 250
}) => {
  if (!coordinates || coordinates.length < 2) {
    return (
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        height: "100%", 
        color: "#9ca3af",
        fontSize: "0.9rem"
      }}>
        Žádná GPS data pro vykreslení trasy.
      </div>
    );
  }

  // Find bounding box
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  coordinates.forEach(([lat, lon]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  });

  const latRange = maxLat - minLat;
  const lonRange = maxLon - minLon;

  // Set padding
  const padding = 20;
  const renderWidth = width - 2 * padding;
  const renderHeight = height - 2 * padding;

  // Determine scale to fit container while preserving aspect ratio
  // Standardize longitude stretch factor depending on average latitude
  const avgLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lonStretch = Math.cos(avgLatRad);
  
  const stretchedLonRange = lonRange * lonStretch;
  const scale = Math.min(
    renderWidth / (stretchedLonRange || 0.0001), 
    renderHeight / (latRange || 0.0001)
  );

  // Center route within the SVG
  const xOffset = padding + (renderWidth - stretchedLonRange * scale) / 2;
  const yOffset = padding + (renderHeight - latRange * scale) / 2;

  // Map coordinates to SVG pixels
  const points = coordinates.map(([lat, lon]) => {
    const x = xOffset + (lon - minLon) * lonStretch * scale;
    // SVG y-axis is inverted (0 is top, height is bottom)
    const y = yOffset + renderHeight - (lat - minLat) * scale;
    return { x, y };
  });

  const pathData = `M ${points[0].x},${points[0].y} ` + 
    points.slice(1).map(p => `L ${p.x},${p.y}`).join(" ");

  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
    >
      {/* Decorative Grid Lines */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" rx="8" />
      <rect width="100%" height="100%" fill="none" stroke="#e5e7eb" strokeWidth="1" rx="8" />

      {/* Route Line Shadow */}
      <path
        d={pathData}
        fill="none"
        stroke="rgba(0, 0, 0, 0.1)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: "translateY(2px)" }}
      />

      {/* Main Route Line */}
      <path
        d={pathData}
        fill="none"
        stroke={strokeColor}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Start Marker (Green Dot) */}
      <circle
        cx={startPoint.x}
        cy={startPoint.y}
        r="6"
        fill="#10b981"
        stroke="#ffffff"
        strokeWidth="2"
      />
      <circle
        cx={startPoint.x}
        cy={startPoint.y}
        r="10"
        fill="none"
        stroke="#10b981"
        strokeWidth="1.5"
        opacity="0.4"
      />

      {/* End Marker (Checkered Red Dot) */}
      <circle
        cx={endPoint.x}
        cy={endPoint.y}
        r="6"
        fill="#ef4444"
        stroke="#ffffff"
        strokeWidth="2"
      />
      
      {/* Label overlays */}
      <text x={startPoint.x + 10} y={startPoint.y + 4} fontSize="9" fontWeight="bold" fill="#047857">START</text>
      <text x={endPoint.x + 10} y={endPoint.y + 4} fontSize="9" fontWeight="bold" fill="#b91c1c">CÍL</text>
    </svg>
  );
};
