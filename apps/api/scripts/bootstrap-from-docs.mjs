#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { and, eq } from 'drizzle-orm';

import { db } from '@estimate-pro/db';
import { projects, tasks } from '@estimate-pro/db/schema';

const argv = process.argv.slice(2);
const args = new Set(argv);

const now = new Date().toISOString();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const outputDir = path.join(repoRoot, 'agent-ops/bootstrap');

const shouldWrite = args.has('--write');
const pushGithub = args.has('--push-github');
const pushKanban = args.has('--push-kanban');

const hourlyRate = Number(process.env.BOOTSTRAP_HOURLY_RATE || 1200);
const contingencyPercent = Number(process.env.BOOTSTRAP_CONTINGENCY_PERCENT || 20);
const githubRepo = process.env.GITHUB_REPO?.trim() || null;
const githubToken = process.env.GITHUB_TOKEN?.trim() || null;
const githubIssueLimit = Number(process.env.BOOTSTRAP_GITHUB_LIMIT || 50);

const argProjectId = readArgValue('--project-id');
const kanbanProjectId = argProjectId || process.env.KANBAN_PROJECT_ID?.trim() || null;

function readArgValue(flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1) return null;
  const value = argv[idx + 1];
  if (!value || value.startsWith('--')) return null;
  return value;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function decodeXmlText(text) {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#39;', "'");
}

function normalizeLine(raw) {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function readDocxAsText(filePath) {
  let xml = '';
  try {
    xml = execSync(`unzip -p "${filePath}" word/document.xml`, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      maxBuffer: 40 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`DOCX read failed (${path.basename(filePath)}): ${(error instanceof Error ? error.message : 'unknown error')}`);
  }

  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const lines = [];
  for (const paragraph of paragraphs) {
    const parts = Array.from(paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g))
      .map((match) => decodeXmlText(match[1] || ''))
      .map((part) => normalizeLine(part))
      .filter(Boolean);

    if (parts.length === 0) continue;
    const line = normalizeLine(parts.join(' '));
    if (line.length > 0) lines.push(line);
  }

  return lines.join('\n');
}

function readFileAsText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.docx') {
    return readDocxAsText(filePath);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function discoverSourceDocs() {
  const docsFromEnv = process.env.BOOTSTRAP_DOCS?.trim();
  if (docsFromEnv) {
    const files = docsFromEnv
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => path.isAbsolute(entry) ? entry : path.join(repoRoot, entry))
      .filter((filePath) => fs.existsSync(filePath));

    if (files.length > 0) {
      return files;
    }
  }

  const rootFiles = fs.readdirSync(repoRoot)
    .map((name) => path.join(repoRoot, name))
    .filter((fullPath) => fs.statSync(fullPath).isFile());

  const kickoffDocx = rootFiles
    .filter((fullPath) => path.extname(fullPath).toLowerCase() === '.docx')
    .filter((fullPath) => {
      const base = path.basename(fullPath).toLowerCase();
      return base.includes('estimate pro') || base.includes('analiz') || base.includes('teknik');
    });

  if (kickoffDocx.length > 0) {
    return kickoffDocx.sort((a, b) => a.localeCompare(b, 'en'));
  }

  const fallbackDocs = rootFiles
    .filter((fullPath) => ['.md', '.txt'].includes(path.extname(fullPath).toLowerCase()))
    .filter((fullPath) => {
      const base = path.basename(fullPath).toLowerCase();
      return base.startsWith('project_tracker') || base.startsWith('readme');
    });

  return fallbackDocs.sort((a, b) => a.localeCompare(b, 'en'));
}

function isHeading(line) {
  if (/^\d+(\.\d+)*[.)]?\s+/.test(line)) return true;
  if (/^[A-Z0-9 _:/-]{8,}$/.test(line)) return true;
  if (/^(FR|NFR|EPIC|PHASE)\s*[:\-]/i.test(line)) return true;
  return false;
}

function isTaskCandidate(line) {
  if (/^[-*•]\s+/.test(line)) return true;
  if (/^\d+[.)]\s+/.test(line) && line.length > 18) return true;
  return /(gerek|olmali|olmalı|must|should|implement|entegre|integration|oauth|sync|dashboard|rapor|test|deploy|kanban|github|api|migration|security)/i.test(line);
}

