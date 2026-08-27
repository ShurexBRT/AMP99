import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const packageJson = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const version = process.argv[2] || packageJson.version;
const notesPath = path.resolve("docs", "releases", `${version}.md`);

if (!fs.existsSync(notesPath)) {
  throw new Error(`Release notes are missing: ${notesPath}`);
}

const notes = fs.readFileSync(notesPath, "utf8");
const requiredSections = [
  "Summary",
  "Changes",
  "Automated validation",
  "Manual Windows test plan",
  "Known limitations",
  "Upgrade",
];

for (const section of requiredSections) {
  if (!notes.match(new RegExp(`^## ${section.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*$`, "m"))) {
    throw new Error(`Release notes must contain a ## ${section} section.`);
  }
}

const sectionBody = (section, nextSection) => {
  const start = notes.indexOf(`## ${section}`);
  const end = nextSection ? notes.indexOf(`## ${nextSection}`, start) : notes.length;
  return notes.slice(start, end === -1 ? notes.length : end);
};

const automated = sectionBody("Automated validation", "Manual Windows test plan");
const manual = sectionBody("Manual Windows test plan", "Known limitations");

if (!/^[-*] \[[ xX]\] .+/m.test(automated)) {
  throw new Error("Automated validation must contain checkbox evidence items.");
}
if (/^[-*] \[ \] .+/m.test(automated)) {
  throw new Error(
    "Automated validation contains unchecked items; only publish notes after the exact automated gates pass.",
  );
}
if (!/^[-*] \[[ xX]\] .+/m.test(manual)) {
  throw new Error("Manual Windows test plan must contain checkbox test instructions.");
}

console.log(`Release notes OK: ${version}`);
