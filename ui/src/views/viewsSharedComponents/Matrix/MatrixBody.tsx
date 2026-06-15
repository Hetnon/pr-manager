import styles from '../Matrix.module.css';
import type { MatrixColumn, MatrixFileRow } from './Matrix.types.js';
import { FileRow } from './matrixCells.js';

interface Props {
    files: MatrixFileRow[];
    columns: MatrixColumn[];
}

export default function MatrixBody({ files, columns }: Readonly<Props>) {
    return (
        <div className={styles.body}>
            {files.map((row) => (
                <FileRow key={row.key} row={row} columns={columns} />
            ))}
        </div>
    );
}