function cleanTitle(rawLine) {
  return normalizeLine(rawLine)
    .replace(/^[-*•]\s+/, '')
    .replace(/^\d+(\.\d+)*[.)]?\s+/, '')
    .replace(/\s*[;:.]\s*$/, '');
}

function detectType(title, isHeadingLine) {
  const text = title.toLowerCase();
  if (isHeadingLine) return 'epic';
  if (/(bug|hata|fix|error)/i.test(text)) return 'bug';
  if (/(api|entegre|integration|sync|oauth|migration|webhook)/i.test(text)) return 'feature';
  if (/(test|qa|validation|dogrulama|doğrulama)/i.test(text)) return 'task';
  return 'story';
}

function detectPriority(title) {
  const text = title.toLowerCase();
  if (/(security|guvenlik|güvenlik|auth|oauth|payment|data loss|critical|blokaj)/i.test(text)) return 'critical';
  if (/(integration|entegre|api|migration|deploy|release|tenant|kanban|github)/i.test(text)) return 'high';
  if (/(ui|ux|report|analytics|dashboard|doc|documentation)/i.test(text)) return 'medium';
  return 'medium';
}

function estimateHours(title, type) {
  let hours = type === 'epic' ? 12 : type === 'feature' ? 8 : type === 'bug' ? 4 : 6;
  const text = title.toLowerCase();

  const keywordWeights = [
    { pattern: /(oauth|auth|security|guvenlik|güvenlik)/, add: 4 },
    { pattern: /(integration|entegre|github|webhook|sync)/, add: 5 },
    { pattern: /(kanban|roadmap|effort|cost|cos)/, add: 3 },
    { pattern: /(mobile|ios|android|expo)/, add: 8 },
    { pattern: /(ai|llm|openai|anthropic|openrouter|analysis)/, add: 4 },
    { pattern: /(infra|deploy|production|release|cutover)/, add: 5 },
    { pattern: /(test|qa|validation|regression)/, add: 3 },
  ];

  for (const weight of keywordWeights) {
    if (weight.pattern.test(text)) {
      hours += weight.add;
    }
  }

  const wordCount = title.split(/\s+/).length;
  if (wordCount > 10) {
    hours += 2;
  }

  return Math.min(Math.max(hours, 2), 40);
}

function toStoryPoints(hours) {
  const points = hours / 4;
  return Math.max(1, Math.round(points * 2) / 2);
}

