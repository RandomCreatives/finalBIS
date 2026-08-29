import { useEffect, useRef, useState } from 'react';
import { Box, Button, Divider, IconButton, MenuItem, Paper, Select, Tooltip, Typography } from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import AlignHorizontalLeftIcon from '@mui/icons-material/AlignHorizontalLeft';
import AlignHorizontalCenterIcon from '@mui/icons-material/AlignHorizontalCenter';
import FormatClearIcon from '@mui/icons-material/FormatClear';
import TableChartIcon from '@mui/icons-material/TableChart';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import PrintIcon from '@mui/icons-material/Print';

/*
 * Simplified Word-like editor — no dependencies.
 *
 * A contentEditable "page" with a formatting toolbar (text styles, headings,
 * lists, alignment, tables with row/column insertion, clear formatting) and
 * print support. `onHtmlChange` receives the document HTML on every edit;
 * the parent owns persistence.
 */

const exec = (command, value = null) => {
    document.execCommand(command, false, value);
};

const TABLE_HTML = (rows = 6, cols = 4, header = true) => {
    const cells = (tag) => Array.from({ length: cols }, () => `<${tag}>&nbsp;</${tag}>`).join('');
    const body = Array.from({ length: rows }, (_, i) =>
        `<tr>${cells(header && i === 0 ? 'th' : 'td')}</tr>`).join('');
    return `<table class="doc-table"><tbody>${body}</tbody></table><p><br></p>`;
};

/** Closest element of a selector around the current selection. */
const ancestorOf = (selector) => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return null;
    let node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    return node ? node.closest(selector) : null;
};

const insertTableRow = () => {
    const cell = ancestorOf('td, th');
    if (!cell) return;
    const row = cell.closest('tr');
    const cols = row.cells.length;
    const next = document.createElement('tr');
    for (let i = 0; i < cols; i += 1) {
        const td = document.createElement('td');
        td.innerHTML = '&nbsp;';
        next.appendChild(td);
    }
    row.parentNode.insertBefore(next, row.nextSibling);
};

const insertTableColumn = () => {
    const cell = ancestorOf('td, th');
    if (!cell) return;
    const row = cell.closest('tr');
    const index = Array.from(row.cells).indexOf(cell);
    const table = cell.closest('table');
    Array.from(table.rows).forEach((r) => {
        const isHeadCell = r === table.rows[0] && r.cells[0]?.tagName === 'TH';
        const el = document.createElement(isHeadCell ? 'th' : 'td');
        el.innerHTML = '&nbsp;';
        const ref = r.cells[index];
        if (ref) ref.parentNode.insertBefore(el, ref.nextSibling);
        else r.appendChild(el);
    });
};

function ToolButton({ icon, label, onClick, active }) {
    return (
        <Tooltip title={label}>
            <IconButton size="small" onClick={onClick}
                sx={{ borderRadius: 1, color: active ? 'primary.main' : 'text.secondary',
                    bgcolor: active ? 'rgba(2,132,199,.08)' : 'transparent' }}>
                {icon}
            </IconButton>
        </Tooltip>
    );
}

