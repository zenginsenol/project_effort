import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';

export interface ExportData {
  projectName: string;
  generatedAt: string;
  tasks: Array<{
    title: string;
    type: string;
    status: string;
    priority: string;
    estimatedPoints: number | null;
    estimatedHours: number | null;
    actualHours: number | null;
    assignee: string | null;
  }>;
  summary: {
    totalTasks: number;
    completedTasks: number;
    totalPoints: number;
    totalHours: number;
  };
  analytics?: {
    accuracyTrends: Array<{
      period: string;
      accuracy: number;
      meanAbsoluteError: number;
      sampleSize: number;
    }>;
    biasAnalysis: {
      overallBias: number;
      optimismRate: number;
      pessimismRate: number;
      averageDeviation: number;
    };
  };
}

export function generateCSV(data: ExportData): string {
  const headers = ['Title', 'Type', 'Status', 'Priority', 'Est. Points', 'Est. Hours', 'Actual Hours', 'Assignee'];
  const rows = data.tasks.map((t) => [
    `"${t.title.replace(/"/g, '""')}"`,
    t.type,
    t.status,
    t.priority,
    t.estimatedPoints?.toString() ?? '',
    t.estimatedHours?.toString() ?? '',
    t.actualHours?.toString() ?? '',
    t.assignee ?? '',
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))];

  // Add analytics section if available
  if (data.analytics) {
    csvContent.push('');
    csvContent.push('ANALYTICS SECTION');
    csvContent.push('');

    // Accuracy Trends
    csvContent.push('Accuracy Trends');
    csvContent.push('Period,Accuracy (%),Mean Absolute Error,Sample Size');
    data.analytics.accuracyTrends.forEach((trend) => {
      csvContent.push(
        `${trend.period},${(trend.accuracy * 100).toFixed(2)},${trend.meanAbsoluteError.toFixed(2)},${trend.sampleSize}`,
      );
    });

    csvContent.push('');

    // Bias Analysis
    csvContent.push('Bias Analysis');
    csvContent.push('Metric,Value');
    csvContent.push(`Overall Bias,${(data.analytics.biasAnalysis.overallBias * 100).toFixed(2)}%`);
    csvContent.push(`Optimism Rate,${(data.analytics.biasAnalysis.optimismRate * 100).toFixed(2)}%`);
    csvContent.push(`Pessimism Rate,${(data.analytics.biasAnalysis.pessimismRate * 100).toFixed(2)}%`);
    csvContent.push(`Average Deviation,${data.analytics.biasAnalysis.averageDeviation.toFixed(2)}`);
  }

  return csvContent.join('\n');
}

export function generateExportSummary(data: ExportData): string {
  return [
    `Project: ${data.projectName}`,
    `Generated: ${data.generatedAt}`,
    `Total Tasks: ${data.summary.totalTasks}`,
    `Completed: ${data.summary.completedTasks}`,
    `Total Points: ${data.summary.totalPoints}`,
    `Total Hours: ${data.summary.totalHours}`,
  ].join('\n');
}

