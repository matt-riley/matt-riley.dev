export type DossierSource = "live" | "fallback";

export interface DossierProfile {
  login: string;
  name: string;
  bio: string;
  location: string;
  avatarUrl: string;
  profileUrl: string;
  accountAgeYears: number;
  followers: number;
  publicRepos: number;
}

export interface DossierTotals {
  originalRepositories: number;
  stars: number;
  forks: number;
}

export interface DossierLanguage {
  name: string;
  count: number;
}

export type ActivityKind = "push" | "release" | "create" | "fork" | "watch";

export interface DossierActivity {
  id: string;
  kind: ActivityKind;
  repo: string;
  repoUrl: string;
  summary: string;
  occurredAt: string;
}

export type EvidenceVariant = "wide" | "tall" | "censored";

export interface DossierRepository {
  name: string;
  url: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  updatedAt: string;
  variant: EvidenceVariant;
}

export interface DossierRelease {
  repo: string;
  repoUrl: string;
  summary: string;
  publishedAt: string;
}

export interface GitHubDossier {
  source: DossierSource;
  snapshotDate: string;
  profile: DossierProfile;
  totals: DossierTotals;
  languages: DossierLanguage[];
  activity: DossierActivity[];
  repositories: DossierRepository[];
  releases: DossierRelease[];
}
