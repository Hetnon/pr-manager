// pr-matrix/public/app.js

const $ = (sel) => document.querySelector(sel);

async function loadPRs() {
  $('#status').textContent = 'Loading...';
  $('#content').innerHTML = '<p class="loading">Loading PRs...</p>';

  try {
    const res = await fetch('/api/prs');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    render(data);
    $('#status').textContent = `Loaded ${data.length} open PR(s) at ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    $('#content').innerHTML = `<p class="error">Error: ${e.message}</p>`;
    $('#status').textContent = '';
  }
}

function render(prs) {
  if (prs.length === 0) {
    $('#content').innerHTML = '<p class="empty">No open PRs. 🎉</p>';
    return;
  }

  // Build file → PR# map
  const fileToPRs = new Map();
  for (const pr of prs) {
    for (const f of pr.files) {
      if (!fileToPRs.has(f.path)) fileToPRs.set(f.path, []);
      fileToPRs.get(f.path).push(pr.number);
    }
  }

  // Sort PRs by number ascending (stable column order)
  prs.sort((a, b) => a.number - b.number);

  // Sort files: most-touched first, then alphabetical
  const files = [...fileToPRs.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return a[0].localeCompare(b[0]);
  });

  // Compute per-PR "safe to merge" flag (no file shared with another PR)
  const prSafe = new Map();
  for (const pr of prs) {
    const sharesAny = pr.files.some(f => fileToPRs.get(f.path).length > 1);
    prSafe.set(pr.number, !sharesAny);
  }

  // Build matrix HTML
  let html = `<table class="matrix">
    <thead>
      <tr>
        <th class="file-col">File (${files.length})</th>`;
  for (const pr of prs) {
    const cls = prSafe.get(pr.number) ? 'pr-safe' : 'pr-conflict';
    const status = pr.mergeStateStatus;
    const titleAttr = `${pr.title}\nBranch: ${pr.headRefName}\nAuthor: ${pr.author.login}\nGitHub: ${status} | ${pr.mergeable}`;
    html += `<th class="pr-col ${cls}" title="${escapeAttr(titleAttr)}">
      <a href="javascript:void(0)" data-pr="${pr.number}">#${pr.number}</a>
      <div class="pr-branch">${escapeHtml(pr.headRefName)}</div>
    </th>`;
  }
  html += `<th class="status-col">Safe?</th></tr></thead><tbody>`;

  for (const [filePath, prNums] of files) {
    const prCount = prNums.length;
    const heat = heatClass(prCount);
    html += `<tr><td class="file-cell ${heat}" title="${escapeAttr(filePath)}">${escapeHtml(filePath)}</td>`;
    for (const pr of prs) {
      if (prNums.includes(pr.number)) {
        html += `<td class="hit ${heat}">●</td>`;
      } else {
        html += `<td class="miss"></td>`;
      }
    }
    const safe = prCount === 1;
    html += `<td class="status-cell ${safe ? 'safe' : 'conflict'}">${safe ? '✓' : '✗ ' + prCount}</td>`;
    html += `</tr>`;
  }

  // Footer row: per-PR "Good to Merge"
  html += `<tr class="footer-row"><td class="file-col"><strong>Good to Merge?</strong></td>`;
  for (const pr of prs) {
    const safe = prSafe.get(pr.number);
    html += `<td class="status-cell ${safe ? 'safe' : 'conflict'}">${safe ? '✓' : '✗'}</td>`;
  }
  html += `<td class="status-cell"></td></tr>`;

  html += `</tbody></table>`;

  // Summary
  const safeCount = [...prSafe.values()].filter(v => v).length;
  html = `<div class="summary">
    <strong>${safeCount}</strong> of <strong>${prs.length}</strong> PR(s) safe to merge independently.
    Hot files: ${files.filter(([, prs]) => prs.length > 1).length}
  </div>` + html;

  $('#content').innerHTML = html;

  // Wire PR links to open on GitHub
  document.querySelectorAll('a[data-pr]').forEach(a => {
    a.addEventListener('click', () => {
      const pr = a.dataset.pr;
      // Open the PR in a new tab via gh-style URL inferred from any one PR's data
      // (we don't have repo info from gh json, so fallback to a search link)
      window.open(`https://github.com/pulls?q=${pr}`, '_blank');
    });
  });
}

function heatClass(count) {
  return count === 1 ? 'heat-1' : 'heat-conflict';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

$('#refresh').addEventListener('click', loadPRs);
loadPRs();