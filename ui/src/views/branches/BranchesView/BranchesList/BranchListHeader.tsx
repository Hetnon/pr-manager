
import { JSX } from "react";
import styles from './BranchList.module.css';

export default function BranchListHeader(): JSX.Element {
    return (
        <div className={styles.rowHeader}>
            <div className={styles.colBranch}>Branch Name</div>
            <div className={styles.colPr}>PR</div>
            <div className={styles.colHead}>HEAD</div>
            <div className={styles.colNum}>Ahead</div>
            <div className={styles.colNum}>Behind</div>
            <div className={styles.colCommit}>Last commit</div>
            <div className={styles.colActions}>Actions</div>
            <div className={styles.colStatus}>Status</div>
        </div>
    );
}