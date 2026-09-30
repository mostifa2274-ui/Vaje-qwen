#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] || process.cwd());
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

function line(kind, msg) { console.log(`${kind}: ${msg}`); }

if (!exists("package.json")) {
  console.error(`FAIL: ${root} has no package.json`);
  process.exit(1);
}

const pkg = JSON.parse(read("package.json"));
line("PROJECT", `${pkg.name || "(unnamed)"} ${pkg.version || ""}`.trim());
line("NODE", pkg.engines?.node || "(not declared)");
line("PKG", pkg.packageManager || "(not declared)");

const scripts = pkg.scripts || {};
for (const key of [
  "check", "build", "test", "lint",
  "validate:learning-policy", "validate:data", "validate:editorial",
  "validate:assessment-prerequisites", "validate:mastery",
  "validate:quality-program", "best-in-class:status"
]) {
  if (scripts[key]) line("SCRIPT", `${key} = ${scripts[key]}`);
}

for (const file of [
  "src/data/learningPolicy.json",
  "src/data/storyCanon.json",
  "research/status.json",
  "docs/VISUAL_STORY_BIBLE.md",
  "playwright.config.ts",
  ".github/workflows/ci.yml",
  ".github/workflows/deploy-production.yml",
  ".github/workflows/live-smoke.yml"
]) {
  line(exists(file) ? "FOUND" : "MISSING", file);
}

if (exists(".git/HEAD")) {
  line("GIT", read(".git/HEAD").trim());
}

console.log("\nUse this as discovery only. Current repository files and workflows are authoritative.");
