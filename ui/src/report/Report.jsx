import { useMemo } from 'react';
import { buildMatrix } from '../lib/matrix.js';
import TechLeadActions from './TechLeadActions.jsx';
import DevActions from './DevActions.jsx';

export default function Report({ prs }) {
  const matrix = useMemo(() => buildMatrix(prs), [prs]);
  if (prs.length === 0) return null;

  return (
    <div className="report">
      <TechLeadActions matrix={matrix} />
      <DevActions matrix={matrix} />
    </div>
  );
}
