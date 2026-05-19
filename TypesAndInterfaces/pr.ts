export interface PR {
  number: number;
  title: string;
  headRefName: string;
  headSha: string;          // PR HEAD commit sha — used by the browser to fetch refs/pull/N/head
  mergeable: string;
  mergeStateStatus: string;
  files: Array<{ path: string; additions: number; deletions: number }>;
  createdAt: string;
  updatedAt: string;
  author: { login: string };
  url: string;
}
