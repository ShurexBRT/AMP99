import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const tauriConfig = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8"));
const cargoToml = fs.readFileSync("src-tauri/Cargo.toml", "utf8");
const storeScript = fs.readFileSync("scripts/build-store-msix.ps1", "utf8");
const storeWorkflow = fs.readFileSync(".github/workflows/store-msix-preflight.yml", "utf8");

const cargoVersionMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
if (!cargoVersionMatch) {
  throw new Error("Could not read [package] version from src-tauri/Cargo.toml.");
}

const versions = {
  package: packageJson.version,
  tauri: tauriConfig.version,
  cargo: cargoVersionMatch[1],
};

const uniqueVersions = new Set(Object.values(versions));
if (uniqueVersions.size !== 1) {
  throw new Error(
    `AMP99 version drift detected: ${Object.entries(versions)
      .map(([source, version]) => `${source}=${version}`)
      .join(", ")}`,
  );
}

const appVersion = packageJson.version;
const semverMatch = appVersion.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
if (!semverMatch) {
  throw new Error(`AMP99 version is not valid SemVer: ${appVersion}`);
}

const [, major, minor, patch, prerelease] = semverMatch;
let revision = "0";
if (prerelease) {
  const numericIdentifiers = prerelease
    .split(".")
    .filter((part) => /^\d+$/.test(part));
  if (numericIdentifiers.length === 0) {
    throw new Error(
      `Prerelease version ${appVersion} needs a numeric build identifier (for example alpha.1) so it can map to an MSIX revision.`,
    );
  }
  revision = numericIdentifiers.at(-1);
}

const msixVersion = `${major}.${minor}.${patch}.${revision}`;
const expectedStoreVersionToken = `-Version "${msixVersion}"`;
const expectedStoreDefault = `[string]$Version = "${msixVersion}"`;

if (!storeWorkflow.includes(expectedStoreVersionToken)) {
  throw new Error(
    `Store workflow version drift: expected ${expectedStoreVersionToken} for app version ${appVersion}.`,
  );
}

if (!storeScript.includes(expectedStoreDefault)) {
  throw new Error(
    `Store packaging default drift: expected ${expectedStoreDefault} for app version ${appVersion}.`,
  );
}

console.log(`AMP99 version OK: ${appVersion} (MSIX ${msixVersion})`);
