#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const backlogPath = path.resolve(process.cwd(), "agent-ops/agent-backlog.json");
const reportPath = path.resolve(process.cwd(), "agent-ops/agent-next-tasks.md");

const STATUS_ORDER = ["todo", "in_progress", "blocked", "done"];
const PRIORITY_ORDER = ["P0", "P1", "P2", "P3"];

function loadBacklog() {
  if (!fs.existsSync(backlogPath)) {
    fail(`Backlog not found: ${backlogPath}`);
  }
  const raw = fs.readFileSync(backlogPath, "utf8");
  /** @type {{version:number, updatedAt:string, owners:string[], tasks:Array<any>}} */
  const data = JSON.parse(raw);
  return data;
}

function saveBacklog(data) {
  data.updatedAt = new Date().toISOString();
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(backlogPath, serialized, "utf8");
}

function fail(msg) {
  console.error(`[agent-orchestrator] ${msg}`);
  process.exit(1);
}

function normalizeTask(task) {
  return {
    ...task,
    dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn : [],
  };
}

function indexTasks(tasks) {
  const map = new Map();
  for (const task of tasks.map(normalizeTask)) {
    map.set(task.id, task);
  }
  return map;
}

function isDone(task) {
  return task.status === "done";
}

function depsDone(task, taskMap) {
  const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [];
  return deps.every((depId) => {
    const dep = taskMap.get(depId);
    return dep && isDone(dep);
  });
}

function compareTasks(a, b) {
  const prioA = PRIORITY_ORDER.indexOf(a.priority);
  const prioB = PRIORITY_ORDER.indexOf(b.priority);
  const pa = prioA === -1 ? 99 : prioA;
  const pb = prioB === -1 ? 99 : prioB;
  if (pa !== pb) return pa - pb;
  return a.id.localeCompare(b.id, "en");
}

function getAvailableTasksForOwner(tasks, owner) {
  const taskMap = indexTasks(tasks);
  return tasks
    .map(normalizeTask)
    .filter((t) => t.owner === owner)
    .filter((t) => t.status === "todo")
    .filter((t) => depsDone(t, taskMap))
    .sort(compareTasks);
}

function getInProgressTask(tasks, owner) {
  return tasks.find((t) => t.owner === owner && t.status === "in_progress") || null;
}

function summarize(backlog) {
  const counts = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
  for (const task of backlog.tasks) {
    if (counts[task.status] === undefined) continue;
    counts[task.status] += 1;
  }
  return counts;
}

function printStatus(backlog) {
  const counts = summarize(backlog);
  console.log("Agent Orchestrator Status");
  console.log(`Backlog: ${backlogPath}`);
  console.log(`Updated: ${backlog.updatedAt}`);
  console.log(
    `Tasks => todo:${counts.todo} in_progress:${counts.in_progress} blocked:${counts.blocked} done:${counts.done}`,
  );

  for (const owner of backlog.owners) {
    const inProgress = getInProgressTask(backlog.tasks, owner);
    const next = getAvailableTasksForOwner(backlog.tasks, owner)[0] || null;
    const line = [
      `- ${owner}`,
      inProgress ? `in_progress=${inProgress.id}` : "in_progress=none",
      next ? `next=${next.id}` : "next=none",
    ].join(" | ");
    console.log(line);
  }
}

function printNext(backlog) {
  for (const owner of backlog.owners) {
    const inProgress = getInProgressTask(backlog.tasks, owner);
    if (inProgress) {
      console.log(`${owner}: ACTIVE ${inProgress.id} - ${inProgress.title}`);
      continue;
    }
    const next = getAvailableTasksForOwner(backlog.tasks, owner)[0];
    if (!next) {
      console.log(`${owner}: no available task`);
      continue;
    }
    console.log(`${owner}: NEXT ${next.id} - ${next.title}`);
  }
}

function findTaskOrFail(backlog, taskId) {
  const task = backlog.tasks.find((t) => t.id === taskId);
  if (!task) fail(`Task not found: ${taskId}`);
  return task;
}

function cmdStart(backlog, taskId, ownerOverride) {
  const task = findTaskOrFail(backlog, taskId);
  const owner = ownerOverride || task.owner;

  if (!backlog.owners.includes(owner)) {
    fail(`Unknown owner: ${owner}`);
  }

  if (task.owner !== owner) {
    task.owner = owner;
  }

  if (task.status === "done") {
    fail(`Task ${taskId} is already done`);
  }

  const taskMap = indexTasks(backlog.tasks);
  if (!depsDone(task, taskMap)) {
    fail(`Task ${taskId} has incomplete dependencies: ${task.dependsOn.join(", ")}`);
  }

  const active = getInProgressTask(backlog.tasks, owner);
  if (active && active.id !== task.id) {
    fail(`Owner ${owner} already has active task: ${active.id}`);
  }

  task.status = "in_progress";
  task.startedAt = new Date().toISOString();
  console.log(`Started ${task.id} for ${owner}`);
  saveBacklog(backlog);
}

function cmdDone(backlog, taskId) {
  const task = findTaskOrFail(backlog, taskId);
  if (task.status === "done") {
    console.log(`Task ${taskId} already done`);
    return;
  }
  task.status = "done";
  task.completedAt = new Date().toISOString();
  console.log(`Completed ${task.id}`);
  saveBacklog(backlog);
}

function cmdBlock(backlog, taskId, reason) {
  const task = findTaskOrFail(backlog, taskId);
  task.status = "blocked";
  task.blockReason = reason || "unspecified";
  task.blockedAt = new Date().toISOString();
  console.log(`Blocked ${task.id}: ${task.blockReason}`);
  saveBacklog(backlog);
}

