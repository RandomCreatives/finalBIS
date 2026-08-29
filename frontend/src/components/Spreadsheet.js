import { useMemo, useRef, useState } from 'react';
import {
    Box, Button, Divider, IconButton, Menu, MenuItem, Tooltip, Typography,
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import TitleIcon from '@mui/icons-material/Title';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

/*
 * Simplified Excel-like spreadsheet — no dependencies.
 *
 * A grid of editable cells with:
 *   - add / remove rows & columns
 *   - per-cell formatting: bold, italic, underline, alignment, fill & text colour
 *   - keyboard navigation (arrows / Enter move between cells)
 *
 * The grid model is owned by the parent (persisted however it likes). This
 * component is fully controlled: `value` is the model, `onChange` receives the
 * new model on every edit (debounced).
 *
 *   model = { rows: number, cols: number, data: Cell[][] }
 *   Cell  = { v?: string, b?: 0|1, i?: 0|1, u?: 0|1,
 *             align?: 'l'|'c'|'r', bg?: string, fg?: string }
 */

const colLabel = (n) => {
    let s = '';
    let x = n;
    do {
        s = String.fromCharCode(65 + (x % 26)) + s;
        x = Math.floor(x / 26) - 1;
    } while (x >= 0);
    return s;
};

const emptyCell = () => ({ v: '' });

const makeModel = (rows = 12, cols = 6) => ({
    rows,
    cols,
    data: Array.from({ length: rows }, () => Array.from({ length: cols }, emptyCell)),
});

const clone = (m) => ({
    rows: m.rows,
    cols: m.cols,
    data: m.data.map((row) => row.map((c) => ({ ...c }))),
});

/* ── cell formatting toolbar ──────────────────────────────── */

const FILLS = [
    { label: 'None', value: '' },
    { label: 'Yellow', value: '#fef08a' },
    { label: 'Green', value: '#bbf7d0' },
    { label: 'Blue', value: '#bfdbfe' },
    { label: 'Pink', value: '#fbcfe8' },
    { label: 'Orange', value: '#fed7aa' },
    { label: 'Gray', value: '#e2e8f0' },
];

const TEXTS = [
    { label: 'Default', value: '' },
    { label: 'Red', value: '#dc2626' },
    { label: 'Blue', value: '#1d4ed8' },
    { label: 'Green', value: '#15803d' },
    { label: 'Black', value: '#0f172a' },
];

function CellToolbar({ cell, onApply }) {
    const [fillAnchor, setFillAnchor] = useState(null);
    const [textAnchor, setTextAnchor] = useState(null);

    const toggle = (key) => onApply({ [key]: cell[key] ? 0 : 1 });

    const Btn = ({ title, active, onClick, children }) => (
        <Tooltip title={title}>
            <IconButton size="small" onClick={onClick}
                sx={{ border: '1px solid', borderColor: active ? 'primary.main' : 'transparent',
                    bgcolor: active ? 'rgba(37,99,235,.1)' : 'transparent', color: active ? 'primary.main' : 'text.secondary',
                    '&:hover': { borderColor: 'primary.main' } }}>
                {children}
            </IconButton>
        </Tooltip>
    );

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: .5, flexWrap: 'wrap' }}>
            <Btn title="Bold" active={cell.b} onClick={() => toggle('b')}><FormatBoldIcon sx={{ fontSize: 17 }} /></Btn>
            <Btn title="Italic" active={cell.i} onClick={() => toggle('i')}><FormatItalicIcon sx={{ fontSize: 17 }} /></Btn>
            <Btn title="Underline" active={cell.u} onClick={() => toggle('u')}><FormatUnderlinedIcon sx={{ fontSize: 17 }} /></Btn>
            <Divider orientation="vertical" flexItem sx={{ mx: .5 }} />
            <Btn title="Align left" active={cell.align === 'l'} onClick={() => onApply({ align: 'l' })}><FormatAlignLeftIcon sx={{ fontSize: 17 }} /></Btn>
            <Btn title="Align centre" active={cell.align === 'c'} onClick={() => onApply({ align: 'c' })}><FormatAlignCenterIcon sx={{ fontSize: 17 }} /></Btn>
            <Btn title="Align right" active={cell.align === 'r'} onClick={() => onApply({ align: 'r' })}><FormatAlignRightIcon sx={{ fontSize: 17 }} /></Btn>
            <Divider orientation="vertical" flexItem sx={{ mx: .5 }} />
            <Tooltip title="Fill colour">
                <IconButton size="small" onClick={(e) => setFillAnchor(e.currentTarget)}
                    sx={{ color: 'text.secondary', border: '1px solid transparent',
                        '&:hover': { borderColor: 'primary.main' } }}>
                    <Box sx={{ position: 'relative', display: 'flex' }}>
                        <FormatColorFillIcon sx={{ fontSize: 17 }} />
                        <Box sx={{ position: 'absolute', bottom: 2, left: 2, right: 2, height: 3,
                            borderRadius: 1, bgcolor: cell.bg || '#e2e8f0' }} />
                    </Box>
                </IconButton>
            </Tooltip>
            <Menu anchorEl={fillAnchor} open={Boolean(fillAnchor)} onClose={() => setFillAnchor(null)}>
                {FILLS.map((f) => (
                    <MenuItem key={f.label} onClick={() => { onApply({ bg: f.value }); setFillAnchor(null); }}
                        sx={{ gap: 1, fontSize: 13 }}>
                        <Box sx={{ width: 16, height: 16, borderRadius: .75, bgcolor: f.value || '#fff',
                            border: '1px solid', borderColor: 'divider' }} />
                        {f.label}
                    </MenuItem>
                ))}
            </Menu>
            <Tooltip title="Text colour">
                <IconButton size="small" onClick={(e) => setTextAnchor(e.currentTarget)}
                    sx={{ color: 'text.secondary', border: '1px solid transparent',
                        '&:hover': { borderColor: 'primary.main' } }}>
                    <Box sx={{ position: 'relative', display: 'flex' }}>
                        <TitleIcon sx={{ fontSize: 17 }} />
                        <Box sx={{ position: 'absolute', bottom: 2, left: 2, right: 2, height: 3,
                            borderRadius: 1, bgcolor: cell.fg || '#0f172a' }} />
                    </Box>
                </IconButton>
            </Tooltip>
            <Menu anchorEl={textAnchor} open={Boolean(textAnchor)} onClose={() => setTextAnchor(null)}>
                {TEXTS.map((t) => (
                    <MenuItem key={t.label} onClick={() => { onApply({ fg: t.value }); setTextAnchor(null); }}
                        sx={{ gap: 1, fontSize: 13 }}>
                        <Box sx={{ width: 16, height: 16, borderRadius: .75, bgcolor: '#fff',
                            border: '1px solid', borderColor: 'divider', color: t.value || 'inherit',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>
                            A
                        </Box>
                        {t.label}
                    </MenuItem>
                ))}
            </Menu>
            <Btn title="Clear formatting" active={false} onClick={() => onApply({ b: 0, i: 0, u: 0, align: '', bg: '', fg: '' })}>
                <RestartAltIcon sx={{ fontSize: 17 }} />
            </Btn>
        </Box>
    );
}

