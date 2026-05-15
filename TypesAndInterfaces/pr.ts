export interface PR {
  number: number;
  title: string;
  headRefName: string;
  mergeable: string;
  mergeStateStatus: string;
  files: Array<{ path: string; additions: number; deletions: number }>;
  createdAt: string;
  updatedAt: string;
  author: { login: string };
  url: string;
}
