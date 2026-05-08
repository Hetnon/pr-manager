import { heatClass } from '../lib/matrix.js';
import styles from './PrMatrix.module.css';

const HEAT = { 'heat-1': styles.heat1, 'heat-conflict': styles.heatConflict };

export default function PrMatrixBody({ files, sortedPrs }) {
  return (
    <tbody>
      {files.map(([filePath, prNums]) => {
        const safe = prNums.length === 1;
        const heat = HEAT[heatClass(prNums.length)];
        return (
          <tr key={filePath}>
            <td className={`${styles.fileCell} ${heat}`} title={filePath}>{filePath}</td>
            <td className={`${styles.statusCell} ${safe ? styles.safe : styles.conflict}`}>{safe ? '✓' : `✗ ${prNums.length}`}</td>
            {sortedPrs.map(pr => (
              prNums.includes(pr.number)
                ? <td key={pr.number} className={`${styles.hit} ${heat}`}>●</td>
                : <td key={pr.number} className={styles.miss} />
            ))}
          </tr>
        );
      })}
    </tbody>
  );
}
