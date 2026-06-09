import { useContext, useState } from 'react';
import { RepoContext } from './RepoContext.js';

// The other remembered projects, self-contained: click a row to switch to it
// (reusing its stored handle; the header badge re-grants folder permission, same
// as on reload), × to forget it. Renders nothing when there's no other project.
export default function AllProjects() {
    const { repoSlug, knownRepoSlugs, selectKnownRepo, forgetRepo, setPickerOpen } = useContext(RepoContext);
    const [busy, setBusy] = useState(false);
    const otherProjects = knownRepoSlugs.filter((slug) => slug !== repoSlug);

    if (otherProjects.length === 0) return null;

    async function switchTo(slug: string) {
        setBusy(true);
        try {
            await selectKnownRepo(slug);
            setPickerOpen(false);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="picker-known">
            <p className="picker-msg">Switch to a remembered project:</p>
            <ul className="picker-known-list">
                {otherProjects.map((slug) => (
                    <li key={slug} className="picker-known-item">
                        <button
                            type="button"
                            className="picker-known-switch"
                            disabled={busy}
                            onClick={() => void switchTo(slug)}
                        >
                            <code>{slug}</code>
                        </button>
                        <button
                            type="button"
                            className="picker-known-forget"
                            title={`Forget ${slug}`}
                            aria-label={`Forget ${slug}`}
                            disabled={busy}
                            onClick={() => void forgetRepo(slug)}
                        >×</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
