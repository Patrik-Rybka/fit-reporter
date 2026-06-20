import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  ImageRun, 
  AlignmentType, 
  BorderStyle, 
  WidthType
} from "docx";
import { type FitActivity } from "./fitParser";

// Helper to convert base64 image string to Uint8Array for docx ImageRun
function base64ToUint8Array(base64: string): Uint8Array {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function generateWordDocument(
  activity: FitActivity,
  options: {
    theme: "garmin" | "strava" | "mono";
    fontFamily: string;
    customTitle: string;
    notes: string;
    showMap: boolean;
    showHeartRate: boolean;
    showSpeed: boolean;
    showElevation: boolean;
    showSplits: boolean;
  },
  images: {
    mapImg?: string;
    hrChartImg?: string;
    speedChartImg?: string;
    elevChartImg?: string;
  }
): Promise<Blob> {
  const { theme, fontFamily, customTitle, notes, showMap, showHeartRate, showSpeed, showElevation, showSplits } = options;

  // Colors based on theme
  const themeColors = {
    garmin: {
      accent: "0077C8",
      accentLight: "E0F2FE",
      textDark: "111827",
      textMuted: "6B7280",
      notesBg: "FFFBEB",
      notesBorder: "F59E0B",
      tableHeaderBg: "0077C8",
      tableHeaderTxt: "FFFFFF"
    },
    strava: {
      accent: "FC5200",
      accentLight: "FFEDD5",
      textDark: "E03E00",
      textMuted: "6B7280",
      notesBg: "FFFBEB",
      notesBorder: "F59E0B",
      tableHeaderBg: "FC5200",
      tableHeaderTxt: "FFFFFF"
    },
    mono: {
      accent: "111827",
      accentLight: "F3F4F6",
      textDark: "000000",
      textMuted: "555555",
      notesBg: "FBFBFB",
      notesBorder: "000000",
      tableHeaderBg: "F3F4F6",
      tableHeaderTxt: "000000"
    }
  }[theme];

  // Font family based on options
  const fontName = fontFamily.includes("mono") 
    ? "Courier New" 
    : fontFamily.includes("serif") || theme === "mono"
    ? "Georgia" 
    : fontFamily.includes("display")
    ? "Outfit"
    : "Calibri";

  const children: any[] = [];

  // Helper to format duration from seconds to string
  const formatDuration = (secs: number): string => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Dynamic Pagination Logic (matching ReportPreview.tsx)
  const getNotesHeight = (text: string): number => {
    if (!text) return 0;
    const charsPerLine = 85;
    const lines = Math.ceil(text.length / charsPerLine);
    return 40 + lines * 20; // base padding + line height estimation
  };

  const summaryHeight = 180 + getNotesHeight(notes);
  const mapHeight = (showMap && images.mapImg) ? 290 : 0;

  const numCharts = (showHeartRate && images.hrChartImg ? 1 : 0) + 
                    (showSpeed && images.speedChartImg ? 1 : 0) + 
                    (showElevation && images.elevChartImg ? 1 : 0);
  const chartsHeight = numCharts > 0 ? (numCharts * 145 + 60) : 0;

  const splitsList = (showSplits && activity.splits) ? activity.splits : [];
  const splitsRowHeight = 38;
  const splitsHeaderHeight = 80;

  let page1Height = summaryHeight + mapHeight;
  let chartsPlacedOnPage1 = false;
  let currentPageHeight = page1Height;

  if (numCharts > 0) {
    if (page1Height + chartsHeight <= 980) {
      page1Height += chartsHeight;
      chartsPlacedOnPage1 = true;
      currentPageHeight = page1Height;
    } else {
      currentPageHeight = chartsHeight;
    }
  }

  let splitsStartOnNewPage = true;
  if (splitsList.length > 0) {
    const remainingSpace = 980 - currentPageHeight;
    const minSplitsHeightToStart = splitsHeaderHeight + 3 * splitsRowHeight;
    if (remainingSpace >= minSplitsHeightToStart) {
      splitsStartOnNewPage = false;
    }
  }

  // 1. Report Title Row
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: customTitle || activity.name,
          bold: true,
          size: 44, // 22pt
          color: themeColors.accent,
          font: fontName,
        }),
      ],
    })
  );

  // 2. Subtitle: Sport and Date
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: activity.sport.toUpperCase() + "   |   ",
          bold: true,
          size: 18, // 9pt
          font: fontName,
        }),
        new TextRun({
          text: activity.date,
          size: 18, // 9pt
          font: fontName,
        }),
      ],
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 18, // 2.25pt
          space: 12,
          color: themeColors.accent,
        },
      },
    })
  );

  // 3. Metrics grid table cell creator
  const createMetricCell = (label: string, value: string) => {
    return new TableCell({
      width: { size: 25, type: WidthType.PERCENTAGE },
      shading: { fill: themeColors.accentLight },
      margins: { top: 180, bottom: 180, left: 180, right: 180 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: themeColors.accent },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: themeColors.accent },
        left: { style: BorderStyle.SINGLE, size: 4, color: themeColors.accent },
        right: { style: BorderStyle.SINGLE, size: 4, color: themeColors.accent },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: label.toUpperCase(),
              size: 15, // 7.5pt
              bold: true,
              font: fontName,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: value,
              size: 32, // 16pt
              bold: true,
              font: fontName,
            }),
          ],
        }),
      ],
    });
  };

  // Append Metrics Table
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            createMetricCell("Vzdálenost", `${activity.distance} km`),
            createMetricCell("Čas trvání", formatDuration(activity.durationSeconds)),
            createMetricCell("Rychlost ø", `${activity.avgSpeed} km/h`),
            createMetricCell("Průměrný tep", `${activity.avgHr} bpm`),
          ],
        }),
      ],
    })
  );

  // 4. Personal Notes Block
  if (notes) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: themeColors.notesBg },
                margins: { top: 180, bottom: 180, left: 240, right: 240 },
                borders: {
                  left: { style: BorderStyle.SINGLE, size: 36, color: themeColors.notesBorder },
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: [
                  new Paragraph({
                    spacing: { after: 60 },
                    children: [
                      new TextRun({
                        text: "Poznámky k aktivitě:",
                        bold: true,
                        size: 18,
                        font: fontName,
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: notes,
                        size: 18,
                        italics: true,
                        font: fontName,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  // 5. Map Image Section
  if (showMap && images.mapImg) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 120 },
        children: [
          new TextRun({
            text: "MAPA TRASY",
            bold: true,
            size: 24, // 12pt
            color: themeColors.textDark,
            font: fontName,
          }),
        ],
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 8, color: "E5E7EB", space: 4 }
        }
      })
    );

    try {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [
            new ImageRun({
              data: base64ToUint8Array(images.mapImg),
              transformation: {
                width: 600,
                height: 250,
              },
              type: "png",
            }),
          ],
        })
      );
    } catch (e) {
      console.error("Failed to add map image to Word document", e);
    }
  }

  // 6. Performance Charts Section (Starts on a new page conditionally)
  const hasCharts = showHeartRate || showSpeed || showElevation;
  const anyChartImg = images.hrChartImg || images.speedChartImg || images.elevChartImg;

  if (hasCharts && anyChartImg) {
    children.push(
      new Paragraph({
        pageBreakBefore: !chartsPlacedOnPage1,
        spacing: { before: 100, after: 120 },
        children: [
          new TextRun({
            text: "VÝKONOVÉ GRAFY",
            bold: true,
            size: 24, // 12pt
            color: themeColors.textDark,
            font: fontName,
          }),
        ],
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 8, color: "E5E7EB", space: 4 }
        }
      })
    );

    const addChartToDoc = (title: string, detailText: string, imgData?: string) => {
      if (!imgData) return;
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [
            new TextRun({
              text: title,
              bold: true,
              size: 18,
              color: themeColors.textMuted,
              font: fontName,
            }),
            new TextRun({
              text: `   |   ${detailText}`,
              size: 16,
              color: themeColors.textMuted,
              font: fontName,
            }),
          ],
        })
      );

      try {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new ImageRun({
                data: base64ToUint8Array(imgData),
                transformation: {
                  width: 600,
                  height: 105,
                },
                type: "png",
              }),
            ],
          })
        );
      } catch (e) {
        console.error(`Failed to add chart ${title} to Word`, e);
      }
    };

    if (showHeartRate && images.hrChartImg) {
      addChartToDoc("Graf srdečního tepu", `Max: ${activity.maxHr} bpm | Průměr: ${activity.avgHr} bpm`, images.hrChartImg);
    }
    if (showSpeed && images.speedChartImg) {
      addChartToDoc("Graf rychlosti", `Max: ${activity.maxSpeed} km/h | Průměr: ${activity.avgSpeed} km/h`, images.speedChartImg);
    }
    if (showElevation && images.elevChartImg) {
      addChartToDoc("Výškový profil", `Nastoupáno: ${activity.elevationGain} m`, images.elevChartImg);
    }
  }

  // 7. Laps / Splits Table Section (Starts on a new page conditionally)
  if (showSplits && activity.splits && activity.splits.length > 0) {
    children.push(
      new Paragraph({
        pageBreakBefore: splitsStartOnNewPage,
        spacing: { before: 100, after: 120 },
        children: [
          new TextRun({
            text: "ÚSEKY A MEZIČASY",
            bold: true,
            size: 24, // 12pt
            color: themeColors.textDark,
            font: fontName,
          }),
        ],
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 8, color: "E5E7EB", space: 4 }
        }
      })
    );

    const tableRows: TableRow[] = [];

    // Header Row
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33.3, type: WidthType.PERCENTAGE },
            shading: { fill: themeColors.tableHeaderBg },
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: "KILOMETR (ÚSEK)",
                    bold: true,
                    size: 16,
                    color: themeColors.tableHeaderTxt,
                    font: fontName,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 33.3, type: WidthType.PERCENTAGE },
            shading: { fill: themeColors.tableHeaderBg },
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: "ČAS ÚSEKU",
                    bold: true,
                    size: 16,
                    color: themeColors.tableHeaderTxt,
                    font: fontName,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 33.3, type: WidthType.PERCENTAGE },
            shading: { fill: themeColors.tableHeaderBg },
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: "PRŮMĚRNÝ TEP",
                    bold: true,
                    size: 16,
                    color: themeColors.tableHeaderTxt,
                    font: fontName,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    // Data Rows
    activity.splits.forEach((split, index) => {
      const isEven = index % 2 === 1;
      const rowBg = isEven ? "F9FAFB" : "FFFFFF";

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              shading: { fill: rowBg },
              margins: { top: 120, bottom: 120, left: 150, right: 150 },
              borders: {
                bottom: { style: BorderStyle.SINGLE, size: 2, color: "F3F4F6" },
                top: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${split.km} km`,
                      bold: true,
                      size: 17,
                      font: fontName,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              shading: { fill: rowBg },
              margins: { top: 120, bottom: 120, left: 150, right: 150 },
              borders: {
                bottom: { style: BorderStyle.SINGLE, size: 2, color: "F3F4F6" },
                top: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: split.time,
                      size: 17,
                      font: fontName,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 33.3, type: WidthType.PERCENTAGE },
              shading: { fill: rowBg },
              margins: { top: 120, bottom: 120, left: 150, right: 150 },
              borders: {
                bottom: { style: BorderStyle.SINGLE, size: 2, color: "F3F4F6" },
                top: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${split.avgHr} bpm`,
                      size: 17,
                      font: fontName,
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    });

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
