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

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
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

  return pdf.save();
}