export default function WordEditor({ initialHtml, onHtmlChange, printHeader }) {
    const pageRef = useRef(null);
    const [block, setBlock] = useState('p');

    // Seed the page once; afterwards it is fully user-driven.
    useEffect(() => {
        if (pageRef.current) pageRef.current.innerHTML = initialHtml || '<p><br></p>';
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const emit = () => {
        if (pageRef.current && onHtmlChange) onHtmlChange(pageRef.current.innerHTML);
    };

    const command = (cmd, value) => {
        pageRef.current?.focus();
        exec(cmd, value);
        emit();
    };

    const changeBlock = (value) => {
        setBlock(value);
        pageRef.current?.focus();
        exec('formatBlock', value);
        emit();
    };

    const handlePrint = () => {
        emit();
        document.body.classList.add('printing-doc');
        setTimeout(() => {
            window.print();
            document.body.classList.remove('printing-doc');
        }, 60);
    };

    return (
        <Box>
            {/* ── toolbar ── */}
            <Paper variant="outlined" sx={{ borderRadius: 1.5, px: 1, py: .5, mb: 2,
                display: 'flex', alignItems: 'center', gap: .25, flexWrap: 'wrap',
                position: 'sticky', top: 64, zIndex: 50, backdropFilter: 'blur(8px)' }}>
                <ToolButton icon={<UndoIcon sx={{ fontSize: 17 }} />} label="Undo"
                    onClick={() => command('undo')} />
                <ToolButton icon={<RedoIcon sx={{ fontSize: 17 }} />} label="Redo"
                    onClick={() => command('redo')} />

                <Divider orientation="vertical" flexItem sx={{ mx: .5 }} />

                <Select size="small" value={block} onChange={(e) => changeBlock(e.target.value)}
                    sx={{ fontSize: 12.5, fontWeight: 700, minWidth: 108, '& .MuiSelect-select': { py: .55 } }}>
                    <MenuItem value="p">Paragraph</MenuItem>
                    <MenuItem value="h1">Heading 1</MenuItem>
                    <MenuItem value="h2">Heading 2</MenuItem>
                    <MenuItem value="h3">Heading 3</MenuItem>
                </Select>

                <Divider orientation="vertical" flexItem sx={{ mx: .5 }} />

                <ToolButton icon={<FormatBoldIcon sx={{ fontSize: 17 }} />} label="Bold (Ctrl+B)"
                    onClick={() => command('bold')} />
                <ToolButton icon={<FormatItalicIcon sx={{ fontSize: 17 }} />} label="Italic (Ctrl+I)"
                    onClick={() => command('italic')} />
                <ToolButton icon={<FormatUnderlinedIcon sx={{ fontSize: 17 }} />} label="Underline (Ctrl+U)"
                    onClick={() => command('underline')} />
                <ToolButton icon={<StrikethroughSIcon sx={{ fontSize: 17 }} />} label="Strikethrough"
                    onClick={() => command('strikeThrough')} />
                <ToolButton icon={<FormatClearIcon sx={{ fontSize: 17 }} />} label="Clear formatting"
                    onClick={() => { command('removeFormat'); command('formatBlock', 'p'); setBlock('p'); }} />

                <Divider orientation="vertical" flexItem sx={{ mx: .5 }} />

                <ToolButton icon={<FormatListBulletedIcon sx={{ fontSize: 17 }} />} label="Bulleted list"
                    onClick={() => command('insertUnorderedList')} />
                <ToolButton icon={<FormatListNumberedIcon sx={{ fontSize: 17 }} />} label="Numbered list"
                    onClick={() => command('insertOrderedList')} />
                <ToolButton icon={<AlignHorizontalLeftIcon sx={{ fontSize: 17 }} />} label="Align left"
                    onClick={() => command('justifyLeft')} />
                <ToolButton icon={<AlignHorizontalCenterIcon sx={{ fontSize: 17 }} />} label="Center"
                    onClick={() => command('justifyCenter')} />

                <Divider orientation="vertical" flexItem sx={{ mx: .5 }} />

                <ToolButton icon={<TableChartIcon sx={{ fontSize: 17 }} />} label="Insert table (for schemes of work)"
                    onClick={() => command('insertHTML', TABLE_HTML())} />
                <ToolButton icon={<PlaylistAddIcon sx={{ fontSize: 17 }} />} label="Add table row"
                    onClick={() => { insertTableRow(); emit(); }} />
                <ToolButton icon={<ViewColumnIcon sx={{ fontSize: 17 }} />} label="Add table column"
                    onClick={() => { insertTableColumn(); emit(); }} />

                <Box sx={{ ml: 'auto' }}>
                    <Button size="small" variant="outlined" startIcon={<PrintIcon sx={{ fontSize: 15 }} />}
                        onClick={handlePrint}
                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                        Print
                    </Button>
                </Box>
            </Paper>

            {/* ── the page ── */}
            <Box className="doc-print-area">
                {printHeader && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        maxWidth: 780, mx: 'auto', mb: 1, px: { xs: 2, md: 0 } }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                            textTransform: 'uppercase', letterSpacing: .8 }}>
                            {printHeader}
                        </Typography>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
                            British International School · NOC Gerji
                        </Typography>
                    </Box>
                )}
                <Paper
                    ref={pageRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={emit}
                    className="doc-page"
                    sx={{
                        maxWidth: 780, mx: 'auto', minHeight: 860, p: { xs: 3, md: 6 },
                        borderRadius: .75, bgcolor: '#ffffff', color: '#1a1a1a',
                        boxShadow: '0 2px 14px rgba(15,23,42,.10)',
                        '&:focus': { outline: 'none', boxShadow: '0 2px 18px rgba(2,132,199,.18)' },
                        fontSize: 14, lineHeight: 1.65,
                        fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
                        '& h1': { fontSize: 24, fontWeight: 800, lineHeight: 1.25, my: 2 },
                        '& h2': { fontSize: 18, fontWeight: 800, lineHeight: 1.3, mt: 2.5, mb: 1 },
                        '& h3': { fontSize: 15.5, fontWeight: 700, mt: 2, mb: .75 },
                        '& p': { my: .75 },
                        '& ul, & ol': { pl: 3, my: .75 },
                        '& .doc-table': { borderCollapse: 'collapse', width: '100%', my: 1.5 },
                        '& .doc-table th, & .doc-table td': {
                            border: '1px solid #94a3b8', p: '6px 8px', fontSize: 13,
                            verticalAlign: 'top', textAlign: 'left',
                        },
                        '& .doc-table th': { bgcolor: '#f1f5f9', fontWeight: 800 },
                        '& table': { borderCollapse: 'collapse', width: '100%', my: 1.5 },
                        '& table th, & table td': {
                            border: '1px solid #94a3b8', p: '6px 8px', fontSize: 13,
                            verticalAlign: 'top', textAlign: 'left',
                        },
                        '& table th': { bgcolor: '#f1f5f9', fontWeight: 800 },
                    }}>
                </Paper>
            </Box>

            <Typography sx={{ textAlign: 'center', fontSize: 11.5, color: 'text.secondary', mt: 1.5 }}>
                Formatting, tables and text are saved automatically as you type.
            </Typography>
        </Box>
    );
}
