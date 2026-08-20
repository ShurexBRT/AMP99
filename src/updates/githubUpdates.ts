export type Amp99Release = {
  version: string;
  tagName: string;
  releaseUrl: string;
  prerelease: boolean;
  publishedAt: string | null;
};

export type Amp99UpdateResult =
  | { status: "up-to-date"; currentVersion: string; latest: Amp99Release | null }
  | { status: "update-available"; currentVersion: string; latest: Amp99Release };

const RELEASES_API = "https://api.github.com/repos/ShurexBRT/AMP99/releases?per_page=30";
const RELEASES_WEB_PREFIX = "https://github.com/ShurexBRT/AMP99/releases/";

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Array<string | number>;
};

type GitHubRelease = {
  tag_name?: unknown;
  html_url?: unknown;
  prerelease?: unknown;
  draft?: unknown;
  published_at?: unknown;
};

function parseVersion(input: string): ParsedVersion | null {
  const normalized = input.trim().replace(/^v/i, "");
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]
      ? match[4].split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
      : [],
  };
}

function comparePrerelease(a: ParsedVersion["prerelease"], b: ParsedVersion["prerelease"]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    if (left === right) continue;

    const leftNumber = typeof left === "number";
    const rightNumber = typeof right === "number";
    if (leftNumber && rightNumber) return left < right ? -1 : 1;
    if (leftNumber !== rightNumber) return leftNumber ? -1 : 1;
    return String(left).localeCompare(String(right));
  }

  return 0;
}

export function compareAmp99Versions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) throw new Error("AMP99 received an invalid release version.");

  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }

  return comparePrerelease(left.prerelease, right.prerelease);
}

function normalizeRelease(release: GitHubRelease): Amp99Release | null {
  if (release.draft === true) return null;
  if (typeof release.tag_name !== "string" || typeof release.html_url !== "string") return null;
  if (!release.html_url.startsWith(RELEASES_WEB_PREFIX)) return null;

  const version = release.tag_name.replace(/^v/i, "");
  if (!parseVersion(version)) return null;

  return {
    version,
    tagName: release.tag_name,
    releaseUrl: release.html_url,
    prerelease: release.prerelease === true,
    publishedAt: typeof release.published_at === "string" ? release.published_at : null,
  };
}

export async function checkForAmp99Update(currentVersion: string): Promise<Amp99UpdateResult> {
  if (!parseVersion(currentVersion)) {
    throw new Error(`Current AMP99 version is invalid: ${currentVersion}`);
  }

  const response = await fetch(RELEASES_API, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`GitHub update check failed (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) throw new Error("GitHub returned an invalid release list.");

  const releases = payload
    .map((item) => normalizeRelease(item as GitHubRelease))
    .filter((item): item is Amp99Release => Boolean(item))
    .sort((a, b) => compareAmp99Versions(b.version, a.version));

  const latest = releases[0] ?? null;
  if (latest && compareAmp99Versions(currentVersion, latest.version) < 0) {
    return { status: "update-available", currentVersion, latest };
  }

  return { status: "up-to-date", currentVersion, latest };
}

export function isOfficialAmp99ReleaseUrl(url: string): boolean {
  return url.startsWith(RELEASES_WEB_PREFIX);
}
