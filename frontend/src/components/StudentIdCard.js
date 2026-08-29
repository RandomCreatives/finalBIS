import { useState } from 'react';
import {
    Box, Button, Chip, Dialog, Divider, IconButton, MenuItem, TextField, Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SchoolIcon from '@mui/icons-material/School';
import EditIcon from '@mui/icons-material/Edit';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Student ID card popup with optional edit + transfer.
 *
 * Shared by the public Students directory and the main-teacher dashboard.
 * `canManage` gates the Edit/Transfer actions; the caller owns the data
 * (onSave / onTransfer receive the updates).
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
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }} noWrap={!span}>
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
                {options && options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
            </TextField>
        </Box>
    );
}

export default function StudentIdCard({ student, canManage, classes, onClose, onSave, onTransfer }) {
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
            gender: student.gender || '',
            dateOfBirth: student.dateOfBirth || '',
            guardianName: student.guardianName || '',
            guardianRelation: student.guardianRelation || '',
            guardianPhone: student.guardianPhone || '',
            address: student.address || '',
            previousSchool: student.previousSchool || '',
            medicalNotes: student.medicalNotes || '',
            status: student.status || 'Active',
        });
        setTransferOpen(false);
        setEditing(true);
    };

    const saveEdit = () => {
        if (!draft.name.trim()) return;
        onSave(student.name, draft);
        setEditing(false);
    };

    const confirmTransfer = () => {
        if (!targetClass || targetClass === student.className) {
            setTransferError('Choose a different class to transfer to.');
            return;
        }
        onTransfer(student.name, targetClass, reason.trim());
        setTransferOpen(false);
        setTargetClass('');
        setReason('');
        setTransferError('');
    };

    const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

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
                                    {student.admissionNumber || '—'}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: .75, mt: 1, flexWrap: 'wrap' }}>
                                    <Chip label={student.className} size="small"
                                        sx={{ fontWeight: 700, borderRadius: 1, height: 22, fontSize: 11.5,
                                            bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
                                    {student.status && (
                                        <Chip label={student.status} size="small"
                                            sx={{ fontWeight: 700, borderRadius: 1, height: 22, fontSize: 11.5,
                                                bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.main' }} />
                                    )}
                                </Box>
                            </Box>
                        </Box>

                        <Divider sx={{ mb: 1.5 }} />

                        {/* dense record grid */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 2, rowGap: 1.1 }}>
                            <Field label="Date of birth" value={student.dateOfBirth} />
                            <Field label="Age" value={ageFromDob(student.dateOfBirth) != null ? `${ageFromDob(student.dateOfBirth)} yrs` : null} />
                            <Field label="Gender" value={student.gender} />
                            <Field label="Enrolled" value={student.enrolmentDate} />
                            <Field label="Guardian" value={student.guardianName} />
                            <Field label="Relation" value={student.guardianRelation} />
                            <Field label="Guardian phone" value={student.guardianPhone} span />
                            <Field label="Address" value={student.address} span />
                            <Field label="Previous school" value={student.previousSchool} span />
                            <Field label="Medical notes" value={student.medicalNotes} span />
                        </Box>

                        {/* actions */}
                        <Box sx={{ display: 'flex', gap: 1, mt: 2.5 }}>
                            {canManage && (
                                <>
                                    <Button size="small" variant="outlined" startIcon={<EditIcon sx={{ fontSize: 15 }} />}
                                        onClick={startEdit}
                                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                        Edit
                                    </Button>
                                    <Button size="small" variant="outlined" startIcon={<SwapHorizIcon sx={{ fontSize: 16 }} />}
                                        onClick={() => { setTransferOpen((v) => !v); setEditing(false); setTransferError(''); }}
                                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                        Transfer
                                    </Button>
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
                                    Transfer {student.name.split(' ')[0]} to another class
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
                                        onClick={confirmTransfer}
                                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                        Confirm transfer
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
                            <EditField label="Gender" value={draft.gender} onChange={set('gender')} options={['Male', 'Female']} />
                            <EditField label="Date of birth" type="date" value={draft.dateOfBirth} onChange={set('dateOfBirth')} />
                            <EditField label="Guardian" value={draft.guardianName} onChange={set('guardianName')} />
                            <EditField label="Relation" value={draft.guardianRelation} onChange={set('guardianRelation')} options={['Mother', 'Father', 'Guardian', 'Other']} />
                            <EditField label="Guardian phone" value={draft.guardianPhone} onChange={set('guardianPhone')} span />
                            <EditField label="Address" value={draft.address} onChange={set('address')} span />
                            <EditField label="Previous school" value={draft.previousSchool} onChange={set('previousSchool')} span />
                            <EditField label="Medical notes" value={draft.medicalNotes} onChange={set('medicalNotes')} span />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, mt: 2.25 }}>
                            <Button size="small" variant="contained" disableElevation onClick={saveEdit}
                                disabled={!draft.name.trim()}
                                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                Save changes
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
