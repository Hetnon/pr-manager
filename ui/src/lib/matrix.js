export function buildMatrix(prs) {
  const fileToPRs = new Map();
  for (const pr of prs) {
    for (const f of pr.files) {
      if (!fileToPRs.has(f.path)) fileToPRs.set(f.path, []);
      fileToPRs.get(f.path).push(pr.number);
    }
  }

  const sortedPrs = [...prs].sort((a, b) => a.number - b.number);
  const files = [...fileToPRs.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return a[0].localeCompare(b[0]);
  });

  const prSafe = new Map();
  for (const pr of sortedPrs) {
    const sharesAny = pr.files.some(f => fileToPRs.get(f.path).length > 1);
    prSafe.set(pr.number, !sharesAny);
  }

  return {
    sortedPrs,
    files,
    prSafe,
    safeCount: [...prSafe.values()].filter(Boolean).length,
    hotFileCount: files.filter(([, filePrs]) => filePrs.length > 1).length,
  };
}

export function heatClass(count) {
  return count === 1 ? 'heat-1' : 'heat-conflict';
}
