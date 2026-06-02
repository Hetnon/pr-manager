export type View = 'branches' | 'prs';

interface Props {
    view: View;
    onSelectView: (view: View) => void;
}

// The Branches | Pull Requests switch. Hard toggle — exactly one is active.
export default function ViewToggle({ view, onSelectView }: Readonly<Props>) {
    return (
        <nav className="view-toggle">
            <button
                className={view === 'branches' ? 'active' : ''}
                onClick={() => onSelectView('branches')}
            >Branches</button>
            <button
                className={view === 'prs' ? 'active' : ''}
                onClick={() => onSelectView('prs')}
            >Pull Requests</button>
        </nav>
    );
}
