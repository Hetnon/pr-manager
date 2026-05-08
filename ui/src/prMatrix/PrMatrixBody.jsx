import { heatClass } from '../lib/matrix.js';
import styles from './PrMatrix.module.css';

const HEAT = { 'heat-1': styles.heat1, 'heat-conflict': styles.heatConflict };

const STATE_CLASS = {
  conflict: styles.cellConflict,
  warning: styles.cellWarning,
};
const STATE_GLYPH = { conflict: '✗', warning: '⚠' };
const STATE_TITLE = {
  conflict: 'Would conflict with master on this file',
  warning: 'Master also touched this file (clean merge, but worth a manual review)',
};

export default function PrMatrixBody({ files, sortedPrs, cellState, renderFileExtra }) {
  return (
    <tbody>
      {files.map(([filePath, prNums]) => {
        const safe = prNums.length === 1;
        const heat = HEAT[heatClass(prNums.length)];
        const extra = renderFileExtra?.(filePath);
        return (
          <tr key={filePath}>
            <td className={`${styles.fileCell} ${heat}`} title={filePath}>
              <div>{filePath}</div>
              {extra}
            </td>
            <td className={`${styles.statusCell} ${safe ? styles.safe : styles.conflict}`}>{safe ? '✓' : `✗ ${prNums.length}`}</td>
            {sortedPrs.map(pr => {
              if (!prNums.includes(pr.number)) {
                return <td key={pr.number} className={styles.miss} />;
              }
              const state = cellState?.(pr, filePath);
              const stateCls = state ? STATE_CLASS[state] : '';
              const glyph = state ? STATE_GLYPH[state] : '●';
              const title = state ? STATE_TITLE[state] : undefined;
              return (
                <td
                  key={pr.number}
                  className={`${styles.hit} ${heat} ${stateCls}`}
                  title={title}
                >
                  {glyph}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
}