function extractTasksFromDocs(docs) {
  const candidates = [];

  for (const doc of docs) {
    const lines = doc.text
      .split(/\r?\n/)
      .map((line) => normalizeLine(line))
      .filter(Boolean)
      .filter((line) => line.length >= 8);

    let currentSection = path.basename(doc.filePath);

    for (const line of lines) {
      const heading = isHeading(line);
      if (heading) {
        currentSection = cleanTitle(line);
      }

      if (!heading && !isTaskCandidate(line)) {
        continue;
      }

      const title = cleanTitle(line);
      if (title.length < 8 || title.length > 180) {
        continue;
      }

      const type = detectType(title, heading);
      const priority = detectPriority(title);
      const estimatedHours = estimateHours(title, type);
      const estimatedPoints = toStoryPoints(estimatedHours);

      candidates.push({
        title,
        description: `${currentSection}\n\nSource: ${path.basename(doc.filePath)}`,
        section: currentSection,
        source: path.basename(doc.filePath),
        type,
        status: 'backlog',
        priority,
        estimatedHours,
        estimatedPoints,
      });
    }
  }

  const seen = new Set();
  const unique = [];
  for (const task of candidates) {
    const key = task.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(task);
  }

  unique.sort((a, b) => {
    const prioOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    const pa = prioOrder[a.priority] ?? 99;
    const pb = prioOrder[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return a.title.localeCompare(b.title, 'en');
  });

  return unique.slice(0, 120).map((task, index) => ({
    ...task,
    sortOrder: index,
  }));
}

function buildCosSummary(docs, generatedTasks) {
  const totalHours = generatedTasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
  const contingencyHours = (totalHours * contingencyPercent) / 100;
  const totalWithContingency = totalHours + contingencyHours;
  const developmentCost = totalWithContingency * hourlyRate;

  return {
    generatedAt: now,
    documentsAnalyzed: docs.length,
    tasksGenerated: generatedTasks.length,
    effort: {
      totalHours,
      contingencyPercent,
      contingencyHours,
      totalWithContingency,
    },
    cost: {
      hourlyRate,
      developmentCost,
      currency: 'TRY',
    },
    operationalCostAlternativesMonthlyTRY: {
      starter: '12000-22000',
      growth: '25000-48000',
      scale: '50000-95000',
    },
  };
}

function buildGithubIssuePayload(tasksForIssue) {
  return tasksForIssue.map((task) => ({
    title: `[Bootstrap] ${task.title}`,
    body: [
      task.description,
      '',
      `Type: ${task.type}`,
      `Priority: ${task.priority}`,
      `Estimated Hours: ${task.estimatedHours}`,
      `Estimated Points: ${task.estimatedPoints}`,
      'Origin: docs-bootstrap',
    ].join('\n'),
    labels: ['docs-bootstrap', `type:${task.type}`, `priority:${task.priority}`],
  }));
}

async function createGithubIssues(issuePayload) {
  if (!githubRepo || !githubToken) {
    return {
      mode: 'skipped',
      reason: 'GITHUB_REPO or GITHUB_TOKEN missing',
      created: 0,
      attempted: 0,
      failed: [],
    };
  }

  const scoped = issuePayload.slice(0, Math.max(1, githubIssueLimit));
  if (!pushGithub) {
    return {
      mode: 'dry_run',
      reason: 'run with --push-github to create issues',
      created: 0,
      attempted: scoped.length,
      failed: [],
    };
  }

  const failed = [];
  let created = 0;

  for (const issue of scoped) {
    const response = await fetch(`https://api.github.com/repos/${githubRepo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(issue),
    });

    if (!response.ok) {
      const body = await response.text();
      failed.push({ title: issue.title, status: response.status, body: body.slice(0, 300) });
      continue;
    }

    created += 1;
  }

  return {
    mode: 'pushed',
    reason: null,
    created,
    attempted: scoped.length,
    failed,
  };
}

async function importTasksToKanban(generatedTasks) {
  if (!kanbanProjectId) {
    return {
      mode: 'skipped',
      reason: 'KANBAN_PROJECT_ID or --project-id missing',
      inserted: 0,
      attempted: 0,
      deduped: 0,
    };
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, kanbanProjectId),
    columns: { id: true, name: true },
  });

  if (!project) {
    return {
      mode: 'skipped',
      reason: `project not found: ${kanbanProjectId}`,
      inserted: 0,
      attempted: 0,
      deduped: 0,
    };
  }

  if (!pushKanban) {
    return {
      mode: 'dry_run',
      reason: 'run with --push-kanban to insert tasks',
      inserted: 0,
      attempted: generatedTasks.length,
      deduped: 0,
    };
  }

  const existingRows = await db.query.tasks.findMany({
    where: eq(tasks.projectId, kanbanProjectId),
    columns: { title: true },
  });
  const existingTitles = new Set(existingRows.map((row) => row.title.trim().toLowerCase()));

  const records = generatedTasks
    .filter((task) => !existingTitles.has(task.title.trim().toLowerCase()))
    .map((task) => ({
      projectId: kanbanProjectId,
      title: task.title,
      description: task.description,
      type: task.type,
      status: task.status,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      estimatedPoints: task.estimatedPoints,
      sortOrder: task.sortOrder,
    }));

  if (records.length === 0) {
    return {
      mode: 'pushed',
      reason: 'all generated tasks already exist',
      inserted: 0,
      attempted: generatedTasks.length,
      deduped: generatedTasks.length,
    };
  }

  const inserted = await db.insert(tasks).values(records).returning({ id: tasks.id });
  return {
    mode: 'pushed',
    reason: null,
    inserted: inserted.length,
    attempted: generatedTasks.length,
    deduped: generatedTasks.length - records.length,
  };
}

function buildMarkdownReport(payload) {
  const lines = [];
  lines.push('# Docs Bootstrap Report');
  lines.push('');
  lines.push(`Updated: ${payload.generatedAt}`);
  lines.push('');
  lines.push('## Inputs');
  lines.push('');
  lines.push(`- Documents analyzed: ${payload.documents.length}`);
  for (const doc of payload.documents) {
    lines.push(`- ${doc.relativePath} (${doc.lines} lines, ${doc.characters} chars)`);
  }
  lines.push('');
  lines.push('## COS Summary');
  lines.push('');
  lines.push(`- Tasks generated: ${payload.cos.tasksGenerated}`);
  lines.push(`- Effort total: ${payload.cos.effort.totalHours}h`);
  lines.push(`- Contingency: ${payload.cos.effort.contingencyPercent}% (${payload.cos.effort.contingencyHours.toFixed(1)}h)`);
  lines.push(`- Effort total with contingency: ${payload.cos.effort.totalWithContingency.toFixed(1)}h`);
  lines.push(`- Development cost: ${payload.cos.cost.developmentCost.toFixed(0)} ${payload.cos.cost.currency}`);
  lines.push('');
  lines.push('## Transfer Status');
  lines.push('');
  lines.push(`- GitHub: ${payload.github.mode} (created ${payload.github.created}/${payload.github.attempted})`);
  if (payload.github.reason) lines.push(`  reason: ${payload.github.reason}`);
  lines.push(`- Kanban: ${payload.kanban.mode} (inserted ${payload.kanban.inserted}/${payload.kanban.attempted}, deduped ${payload.kanban.deduped})`);
  if (payload.kanban.reason) lines.push(`  reason: ${payload.kanban.reason}`);
  lines.push('');
  lines.push('## Usage');
  lines.push('');
  lines.push('1. Analyze docs and generate outputs:');
  lines.push('   `pnpm ops:bootstrap:docs`');
  lines.push('2. Push to GitHub + Kanban (requires env vars):');
  lines.push('   `pnpm ops:bootstrap:docs:push -- --project-id <PROJECT_UUID>`');
  lines.push('');
  lines.push('Required env for push: `GITHUB_REPO`, `GITHUB_TOKEN`, `KANBAN_PROJECT_ID` (or `--project-id`).');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  const sourceFiles = discoverSourceDocs();
  if (sourceFiles.length === 0) {
    throw new Error('No source docs found. Set BOOTSTRAP_DOCS or add docs to repo root.');
  }

  const docs = sourceFiles.map((filePath) => {
    const text = readFileAsText(filePath);
    const lines = text.split(/\r?\n/).filter((line) => normalizeLine(line).length > 0).length;
    return {
      filePath,
      relativePath: path.relative(repoRoot, filePath),
      text,
      lines,
      characters: text.length,
    };
  });

  const generatedTasks = extractTasksFromDocs(docs);
  const cos = buildCosSummary(docs, generatedTasks);
  const githubIssues = buildGithubIssuePayload(generatedTasks);

  const github = await createGithubIssues(githubIssues);
  const kanban = await importTasksToKanban(generatedTasks);

  const result = {
    generatedAt: now,
    documents: docs.map((doc) => ({
      relativePath: doc.relativePath,
      lines: doc.lines,
      characters: doc.characters,
    })),
    tasks: generatedTasks,
    githubIssues,
    cos,
    github,
    kanban,
  };

  const markdown = buildMarkdownReport(result);
  console.log(markdown);

  if (shouldWrite) {
    ensureDir(outputDir);
    fs.writeFileSync(path.join(outputDir, 'docs-bootstrap-analysis-latest.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'docs-bootstrap-github-issues-latest.json'), `${JSON.stringify(githubIssues, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'docs-bootstrap-kanban-tasks-latest.json'), `${JSON.stringify(generatedTasks, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'docs-bootstrap-report-latest.md'), markdown, 'utf8');
    console.log(`[docs-bootstrap] wrote ${path.relative(repoRoot, outputDir)}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('[docs-bootstrap] failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
