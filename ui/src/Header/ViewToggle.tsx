import styles from './Header.module.css';

export type View = 'branches' | 'prs';

interface Props {
    view: View;
    onSelectView: (view: View) => void;
}

// The Branches | Pull Requests switch. Hard toggle — exactly one is active.
export default function ViewToggle({ view, onSelectView }: Readonly<Props>) {
    return (
        <nav className={styles.viewToggle}>
            <button
                className={view === 'branches' ? styles.active : undefined}
                onClick={() => onSelectView('branches')}
            >Branches</button>
            <button
                className={view === 'prs' ? styles.active : undefined}
                onClick={() => onSelectView('prs')}
            >Pull Requests</button>
        </nav>
    );
}
