import { useState } from 'react';
import {
    Box, Button, Checkbox, Chip, Dialog, Divider, FormControlLabel, IconButton,
    MenuItem, TextField, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SchoolIcon from '@mui/icons-material/School';
import EditIcon from '@mui/icons-material/Edit';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CloseIcon from '@mui/icons-material/Close';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { PaymentChip, paymentLabel } from '../utils/payments';

/*
 * Student ID card popup.
 *
 * Data-driven: the view shows whichever fields exist on the student object
 * (rich sample records show more; live records show the database fields).
 * The edit form only exposes fields that exist in the students table —
 * name, gender, date of birth, guardian details and the special-needs note.
 * Persistence is owned by the caller via onSave / onTransfer.
 */

export const ageFromDob = (dob) => {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
};

function Field({ label, value, span }) {
    return (
        <Box sx={{ gridColumn: span ? 'span 2' : undefined, minWidth: 0 }}>
            <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: 'text.secondary',
                textTransform: 'uppercase', letterSpacing: .6, lineHeight: 1.4 }}>
                {label}
            </Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                {value || '—'}
            </Typography>
        </Box>
    );
}

function EditField({ label, value, onChange, span, type = 'text', options }) {
    return (
        <Box sx={{ gridColumn: span ? 'span 2' : undefined }}>
            <TextField
                label={label} size="small" fullWidth select={Boolean(options)} type={type}
                value={value ?? ''} onChange={(e) => onChange(e.target.value)}
                InputLabelProps={type === 'date' ? { shrink: true } : undefined}
                sx={{ '& .MuiInputBase-input': { fontSize: 13 }, '& .MuiInputLabel-root': { fontSize: 12 } }}>
                {options && options.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
        </Box>
    );
}

/** Build the view grid from whatever fields the record carries. */
const viewRows = (student) => {
    const rows = [];
    if (student.admissionNo) rows.push(['Admission no.', student.admissionNo]);
    if (student.rollNum != null) rows.push(['Roll no.', student.rollNum]);
    if (student.className) rows.push(['Class', student.className]);
    if (student.dateOfBirth) rows.push(['Date of birth', student.dateOfBirth]);
    const age = ageFromDob(student.dateOfBirth);
    if (age != null) rows.push(['Age', `${age} yrs`]);
    if (student.gender) rows.push(['Gender', student.gender]);
    if (student.guardianName) rows.push(['Guardian', student.guardianName]);
    if (student.guardianRelation) rows.push(['Relation', student.guardianRelation]);
    if (student.guardianPhone) rows.push(['Guardian phone', student.guardianPhone]);
    if (student.guardianEmail) rows.push(['Guardian email', student.guardianEmail]);
    if (student.address) rows.push(['Address', student.address]);
    if (student.previousSchool) rows.push(['Previous school', student.previousSchool]);
    if (student.medicalNotes) rows.push(['Medical notes', student.medicalNotes]);
    if (student.specialNeedsNote) rows.push(['Special needs note', student.specialNeedsNote]);
    if (student.enrolmentDate) rows.push(['Enrolled', student.enrolmentDate]);
    return rows;
};

const markedLine = (payment) => {
    const fmt = new Date(payment.markedAt);
    const date = Number.isNaN(fmt.getTime())
        ? ''
        : fmt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `Recorded by ${payment.markedBy || 'staff'}${date ? ` · ${date}` : ''}`;
};

export default function StudentIdCard({ student, canManage, classes, onClose, onSave, onTransfer, saving,
    payment, termName, onMarkPayment, paymentSaving }) {
    const theme = useTheme();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(null);
    const [transferOpen, setTransferOpen] = useState(false);
    const [targetClass, setTargetClass] = useState('');
    const [reason, setReason] = useState('');
    const [transferError, setTransferError] = useState('');

    if (!student) return null;

    const startEdit = () => {
        setDraft({
            name: student.name || '',
            gender: (student.gender || '').toLowerCase(),
            dateOfBirth: student.dateOfBirth || '',
            guardianName: student.guardianName || '',
            guardianPhone: student.guardianPhone || '',
            guardianEmail: student.guardianEmail || '',
            specialNeedsNote: student.specialNeedsNote || student.medicalNotes || '',
            specialNeeds: Boolean(student.specialNeeds),
        });
        setTransferOpen(false);
        setEditing(true);
    };

    const saveEdit = () => {
        if (!draft.name.trim()) return;
        onSave({
            name: draft.name.trim(),
            gender: draft.gender || null,
            dateOfBirth: draft.dateOfBirth || null,
            guardianName: draft.guardianName.trim() || null,
            guardianPhone: draft.guardianPhone.trim() || null,
            guardianEmail: draft.guardianEmail.trim() || null,
            specialNeedsNote: draft.specialNeedsNote.trim() || null,
            specialNeeds: draft.specialNeeds,
        });
        setEditing(false);
    };

    const confirmTransfer = () => {
        if (!targetClass || targetClass === student.className) {
            setTransferError('Choose a different class to transfer to.');
            return;
        }
        onTransfer(targetClass, reason.trim());
    };

    const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
    const rows = viewRows(student);

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}>
            {/* card stripe */}
            <Box sx={{ px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25,
                bgcolor: 'primary.main', color: '#fff' }}>
                <SchoolIcon sx={{ fontSize: 18 }} />
                <Typography sx={{ fontWeight: 800, fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase' }}>
                    BIS NOC Gerji · Student ID
                </Typography>
                <Typography sx={{ ml: 'auto', fontSize: 11, fontWeight: 700, opacity: .85 }}>
                    2026/27
                </Typography>
                <IconButton size="small" onClick={onClose} sx={{ color: '#fff', ml: .5 }} aria-label="Close">
                    <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Box>

            <Box sx={{ p: 2.5 }}>
                {!editing ? (
                    <>
                        {/* photo + identity */}
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                            <Box sx={{ width: 72, height: 88, borderRadius: 1.25, flexShrink: 0,
                                border: '1px solid', borderColor: 'divider',
                                bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 30, fontWeight: 800 }}>
                                {(student.name || '?').trim().charAt(0).toUpperCase()}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.15 }}>
                                    {student.name}
                                </Typography>
                                <Typography sx={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700,
                                    color: 'text.secondary', letterSpacing: .8, mt: .25 }}>
                                    {student.admissionNo || '—'}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: .75, mt: 1, flexWrap: 'wrap' }}>
                                    {student.className && (
                                        <Chip label={student.className} size="small"
                                            sx={{ fontWeight: 700, borderRadius: 1, height: 22, fontSize: 11.5,
                                                bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
                                    )}
                                    {student.status && (
                                        <Chip label={student.status} size="small"
                                            sx={{ fontWeight: 700, borderRadius: 1, height: 22, fontSize: 11.5,
                                                bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.main' }} />
                                    )}
                                </Box>
                            </Box>
                        </Box>

                        {rows.length > 0 && <Divider sx={{ mb: 1.5 }} />}

                        {/* record grid — only fields the record carries */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 2, rowGap: 1.1 }}>
                            {rows.map(([label, value]) => (
                                <Field key={label} label={label} value={value}
                                    span={['Guardian phone', 'Guardian email', 'Address', 'Previous school', 'Medical notes', 'Special needs note'].includes(label)} />
                            ))}
                        </Box>

                        {/* payment receipt — dotted slip under the record, filled
                            in by the class teacher when the parent pays */}
                        {termName && (
                            <Box
                                data-testid="payment-receipt"
                                sx={{
                                    mt: 2, px: 2, py: 1.5, borderRadius: 1.25,
                                    border: '1.5px dashed', borderColor: 'divider',
                                    bgcolor: alpha(theme.palette.warning.main, 0.04),
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ReceiptLongOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4,
                                        color: 'text.secondary', fontFamily: 'monospace', flexGrow: 1 }}>
                                        PAYMENT · {(termName || '').toUpperCase()}
                                    </Typography>
                                    <PaymentChip status={payment?.status || 'unpaid'} termName={termName} />
                                </Box>
                                <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: .75 }}>
                                    {payment?.status
                                        ? markedLine(payment)
                                        : 'Not recorded yet — once the parent pays, mark it here.'}
                                </Typography>
                                {canManage && onMarkPayment && (
                                    <Box sx={{ display: 'flex', gap: .75, mt: 1.25, flexWrap: 'wrap' }}>
                                        {['unpaid', 'paid_term', 'paid_annum'].map((st) => {
                                            const current = payment?.status || 'unpaid';
                                            return (
                                                <Button
                                                    key={st}
                                                    size="small"
                                                    variant={current === st ? 'contained' : 'outlined'}
                                                    disableElevation
                                                    disabled={paymentSaving}
                                                    onClick={() => current !== st && onMarkPayment(st)}
                                                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1, fontSize: 12 }}
                                                >
                                                    {paymentSaving && current !== st ? '…' : paymentLabel(st, termName)}
                                                </Button>
                                            );
                                        })}
                                    </Box>
                                )}
                            </Box>
                        )}

                        {/* actions */}
                        <Box sx={{ display: 'flex', gap: 1, mt: 2.5, alignItems: 'center' }}>
                            {canManage && (
                                <>
                                    <Button size="small" variant="outlined" startIcon={<EditIcon sx={{ fontSize: 15 }} />}
                                        onClick={startEdit}
                                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                        Edit
                                    </Button>
                                    {classes?.length > 0 && (
                                        <Button size="small" variant="outlined" startIcon={<SwapHorizIcon sx={{ fontSize: 16 }} />}
                                            onClick={() => { setTransferOpen((v) => !v); setEditing(false); setTransferError(''); }}
                                            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                            Transfer
                                        </Button>
                                    )}
                                </>
                            )}
                            <Button size="small" onClick={onClose} sx={{ ml: 'auto', fontWeight: 700,
                                textTransform: 'none', color: 'text.secondary' }}>
                                Close
                            </Button>
                        </Box>

                        {!canManage && (
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1.25 }}>
                                Sign in from your class card to edit or transfer students.
                            </Typography>
                        )}

                        {/* transfer panel */}
                        {transferOpen && canManage && (
                            <Box sx={{ mt: 2, p: 2, borderRadius: 1.25, border: '1px dashed',
                                borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 1.5 }}>
                                    Transfer {(student.name || '').split(' ')[0]} to another class
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                                    <TextField select label="New class" size="small"
                                        value={targetClass} onChange={(e) => { setTargetClass(e.target.value); setTransferError(''); }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: 13 } }}>
                                        {classes.filter((c) => c !== student.className).map((c) => (
                                            <MenuItem key={c} value={c}>{c}</MenuItem>
                                        ))}
                                    </TextField>
                                    <TextField label="Reason (optional)" size="small"
                                        value={reason} onChange={(e) => setReason(e.target.value)}
                                        sx={{ '& .MuiInputBase-input': { fontSize: 13 } }} />
                                </Box>
                                {transferError && (
                                    <Typography sx={{ fontSize: 12, color: 'error.main', mt: 1 }}>{transferError}</Typography>
                                )}
                                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                                    <Button size="small" variant="contained" disableElevation
                                        onClick={confirmTransfer} disabled={saving}
                                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                        {saving ? 'Transferring…' : 'Confirm transfer'}
                                    </Button>
                                    <Button size="small" onClick={() => setTransferOpen(false)}
                                        sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                                        Cancel
                                    </Button>
                                </Box>
                            </Box>
                        )}
                    </>
                ) : (
                    <>
                        <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1.75 }}>
                            Edit student record
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                            <EditField label="Full name" value={draft.name} onChange={set('name')} span />
                            <EditField label="Gender" value={draft.gender} onChange={set('gender')}
                                options={[['male', 'Male'], ['female', 'Female']]} />
                            <EditField label="Date of birth" type="date" value={draft.dateOfBirth} onChange={set('dateOfBirth')} />
                            <EditField label="Guardian" value={draft.guardianName} onChange={set('guardianName')} />
                            <EditField label="Guardian phone" value={draft.guardianPhone} onChange={set('guardianPhone')} />
                            <EditField label="Guardian email" value={draft.guardianEmail} onChange={set('guardianEmail')} span />
                            <EditField label="Special needs note" value={draft.specialNeedsNote} onChange={set('specialNeedsNote')} span />
                        </Box>
                        <FormControlLabel sx={{ mt: 1, '& .MuiFormControlLabel-label': { fontSize: 13 } }}
                            control={<Checkbox size="small" checked={draft.specialNeeds}
                                onChange={(e) => setDraft((d) => ({ ...d, specialNeeds: e.target.checked }))} />}
                            label="Special needs support" />
                        <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                            <Button size="small" variant="contained" disableElevation onClick={saveEdit}
                                disabled={!draft.name.trim() || saving}
                                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                {saving ? 'Saving…' : 'Save changes'}
                            </Button>
                            <Button size="small" onClick={() => setEditing(false)}
                                sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                                Cancel
                            </Button>
                        </Box>
                    </>
                )}
            </Box>
        </Dialog>
    );
}

