import type {
  ActivityKind,
  DossierActivity,
  DossierRelease,
  DossierRepository,
  EvidenceVariant,
  GitHubDossier,
} from "./types";
import { fallbackDossier } from "./fallback";

const LOGIN = "matt-riley";
const API = "https://api.github.com";
const FETCH_TIMEOUT_MS = 10_000;
const EVIDENCE_VARIANTS: EvidenceVariant[] = [
  "wide",
  "tall",
  "censored",
  "wide",
  "tall",
];

interface RawProfile {
  login: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  avatar_url: string;
  html_url: string;
  created_at: string;
  followers: number;
  public_repos: number;
}

interface RawRepo {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
}

interface RawRelease {
  name: string | null;
  tag_name: string;
  html_url: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
}

interface ReleaseBatch {
  repo: RawRepo;
  releases: RawRelease[];
}

interface RawEvent {
  id: string;
  type: string;
  repo: { name: string };
  created_at: string;
  payload: {
    commits?: { message: string }[];
    release?: { name: string | null; tag_name: string; published_at: string };
    ref_type?: string;
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "matt-riley.dev-build",
  };
  const token = import.meta.env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GitHub ${path} responded ${response.status}`);
  }
  return (await response.json()) as T;
}

const eventKind = (type: string): ActivityKind | null => {
  switch (type) {
    case "PushEvent":
      return "push";
    case "ReleaseEvent":
      return "release";
    case "CreateEvent":
      return "create";
    case "ForkEvent":
      return "fork";
    case "WatchEvent":
      return "watch";
    default:
      return null;
  }
};

function summarise(event: RawEvent): string {
  const commit = event.payload.commits?.at(-1)?.message.split("\n")[0];
  switch (event.type) {
    case "PushEvent":
      return commit ?? "Pushed new work";
    case "ReleaseEvent":
      return event.payload.release?.name || "Cut a new release";
    case "CreateEvent":
      return event.payload.ref_type === "repository"
        ? "Opened a fresh repository"
        : "Cut a new branch or tag";
    case "ForkEvent":
      return "Forked for parts";
    case "WatchEvent":
      return "Starred in passing";
    default:
      return "Public signal";
  }
}

function selectRepositories(repos: RawRepo[]): RawRepo[] {
  return repos
    .filter((repo) => !repo.fork && !repo.archived)
    .sort(
      (a, b) =>
        b.stargazers_count - a.stargazers_count ||
        Date.parse(b.pushed_at) - Date.parse(a.pushed_at),
    )
    .slice(0, 5);
}

function normalize(
  profile: RawProfile,
  repos: RawRepo[],
  events: RawEvent[],
  releaseBatches: ReleaseBatch[],
): GitHubDossier {
  const original = repos.filter((repo) => !repo.fork);
  const languageCounts = new Map<string, number>();
  for (const repo of original) {
    if (!repo.language) continue;
    languageCounts.set(
      repo.language,
      (languageCounts.get(repo.language) ?? 0) + 1,
    );
  }

  const activity: DossierActivity[] = events
    .map((event): DossierActivity | null => {
      const kind = eventKind(event.type);
      if (!kind) return null;
      const repo = event.repo.name.split("/")[1] ?? event.repo.name;
      return {
        id: event.id,
        kind,
        repo,
        repoUrl: `https://github.com/${event.repo.name}`,
        summary: summarise(event),
        occurredAt: event.created_at,
      };
    })
    .filter((entry): entry is DossierActivity => entry !== null)
    .slice(0, 5);

  const repositories: DossierRepository[] = selectRepositories(repos).map(
    (repo, index) => ({
      name: repo.name,
      url: repo.html_url,
      description: repo.description ?? "Undocumented machinery.",
      language: repo.language ?? "Mixed media",
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      updatedAt: repo.pushed_at,
      variant: EVIDENCE_VARIANTS[index % EVIDENCE_VARIANTS.length],
    }),
  );

  const releases: DossierRelease[] = releaseBatches
    .flatMap(({ repo, releases: repoReleases }) =>
      repoReleases.map((release): DossierRelease | null => {
        if (release.draft || release.prerelease || !release.published_at) {
          return null;
        }
        return {
          repo: repo.name,
          repoUrl: repo.html_url,
          releaseUrl: release.html_url,
          summary: release.name?.trim() || release.tag_name,
          publishedAt: release.published_at,
        };
      }),
    )
    .filter((release): release is DossierRelease => release !== null)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 5);

  return {
    source: "live",
    snapshotDate: new Date().toISOString().slice(0, 10),
    profile: {
      login: profile.login,
      name: profile.name ?? profile.login,
      bio: profile.bio ?? "",
      location: profile.location ?? "",
      avatarUrl: profile.avatar_url,
      profileUrl: profile.html_url,
      accountAgeYears: Math.max(
        0,
        Math.floor(
          (Date.now() - Date.parse(profile.created_at)) /
            (365.25 * 24 * 3600 * 1000),
        ),
      ),
      followers: profile.followers,
      publicRepos: profile.public_repos,
    },
    totals: {
      originalRepositories: original.length,
      stars: original.reduce((sum, repo) => sum + repo.stargazers_count, 0),
      forks: original.reduce((sum, repo) => sum + repo.forks_count, 0),
    },
    languages: [...languageCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 6),
    activity,
    repositories,
    releases,
  };
}

/**
 * Core data selection is atomic: if a profile, repository, event, or selected
 * release request fails or the payload cannot be normalized, the whole dossier
 * falls back to the checked-in snapshot so the page never mixes live and stale
 * fragments.
 */
export async function loadDossier(): Promise<GitHubDossier> {
  if (import.meta.env.GITHUB_DATA === "fallback") return fallbackDossier;
  try {
    const [profile, repos, events] = await Promise.all([
      fetchJson<RawProfile>(`/users/${LOGIN}`),
      fetchJson<RawRepo[]>(`/users/${LOGIN}/repos?per_page=100&sort=pushed`),
      fetchJson<RawEvent[]>(`/users/${LOGIN}/events/public?per_page=30`),
    ]);
    const releaseBatches = await Promise.all(
      selectRepositories(repos).map(async (repo) => ({
        repo,
        releases: await fetchJson<RawRelease[]>(
          `/repos/${LOGIN}/${encodeURIComponent(repo.name)}/releases?per_page=5`,
        ),
      })),
    );
    const dossier = normalize(profile, repos, events, releaseBatches);
    if (dossier.repositories.length === 0 || dossier.activity.length === 0) {
      throw new Error("Live dossier came back suspiciously empty");
    }
    return dossier;
  } catch (error) {
    console.warn(
      `[github] Falling back to archive print: ${error instanceof Error ? error.message : String(error)}`,
    );
    return fallbackDossier;
  }
}