export function generateXLSX(data: ExportData): Buffer {
  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    { Metric: 'Project', Value: data.projectName },
    { Metric: 'Generated At', Value: data.generatedAt },
    { Metric: 'Total Tasks', Value: data.summary.totalTasks },
    { Metric: 'Completed Tasks', Value: data.summary.completedTasks },
    { Metric: 'Total Points', Value: data.summary.totalPoints },
    { Metric: 'Total Hours', Value: data.summary.totalHours },
  ];

  const taskRows = data.tasks.map((task) => ({
    Title: task.title,
    Type: task.type,
    Status: task.status,
    Priority: task.priority,
    EstimatedPoints: task.estimatedPoints ?? '',
    EstimatedHours: task.estimatedHours ?? '',
    ActualHours: task.actualHours ?? '',
    Assignee: task.assignee ?? '',
  }));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(taskRows), 'Tasks');

  // Add analytics sheet if available
  if (data.analytics) {
    const analyticsRows: Array<Record<string, string | number>> = [];

    // Accuracy Trends section
    analyticsRows.push({ Section: 'ACCURACY TRENDS', Value: '' });
    analyticsRows.push({ Section: '', Value: '' });
    data.analytics.accuracyTrends.forEach((trend) => {
      analyticsRows.push({
        Period: trend.period,
        'Accuracy (%)': Number((trend.accuracy * 100).toFixed(2)),
        'Mean Absolute Error': Number(trend.meanAbsoluteError.toFixed(2)),
        'Sample Size': trend.sampleSize,
      });
    });

    analyticsRows.push({ Section: '', Value: '' });

    // Bias Analysis section
    analyticsRows.push({ Section: 'BIAS ANALYSIS', Value: '' });
    analyticsRows.push({ Section: '', Value: '' });
    analyticsRows.push({
      Metric: 'Overall Bias',
      'Value (%)': Number((data.analytics.biasAnalysis.overallBias * 100).toFixed(2)),
    });
    analyticsRows.push({
      Metric: 'Optimism Rate',
      'Value (%)': Number((data.analytics.biasAnalysis.optimismRate * 100).toFixed(2)),
    });
    analyticsRows.push({
      Metric: 'Pessimism Rate',
      'Value (%)': Number((data.analytics.biasAnalysis.pessimismRate * 100).toFixed(2)),
    });
    analyticsRows.push({
      Metric: 'Average Deviation',
      Value: Number(data.analytics.biasAnalysis.averageDeviation.toFixed(2)),
    });

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(analyticsRows), 'Analytics');
  }

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

export async function generatePDF(data: ExportData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595, 842];
  let page = pdf.addPage(pageSize);
  let y = 800;

  const drawLine = (text: string, isBold = false): void => {
    if (y < 50) {
      page = pdf.addPage(pageSize);
      y = 800;
    }

    page.drawText(text, {
      x: 40,
      y,
      size: 10,
      font: isBold ? bold : regular,
    });
    y -= 14;
  };

  drawLine(`Project: ${data.projectName}`, true);
  drawLine(`Generated: ${data.generatedAt}`);
  drawLine(`Total Tasks: ${data.summary.totalTasks}`);
  drawLine(`Completed: ${data.summary.completedTasks}`);
  drawLine(`Total Points: ${data.summary.totalPoints}`);
  drawLine(`Total Hours: ${data.summary.totalHours}`);
  y -= 8;
  drawLine('Tasks', true);

  for (const task of data.tasks) {
    drawLine(`${task.title} | ${task.status} | ${task.type} | ${task.priority}`);
    drawLine(
      `Est: ${task.estimatedPoints ?? '-'}pt / ${task.estimatedHours ?? '-'}h | Actual: ${task.actualHours ?? '-'}h | Assignee: ${task.assignee ?? '-'}`,
    );
  }

  // Add analytics section if available
  if (data.analytics) {
    y -= 12;
    drawLine('Analytics', true);
    y -= 8;

    // Accuracy Trends
    drawLine('Accuracy Trends:', true);
    data.analytics.accuracyTrends.forEach((trend) => {
      drawLine(
        `${trend.period}: Accuracy ${(trend.accuracy * 100).toFixed(2)}% | MAE ${trend.meanAbsoluteError.toFixed(2)} | Samples ${trend.sampleSize}`,
      );
    });

    y -= 8;

    // Bias Analysis
    drawLine('Bias Analysis:', true);
    drawLine(`Overall Bias: ${(data.analytics.biasAnalysis.overallBias * 100).toFixed(2)}%`);
    drawLine(`Optimism Rate: ${(data.analytics.biasAnalysis.optimismRate * 100).toFixed(2)}%`);
    drawLine(`Pessimism Rate: ${(data.analytics.biasAnalysis.pessimismRate * 100).toFixed(2)}%`);
    drawLine(`Average Deviation: ${data.analytics.biasAnalysis.averageDeviation.toFixed(2)}`);
  }

  return pdf.save();
}