function cmdUnblock(backlog, taskId) {
  const task = findTaskOrFail(backlog, taskId);
  if (task.status !== "blocked") {
    fail(`Task ${taskId} is not blocked`);
  }
  task.status = "todo";
  delete task.blockReason;
  delete task.blockedAt;
  console.log(`Unblocked ${task.id}`);
  saveBacklog(backlog);
}

function cmdAdvance(backlog) {
  let started = 0;
  const taskMap = indexTasks(backlog.tasks);

  for (const owner of backlog.owners) {
    const active = getInProgressTask(backlog.tasks, owner);
    if (active) continue;

    const available = backlog.tasks
      .filter((t) => t.owner === owner)
      .filter((t) => t.status === "todo")
      .filter((t) => depsDone(t, taskMap))
      .sort(compareTasks);

    if (available.length === 0) continue;
    const next = available[0];
    next.status = "in_progress";
    next.startedAt = new Date().toISOString();
    started += 1;
    console.log(`Auto-started ${next.id} for ${owner}`);
  }

  saveBacklog(backlog);
  if (started === 0) {
    console.log("No task auto-started");
  }
}

function cmdReport(backlog) {
  const counts = summarize(backlog);
  const lines = [];
  lines.push("# Agent Next Tasks");
  lines.push("");
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(
    `Summary: todo=${counts.todo}, in_progress=${counts.in_progress}, blocked=${counts.blocked}, done=${counts.done}`,
  );
  lines.push("");
  lines.push("| Owner | Active Task | Next Task |");
  lines.push("|---|---|---|");

  for (const owner of backlog.owners) {
    const active = getInProgressTask(backlog.tasks, owner);
    const next = getAvailableTasksForOwner(backlog.tasks, owner)[0] || null;
    const activeText = active ? `\`${active.id}\` ${active.title}` : "-";
    const nextText = next ? `\`${next.id}\` ${next.title}` : "-";
    lines.push(`| ${owner} | ${activeText} | ${nextText} |`);
  }

  lines.push("");
  lines.push("## Blocked Tasks");
  lines.push("");
  const blocked = backlog.tasks.filter((t) => t.status === "blocked").sort(compareTasks);
  if (blocked.length === 0) {
    lines.push("- None");
  } else {
    for (const t of blocked) {
      lines.push(`- \`${t.id}\` (${t.owner}) ${t.title} :: ${t.blockReason || "no reason"}`);
    }
  }

  lines.push("");
  lines.push("## Done Progress by Phase");
  lines.push("");
  const phases = new Map();
  for (const task of backlog.tasks) {
    const phase = task.phase || "Unknown";
    if (!phases.has(phase)) {
      phases.set(phase, { done: 0, total: 0 });
    }
    const row = phases.get(phase);
    row.total += 1;
    if (task.status === "done") row.done += 1;
  }
  const phaseRows = Array.from(phases.entries()).sort((a, b) => a[0].localeCompare(b[0], "en"));
  for (const [phase, row] of phaseRows) {
    lines.push(`- ${phase}: ${row.done}/${row.total}`);
  }

  lines.push("");
  fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Report generated: ${reportPath}`);
}

function cmdValidate(backlog) {
  const ids = new Set();
  for (const task of backlog.tasks) {
    if (!task.id) fail("Task without id");
    if (ids.has(task.id)) fail(`Duplicate task id: ${task.id}`);
    ids.add(task.id);
    if (!STATUS_ORDER.includes(task.status)) {
      fail(`Task ${task.id} has invalid status: ${task.status}`);
    }
    for (const dep of task.dependsOn || []) {
      if (!ids.has(dep) && !backlog.tasks.some((t) => t.id === dep)) {
        fail(`Task ${task.id} has missing dependency: ${dep}`);
      }
    }
  }
  console.log("Backlog validation passed");
}

function usage() {
  const text = [
    "Usage:",
    "  node scripts/agent-orchestrator.mjs status",
    "  node scripts/agent-orchestrator.mjs next",
    "  node scripts/agent-orchestrator.mjs start <TASK_ID> [OWNER]",
    "  node scripts/agent-orchestrator.mjs done <TASK_ID>",
    "  node scripts/agent-orchestrator.mjs block <TASK_ID> [reason]",
    "  node scripts/agent-orchestrator.mjs unblock <TASK_ID>",
    "  node scripts/agent-orchestrator.mjs advance",
    "  node scripts/agent-orchestrator.mjs report",
    "  node scripts/agent-orchestrator.mjs validate"
  ];
  console.log(text.join("\n"));
}

const [, , cmd, ...args] = process.argv;
if (!cmd) {
  usage();
  process.exit(0);
}

const backlog = loadBacklog();

switch (cmd) {
  case "status":
    printStatus(backlog);
    break;
  case "next":
    printNext(backlog);
    break;
  case "start":
    if (!args[0]) fail("Missing task id");
    cmdStart(backlog, args[0], args[1]);
    break;
  case "done":
    if (!args[0]) fail("Missing task id");
    cmdDone(backlog, args[0]);
    break;
  case "block":
    if (!args[0]) fail("Missing task id");
    cmdBlock(backlog, args[0], args.slice(1).join(" "));
    break;
  case "unblock":
    if (!args[0]) fail("Missing task id");
    cmdUnblock(backlog, args[0]);
    break;
  case "advance":
    cmdAdvance(backlog);
    break;
  case "report":
    cmdReport(backlog);
    break;
  case "validate":
    cmdValidate(backlog);
    break;
  default:
    usage();
    fail(`Unknown command: ${cmd}`);
}
