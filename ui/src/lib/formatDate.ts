// Shared date/time formatting. Kept out of components so the PR matrix, the
// branches matrix, and the base-check chip all render dates the same way.

// Calendar-aware relative time: today / yesterday / "N days ago". Uses calendar
// day boundaries, so "yesterday" means the previous calendar day. Beyond that we
// always say "N days ago" — the absolute date (formatDateTime) carries the
// precise value when it matters.
export function formatRelative(iso: string | undefined): string {
    if (!iso) return '';
    const then = new Date(iso);
    const now = new Date();
    const thenDay = new Date(then.getFullYear(), then.getMonth(), then.getDate());
    const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((todayDay.getTime() - thenDay.getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
}

// Absolute date + time, human-readable (e.g. "Jun 4, 2026, 02:30 PM").
export function formatDateTime(iso: string | undefined): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString([], {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// Full absolute timestamp for title tooltips: local string + the raw UTC source.
export function formatAbsolute(iso: string | undefined): string {
    if (!iso) return '';
    return `Local: ${new Date(iso).toString()}\nSource (UTC): ${iso}`;
}

// "<absolute> (<relative>)" — the combined form the PR matrix shows per cell.
export function formatTimeAgo(iso: string | undefined): string {
    if (!iso) return '';
    return `${formatDateTime(iso)} (${formatRelative(iso)})`;
}

// Compact relative time for tight spaces (the base-check chip): no "ago",
// rolls up into d/mo/y. Distinct from formatRelative on purpose.
export function formatRelativeShort(iso: string | undefined): string {
    if (!iso) return '';
    const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1d';
    if (days < 30) return `${days}d`;
    if (days < 365) return `${Math.round(days / 30)}mo`;
    return `${Math.round(days / 365)}y`;
}