/* ── spreadsheet ──────────────────────────────────────────── */

export default function Spreadsheet({ value, onChange }) {
    const initial = useMemo(() => (value && value.data ? clone(value) : makeModel()), []);
    const [grid, setGrid] = useState(initial);
    const [sel, setSel] = useState({ r: 0, c: 0 });
    const saveTimer = useRef(null);
    const inputRefs = useRef(new Map());

    const commit = (next) => {
        setGrid(next);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => onChange(clone(next)), 500);
    };

    const updateCell = (r, c, patch) => {
        const next = clone(grid);
        next.data[r][c] = { ...next.data[r][c], ...patch };
        commit(next);
    };

    const setCell = (r, c, v) => updateCell(r, c, { v });

    const activeCell = grid.data[sel.r]?.[sel.c] || {};

    const applyToActive = (patch) => updateCell(sel.r, sel.c, patch);

    const addRow = () => {
        const next = clone(grid);
        next.rows += 1;
        next.data.push(Array.from({ length: next.cols }, emptyCell));
        commit(next);
    };

    const addColumn = () => {
        const next = clone(grid);
        next.cols += 1;
        next.data.forEach((row) => row.push(emptyCell()));
        commit(next);
    };

    const deleteRow = (r) => {
        if (grid.rows <= 1) return;
        const next = clone(grid);
        next.rows -= 1;
        next.data.splice(r, 1);
        setSel((s) => ({ r: Math.min(s.r, next.rows - 1), c: s.c }));
        commit(next);
    };

    const deleteColumn = (c) => {
        if (grid.cols <= 1) return;
        const next = clone(grid);
        next.cols -= 1;
        next.data.forEach((row) => row.splice(c, 1));
        setSel((s) => ({ r: s.r, c: Math.min(s.c, next.cols - 1) }));
        commit(next);
    };

    const focusCell = (r, c) => {
        setSel({ r, c });
        const el = inputRefs.current.get(`${r}-${c}`);
        if (el) el.focus();
    };

    const move = (dr, dc) => {
        const r = Math.max(0, Math.min(grid.rows - 1, sel.r + dr));
        const c = Math.max(0, Math.min(grid.cols - 1, sel.c + dc));
        focusCell(r, c);
    };

    const onKeyDown = (e) => {
        if (e.key === 'ArrowUp') { e.preventDefault(); move(-1, 0); }
        else if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); move(1, 0); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); move(0, -1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); move(0, 1); }
    };

    const cellStyle = (cell) => ({
        fontWeight: cell.b ? 700 : 400,
        fontStyle: cell.i ? 'italic' : 'normal',
        textDecoration: cell.u ? 'underline' : 'none',
        textAlign: cell.align === 'c' ? 'center' : cell.align === 'r' ? 'right' : 'left',
        background: cell.bg || '#fff',
        color: cell.fg || 'inherit',
    });

    return (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
            {/* toolbar */}
            <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider',
                display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <CellToolbar cell={activeCell} onApply={applyToActive} />
                <Box sx={{ ml: 'auto', display: 'flex', gap: .5 }}>
                    <Button size="small" startIcon={<AddIcon sx={{ fontSize: 15 }} />}
                        onClick={addRow} sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                        Row
                    </Button>
                    <Button size="small" startIcon={<AddIcon sx={{ fontSize: 15 }} />}
                        onClick={addColumn} sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                        Column
                    </Button>
                </Box>
            </Box>

            {/* grid */}
            <Box sx={{ overflowX: 'auto', p: .5 }}>
                <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                        <tr>
                            <th style={headCorner} />
                            {Array.from({ length: grid.cols }, (_, c) => (
                                <th key={c} style={headCell}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: .25 }}>
                                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>
                                            {colLabel(c)}
                                        </Typography>
                                        <IconButton size="small" onClick={() => deleteColumn(c)}
                                            sx={{ opacity: .35, '&:hover': { opacity: 1, color: 'error.main' } }}>
                                            <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                                        </IconButton>
                                    </Box>
                                </th>
                            ))}
                            <th style={headCorner}>
                                <IconButton size="small" onClick={addColumn}><AddIcon sx={{ fontSize: 15 }} /></IconButton>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: grid.rows }, (_, r) => (
                            <tr key={r}>
                                <th style={headCell}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: .25 }}>
                                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'text.secondary' }}>
                                            {r + 1}
                                        </Typography>
                                        <IconButton size="small" onClick={() => deleteRow(r)}
                                            sx={{ opacity: .35, '&:hover': { opacity: 1, color: 'error.main' } }}>
                                            <DeleteOutlineIcon sx={{ fontSize: 13 }} />
                                        </IconButton>
                                    </Box>
                                </th>
                                {Array.from({ length: grid.cols }, (_, c) => {
                                    const cell = grid.data[r][c];
                                    const isActive = sel.r === r && sel.c === c;
                                    return (
                                        <td key={c} style={{ border: '1px solid', borderColor: '#e2e8f0', padding: 0 }}>
                                            <input
                                                ref={(el) => { if (el) inputRefs.current.set(`${r}-${c}`, el); }}
                                                value={cell.v || ''}
                                                onChange={(e) => setCell(r, c, e.target.value)}
                                                onFocus={() => setSel({ r, c })}
                                                onKeyDown={onKeyDown}
                                                style={{
                                                    width: '100%', height: 34, border: 'none', outline: 'none',
                                                    padding: '0 8px', fontSize: 13, boxSizing: 'border-box',
                                                    ...cellStyle(cell),
                                                    boxShadow: isActive ? 'inset 0 0 0 2px #2563eb' : 'none',
                                                }}
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        <tr>
                            <th style={headCorner}>
                                <IconButton size="small" onClick={addRow}><AddIcon sx={{ fontSize: 15 }} /></IconButton>
                            </th>
                            <td colSpan={grid.cols} style={{ border: 'none' }} />
                        </tr>
                    </tbody>
                </table>
            </Box>
        </Box>
    );
}

const headCell = {
    border: '1px solid', borderColor: '#e2e8f0', background: '#f8fafc',
    padding: '2px 4px', width: 120, minWidth: 120,
};

const headCorner = {
    border: '1px solid', borderColor: '#e2e8f0', background: '#f1f5f9', width: 56, minWidth: 56, padding: 2,
};

export { makeModel };
