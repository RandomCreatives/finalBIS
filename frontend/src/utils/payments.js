import Chip from '@mui/material/Chip';

/*
 * Student fee payment statuses (student_payments table; decision:
 * Mike, 2026-09-22). Status-only by design — the school tracks whether a
 * term (or the whole year) is settled, not amounts. No row = unpaid.
 * One shared chip so the class roster, the student card receipt section
 * and the admin list all read the same way.
 */

export const paymentLabel = (status, termName) => {
    if (status === 'paid_term') return `Paid · ${termName || 'Term'}`;
    if (status === 'paid_annum') return 'Paid · Annum';
    return 'Unpaid';
};

export function PaymentChip({ status, termName, size = 'small', onClick, dataTestId }) {
    const look =
        status === 'paid_annum'
            ? { bgcolor: 'rgba(2,132,199,.12)', color: '#0369a1', border: 'none' }
            : status === 'paid_term'
                ? { bgcolor: 'rgba(22,163,74,.14)', color: '#15803d', border: 'none' }
                : { bgcolor: 'transparent', color: 'text.secondary', border: '1px dashed', borderColor: 'divider' };
    return (
        <Chip
            label={paymentLabel(status, termName)}
            size={size}
            onClick={onClick}
            data-testid={dataTestId}
            sx={{ fontWeight: status ? 700 : 600, borderRadius: 1, ...look }}
        />
    );
}
