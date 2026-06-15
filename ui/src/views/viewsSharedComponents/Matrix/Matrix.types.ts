import type { ReactNode } from 'react';

export interface MatrixColumn {
    key: string | number;
    header: ReactNode;
    headerClassName?: string; // safe/conflict tint
    headerTitle?: string;
    meta: ReactNode[]; // one node per meta row; must line up with metaLabels
    footer: ReactNode;
    footerClassName?: string;
}

export interface MatrixBodyCell {
    content: ReactNode;
    className?: string;
    title?: string;
}

export interface MatrixFileRow {
    key: string;
    label: ReactNode;
    labelTitle?: string;
    labelClassName?: string; // heat tint
    extra?: ReactNode; // e.g. a "base touched" chip, under the label
    status: ReactNode;
    statusClassName?: string;
    statusTitle?: string;
    cells: MatrixBodyCell[]; // one cell per column; must line up with columns
}
