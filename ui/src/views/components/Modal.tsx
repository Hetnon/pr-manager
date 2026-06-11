import { type ReactNode } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Box } from '@mui/material';

interface Props {
    open: boolean;
    onClose: () => void;
    title?: ReactNode;       // string or any header content. Omit for a chromeless dialog.
    children: ReactNode;     // body content
    actions?: ReactNode;     // optional footer (buttons row, etc.)
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
    fullWidth?: boolean;
    disableBackdropClose?: boolean;  // block click-outside-to-close (e.g., during long ops)
}

// Reusable MUI Dialog wrapper. Designed to take any view as children — the
// caller composes the body. Header (title + close X) and footer (actions) are
// optional. Use this everywhere the project needs a modal so styling and
// behaviour stay consistent.
export default function Modal({
    open,
    onClose,
    title,
    children,
    actions,
    maxWidth = 'sm',
    fullWidth = true,
    disableBackdropClose = false,
}: Readonly<Props>) {
    return (
        <Dialog
            open={open}
            onClose={(_e, reason) => {
                if (disableBackdropClose && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return;
                onClose();
            }}
            maxWidth={maxWidth}
            fullWidth={fullWidth}
        >
            {title !== undefined && (
                <DialogTitle sx={{ pr: 6 }}>
                    {title}
                    <IconButton
                        aria-label="close"
                        onClick={onClose}
                        sx={{ position: 'absolute', right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
                    >
                        <Box component="span" sx={{ fontSize: 20, lineHeight: 1 }}>×</Box>
                    </IconButton>
                </DialogTitle>
            )}
            <DialogContent>{children}</DialogContent>
            {actions && <DialogActions>{actions}</DialogActions>}
        </Dialog>
    );
}
