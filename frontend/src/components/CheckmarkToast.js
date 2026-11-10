import { Snackbar } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

/**
 * A completion toast that shows a checkmark icon so the user knows the
 * action landed (save, delete, submit, download, …).
 *
 * @param {boolean} open - whether the toast is visible
 * @param {string} message - confirmation message
 * @param {() => void} onClose - called when the toast auto-hides or is dismissed
 * @param {number} autoHideDuration - milliseconds before auto-dismiss (default 3000)
 */
export default function CheckmarkToast({ open, message, onClose, autoHideDuration = 3000 }) {
    if (!open || !message) return null;

    return (
        <Snackbar
            open={open}
            autoHideDuration={autoHideDuration}
            onClose={onClose}
            message={message}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            SnackbarContentProps={{
                sx: { bgcolor: 'success.main', color: '#fff', borderRadius: 1.5, px: 2.5, py: 1.5 },
                icon: <CheckCircleIcon fontSize="small" sx={{ mr: 1 }} />,
            }}
        />
    );
}
