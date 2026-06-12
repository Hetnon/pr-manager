import { useContext } from 'react';
import { RepoContext } from '../../../repo/RepoContext.js';
import BranchesPanelHeader from './BranchesPanelHeader/BranchesPanelHeader.js';
import BranchesMessages from './BranchesMessages.js';
import WorkingTreeBanner from './WorkingTreeBanner/WorkingTreeBanner.js';
import BranchConflictReport from './BranchConflictReport/BranchConflictReport.js';
import BranchList from './BranchesList/BranchList.js';
import styles from './BranchesView.module.css';


export default function BranchesView() {
    const { currentRepoFolderHandle } = useContext(RepoContext);
    if (!currentRepoFolderHandle) return null;

    return (
        <section className={styles.panel}>
            <BranchesPanelHeader />
            <BranchesMessages />
            <WorkingTreeBanner />
            <BranchConflictReport />
            <BranchList />
        </section>
    );
}
