import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

/**
 * A reusable "are you sure?" confirmation dialog for destructive actions.
 *
 * @param {boolean} open - whether the dialog is open
 * @param {() => void} onClose - called when the user cancels or closes
 * @param {() => void | Promise<void>} onConfirm - called when the user confirms
 * @param {string} title - dialog heading
 * @param {string} message - body text explaining what will be deleted
 * @param {string} confirmLabel - label for the destructive button
 * @param {string} cancelLabel - label for the cancel button
 * @param {boolean} loading - whether the confirm action is in flight
 * @param {string} confirmColor - MUI color for the confirm button (default 'error')
 */
export default function ConfirmDeleteDialog({
    open,
    onClose,
    onConfirm,
    title = 'Are you sure?',
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    loading = false,
    confirmColor = 'error',
}) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>
                <DeleteOutlineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                {title}
            </DialogTitle>
            <DialogContent divider>
                <Stack spacing={1} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        {message}
                    </Typography>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button
                    onClick={onClose}
                    disabled={loading}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                    {cancelLabel}
                </Button>
                <Button
                    variant="contained"
                    color={confirmColor}
                    onClick={onConfirm}
                    disabled={loading}
                    startIcon={<DeleteOutlineIcon fontSize="small" />}
                    sx={{ textTransform: 'none', fontWeight: 800 }}
                >
                    {loading ? 'Deleting…' : confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
