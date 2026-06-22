import { FitActivity, Split, TelemetryPoint } from "./fitParser";

// Convert degrees to radians
const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

// Calculate distance between two GPS coordinates using the Haversine formula
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

// Format duration from seconds to MM:SS or HH:MM:SS
const formatDuration = (secs: number): string => {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = Math.floor(secs % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Translate sport type to Czech
const translateSport = (sport: string): string => {
  switch (sport?.toLowerCase()) {
    case "run":
    case "running":
    case "9":
      return "Běh";
    case "cycling":
    case "biking":
    case "bicycletraining":
    case "1":
      return "Cyklistika";
    case "swimming":
      return "Plavání";
    case "walking":
    case "walk":
      return "Chůze";
    case "hiking":
    case "hike":
      return "Turistika";
    case "fitness":
      return "Fitness";
    default:
      return sport || "Aktivita";
  }
};

// Downsample array to target number of points for clean visualization
function downsample(data: number[], targetPoints: number = 80): number[] {
  if (data.length <= targetPoints) return data;
  const step = data.length / targetPoints;
  const result: number[] = [];
  for (let i = 0; i < targetPoints; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    const slice = data.slice(start, end).filter(val => typeof val === "number" && !isNaN(val));
    if (slice.length === 0) {
      result.push(result[result.length - 1] || 0);
      continue;
    }
    const sum = slice.reduce((a, b) => a + b, 0);
    result.push(Math.round((sum / slice.length) * 10) / 10);
  }
  return result;
}

export function parseTcxFile(arrayBuffer: ArrayBuffer): Promise<FitActivity> {
  return new Promise((resolve, reject) => {
    try {
      // Decode ArrayBuffer to string
      const decoder = new TextDecoder("utf-8");
      const tcxText = decoder.decode(arrayBuffer);

      // Parse XML string
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(tcxText, "application/xml");

      // Check for parsing errors
      const parserError = xmlDoc.getElementsByTagName("parsererror");
      if (parserError.length > 0) {
        reject(new Error("Neplatný formát XML / TCX souboru."));
        return;
      }

      // 1. Extract activity metadata
      const activityEl = xmlDoc.getElementsByTagName("Activity")[0];
      const sportAttr = activityEl ? activityEl.getAttribute("Sport") : "";
      const sport = translateSport(sportAttr || "Aktivita");

      const idEl = xmlDoc.getElementsByTagName("Id")[0];
      const idTimeStr = idEl?.textContent?.trim() || "";
      
      // Extract Laps
      const laps = xmlDoc.getElementsByTagName("Lap");
      
      let startTime = new Date();
      if (idTimeStr) {
        startTime = new Date(idTimeStr);
      } else if (laps.length > 0) {
        const lapStartStr = laps[0].getAttribute("StartTime");
        if (lapStartStr) {
          startTime = new Date(lapStartStr);
        }
      }

      // Read aggregate values from Laps (more accurate than calculating from trackpoints)
      let totalLapsTime = 0;
      let totalLapsDist = 0;
      let maxLapsSpeedMps = 0;
      let totalCalories = 0;

      for (let j = 0; j < laps.length; j++) {
        const lap = laps[j];
        
        const timeEl = lap.getElementsByTagName("TotalTimeSeconds")[0];
        if (timeEl) totalLapsTime += parseFloat(timeEl.textContent || "0");

        const distEl = lap.getElementsByTagName("DistanceMeters")[0];
        if (distEl) totalLapsDist += parseFloat(distEl.textContent || "0");

        const maxSpeedEl = lap.getElementsByTagName("MaximumSpeed")[0];
        if (maxSpeedEl) {
          const mSpeed = parseFloat(maxSpeedEl.textContent || "0");
          if (mSpeed > maxLapsSpeedMps) {
            maxLapsSpeedMps = mSpeed;
          }
        }

        const calEl = lap.getElementsByTagName("Calories")[0];
        if (calEl) totalCalories += parseInt(calEl.textContent || "0", 10);
      }

      // 2. Extract track points
      const trackpoints = xmlDoc.getElementsByTagName("Trackpoint");
      if (trackpoints.length === 0) {
        reject(new Error("TCX soubor neobsahuje žádné trasové body (trackpoints)."));
        return;
      }

      interface TempPoint {
        lat: number;
        lon: number;
        ele: number | null;
        time: Date | null;
        hr: number | null;
        distanceMeters: number | null;
        speed: number | null;
      }

      const points: TempPoint[] = [];

      for (let i = 0; i < trackpoints.length; i++) {
        const tp = trackpoints[i];
        
        let lat = null;
        let lon = null;
        const latEl = tp.getElementsByTagName("LatitudeDegrees")[0];
        const lonEl = tp.getElementsByTagName("LongitudeDegrees")[0];
        if (latEl && lonEl) {
          lat = parseFloat(latEl.textContent || "");
          lon = parseFloat(lonEl.textContent || "");
        }

        const altitudeEl = tp.getElementsByTagName("AltitudeMeters")[0];
        const ele = altitudeEl ? parseFloat(altitudeEl.textContent || "") : null;

        const timeEl = tp.getElementsByTagName("Time")[0];
        const time = timeEl ? new Date(timeEl.textContent || "") : null;

        const hrEl = tp.getElementsByTagName("HeartRateBpm")[0]?.getElementsByTagName("Value")[0];
        const hr = hrEl ? parseInt(hrEl.textContent || "", 10) : null;

        const distEl = tp.getElementsByTagName("DistanceMeters")[0];
        const distanceMeters = distEl ? parseFloat(distEl.textContent || "") : null;

        // Speed from extensions (typically tp -> Extensions -> TPX -> Speed)
        const speedEl = tp.getElementsByTagName("Speed")[0];
        const speed = speedEl ? parseFloat(speedEl.textContent || "") : null;

        // We only add points that have valid GPS coordinates
        if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
          points.push({ lat, lon, ele, time, hr, distanceMeters, speed });
        }
      }

      if (points.length === 0) {
        reject(new Error("Nebyly nalezeny platné GPS souřadnice v trasových bodech."));
        return;
      }

      // Check if points have timestamps
      let hasTimes = true;
      for (let i = 0; i < points.length; i++) {
        if (!points[i].time || isNaN(points[i].time!.getTime())) {
          hasTimes = false;
          break;
        }
      }

      if (!hasTimes) {
        const dummyStart = startTime || new Date();
        points.forEach((p, idx) => {
          p.time = new Date(dummyStart.getTime() + idx * 5000); // 5-second interval
        });
      }

      // Sort points by time just in case
      points.sort((a, b) => a.time!.getTime() - b.time!.getTime());

      // 3. Process track points
      const rawHr: number[] = [];
      const rawElev: number[] = [];
      const rawSpeed: number[] = [];
      const coordinates: [number, number][] = [];
      const telemetryData: TelemetryPoint[] = [];
      const cumulativeDistances: number[] = [0];

      let calculatedDistance = 0;
      let eleGain = 0;

      // Extract raw arrays
      points.forEach((p) => {
        if (p.hr !== null && !isNaN(p.hr)) rawHr.push(p.hr);
        if (p.ele !== null && !isNaN(p.ele)) rawElev.push(p.ele);
        coordinates.push([p.lat, p.lon]);
      });

      // Smooth elevation data
      const smoothedElevations: number[] = [];
      const elevWindowSize = 5;
      for (let i = 0; i < rawElev.length; i++) {
        let sum = 0;
        let count = 0;
        const halfWindow = Math.floor(elevWindowSize / 2);
        for (let j = Math.max(0, i - halfWindow); j <= Math.min(rawElev.length - 1, i + halfWindow); j++) {
          sum += rawElev[j];
          count++;
        }
        smoothedElevations.push(sum / count);
      }

      // Calculate distances, speeds, and elevation gains
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];

        // Fallback distance calculation if lap distance is not useful
        const d = getDistance(prev.lat, prev.lon, curr.lat, curr.lon);
        calculatedDistance += d;
        
        // Use trackpoint DistanceMeters if available, otherwise fallback to GPS calculation
        let runningDist = 0;
        if (curr.distanceMeters !== null) {
          runningDist = curr.distanceMeters / 1000;
        } else {
          runningDist = calculatedDistance;
        }
        cumulativeDistances.push(runningDist);

        // Elevation Gain
        if (rawElev.length > 0) {
          const eleDiff = smoothedElevations[i] - smoothedElevations[i - 1];
          if (eleDiff > 0.1) {
            eleGain += eleDiff;
          }
        }

        // Speed (either use speed from extensions or calculate)
        let speed = 0;
        if (curr.speed !== null && !isNaN(curr.speed)) {
          speed = curr.speed * 3.6; // convert m/s to km/h
        } else {
          const dt = (curr.time!.getTime() - prev.time!.getTime()) / 1000;
          if (dt > 0) {
            const stepDist = (curr.distanceMeters !== null && prev.distanceMeters !== null) 
              ? (curr.distanceMeters - prev.distanceMeters) / 1000 
              : d;
            speed = (stepDist / dt) * 3600;
          }
        }
        if (speed > 80) speed = rawSpeed[rawSpeed.length - 1] || 0;
        rawSpeed.push(speed);
      }

      // Pad rawSpeed to match coordinates count
      if (rawSpeed.length < points.length) {
        if (rawSpeed.length > 0) {
          rawSpeed.unshift(rawSpeed[0]);
        } else {
          rawSpeed.push(0);
        }
      }

      // Populate telemetryData
      for (let i = 0; i < points.length; i++) {
        telemetryData.push({
          speed: Math.round(rawSpeed[i] * 10) / 10,
          hr: points[i].hr || 0
        });
      }

      // Aggregates
      const durationSeconds = totalLapsTime > 0 ? Math.round(totalLapsTime) : Math.round((points[points.length - 1].time!.getTime() - points[0].time!.getTime()) / 1000);
      const distanceRounded = totalLapsDist > 0 ? Math.round((totalLapsDist / 1000) * 100) / 100 : Math.round(calculatedDistance * 100) / 100;
      const elevationGainRounded = Math.round(eleGain);

      const avgHr = rawHr.length > 0 ? Math.round(rawHr.reduce((a, b) => a + b, 0) / rawHr.length) : 0;
      const maxHr = rawHr.length > 0 ? Math.max(...rawHr) : 0;

      const avgSpeed = durationSeconds > 0 ? Math.round((distanceRounded / (durationSeconds / 3600)) * 10) / 10 : 0;
      const maxSpeed = maxLapsSpeedMps > 0 ? Math.round(maxLapsSpeedMps * 3.6 * 10) / 10 : (rawSpeed.length > 0 ? Math.round(Math.max(...rawSpeed) * 10) / 10 : 0);

      // Extract calories
      let calories = totalCalories;
      if (calories === 0) {
        if (avgHr > 0 && durationSeconds > 0) {
          calories = Math.round((durationSeconds / 60) * (avgHr / 15));
        } else {
          calories = Math.round(distanceRounded * 65);
        }
      }

      // Date Formatting
      const dateString = startTime.toLocaleString("cs-CZ", { 
        dateStyle: "medium", 
        timeStyle: "short" 
      });

      const finalName = `${sport} - ${startTime.toLocaleDateString("cs-CZ")}`;

      // Generate splits (every 1 km)
      const splits: Split[] = [];
      let lastSplitIndex = 0;
      const totalKm = Math.floor(distanceRounded);
      const activeDistances = cumulativeDistances;

      for (let km = 1; km <= totalKm; km++) {
        let targetIndex = 0;
        for (let i = 0; i < activeDistances.length; i++) {
          if (activeDistances[i] >= km) {
            targetIndex = i;
            break;
          }
        }

        const timeDiffMs = points[targetIndex].time!.getTime() - points[lastSplitIndex].time!.getTime();
        const timeDiffSec = Math.round(timeDiffMs / 1000);

        let hrSum = 0;
        let hrCount = 0;
        for (let i = lastSplitIndex; i <= targetIndex; i++) {
          if (points[i].hr) {
            hrSum += points[i].hr!;
            hrCount++;
          }
        }
        const splitAvgHr = hrCount > 0 ? Math.round(hrSum / hrCount) : avgHr;

        splits.push({
          km: km,
          time: formatDuration(timeDiffSec),
          avgHr: splitAvgHr
        });
        lastSplitIndex = targetIndex;
      }

      // Add remaining fractional km split
      if (distanceRounded > totalKm && distanceRounded - totalKm > 0.05) {
        const lastIndex = points.length - 1;
        const timeDiffMs = points[lastIndex].time!.getTime() - points[lastSplitIndex].time!.getTime();
        const timeDiffSec = Math.round(timeDiffMs / 1000);

        let hrSum = 0;
        let hrCount = 0;
        for (let i = lastSplitIndex; i <= lastIndex; i++) {
          if (points[i].hr) {
            hrSum += points[i].hr!;
            hrCount++;
          }
        }
        const splitAvgHr = hrCount > 0 ? Math.round(hrSum / hrCount) : avgHr;

        splits.push({
          km: distanceRounded,
          time: formatDuration(timeDiffSec),
          avgHr: splitAvgHr
        });
      }

      // Downsample
      const hrData = downsample(rawHr, 80);
      const elevationData = downsample(smoothedElevations, 80);
      const speedData = downsample(rawSpeed, 80);

      const debugText = JSON.stringify({
        source: "TCX Parser",
        pointsCount: points.length,
        hasHeartRate: rawHr.length > 0,
        hasElevation: rawElev.length > 0,
        avgHr,
        maxHr,
        avgSpeed,
        maxSpeed,
        elevationGain: elevationGainRounded,
        totalDistance: distanceRounded
      }, null, 2);

      resolve({
        name: finalName,
        sport,
        date: dateString,
        distance: distanceRounded,
        durationSeconds,
        avgSpeed,
        maxSpeed,
        avgHr,
        maxHr,
        calories,
        elevationGain: elevationGainRounded,
        splits,
        hrData: hrData.length > 0 ? hrData : [120, 130, 140, 150, 145, 140],
        elevationData: elevationData.length > 0 ? elevationData : [100, 110, 120, 130, 115, 100],
        speedData: speedData.length > 0 ? speedData : [10, 12, 14, 15, 13, 11],
        coordinates: coordinates.length > 0 ? coordinates : [[50.0755, 14.4378]],
        telemetryData: telemetryData.length > 0 ? telemetryData : undefined,
        debugText
      });

    } catch (err) {
      reject(err);
    }
  });
}
