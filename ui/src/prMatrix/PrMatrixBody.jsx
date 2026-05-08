import { heatClass } from '../lib/matrix.js';

export default function PrMatrixBody({ files, sortedPrs }) {
  return (
    <tbody>
      {files.map(([filePath, prNums]) => {
        const safe = prNums.length === 1;
        const heat = heatClass(prNums.length);
        return (
          <tr key={filePath}>
            <td className={`file-cell ${heat}`} title={filePath}>{filePath}</td>
            <td className={`status-cell ${safe ? 'safe' : 'conflict'}`}>{safe ? '✓' : `✗ ${prNums.length}`}</td>
            {sortedPrs.map(pr => (
              prNums.includes(pr.number)
                ? <td key={pr.number} className={`hit ${heat}`}>●</td>
                : <td key={pr.number} className="miss" />
            ))}
          </tr>
        );
      })}
    </tbody>
  );
}
