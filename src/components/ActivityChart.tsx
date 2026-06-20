import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

interface ChartProps {
  data: number[];
  label: string;
  color: string;
  fillColor: string;
  unit: string;
  lightMode?: boolean;
  minY?: number;
  maxY?: number;
}

export const ActivityChart: React.FC<ChartProps> = ({
  data,
  label,
  color,
  fillColor,
  unit,
  lightMode = true,
  minY,
  maxY,
}) => {
  // Generate X-axis labels (simple index or distance if we wanted)
  const labels = data.map((_, idx) => `${idx + 1}`);

  const chartData = {
    labels,
    datasets: [
      {
        fill: true,
        label,
        data,
        borderColor: color,
        backgroundColor: fillColor,
        borderWidth: 2,
        pointRadius: 0, // Hide points by default for clean look
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2,
        tension: 0.3, // Curve smoothing
      },
    ],
  };

  const textColor = lightMode ? "#4b5563" : "#a1a1aa";
  const gridColor = lightMode ? "#e5e7eb" : "#2e2e38";

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide legend since we have title/badge
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: lightMode ? "#1f2937" : "#1e1e24",
        titleColor: lightMode ? "#f3f4f6" : "#ffffff",
        bodyColor: lightMode ? "#f3f4f6" : "#e4e4e7",
        borderColor: lightMode ? "#e5e7eb" : "#2e2e38",
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += `${context.parsed.y} ${unit}`;
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        display: false, // Hide X axis to keep it clean (index is not very meaningful anyway)
        grid: {
          display: false,
        },
      },
      y: {
        min: minY,
        max: maxY,
        ticks: {
          color: textColor,
          font: {
            size: 10,
            family: "Inter",
          },
          callback: (value) => `${value}${unit}`,
        },
        grid: {
          color: gridColor,
        },
      },
    },
  };

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Line data={chartData} options={options} />
    </div>
  );
};
