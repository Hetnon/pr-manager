import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildMatrix } from '../lib/matrix.js';
import PrMatrixSummary from './PrMatrixSummary.jsx';
import PrMatrixHeader from './PrMatrixHeader.jsx';
import PrMatrixBody from './PrMatrixBody.jsx';

export default function PrMatrix({ prs }) {
  const [expanded, setExpanded] = useState(true);
  const [fileColWidth, setFileColWidth] = useState(null);
  const fileColRef = useRef(null);
  const matrix = useMemo(() => buildMatrix(prs), [prs]);

  // When expanded, capture the actual file-column width so we can lock it
  // when the body collapses (otherwise the table resizes to fit the short header text).
  useLayoutEffect(() => {
    if (expanded && fileColRef.current) {
      setFileColWidth(fileColRef.current.getBoundingClientRect().width);
    }
  }, [expanded, prs]);

  if (prs.length === 0) {
    return <p className="empty">No open PRs. 🎉</p>;
  }

  const { sortedPrs, files, prSafe, safeCount, hotFileCount } = matrix;

  return (
    <>
      <PrMatrixSummary safeCount={safeCount} totalPrs={prs.length} hotFileCount={hotFileCount} />
      <table className="matrix">
        <PrMatrixHeader
          sortedPrs={sortedPrs}
          fileCount={files.length}
          prSafe={prSafe}
          expanded={expanded}
          onToggle={() => setExpanded(v => !v)}
          fileColRef={fileColRef}
          fileColMinWidth={fileColWidth}
        />
        {expanded && <PrMatrixBody files={files} sortedPrs={sortedPrs} />}
      </table>
    </>
  );
}
