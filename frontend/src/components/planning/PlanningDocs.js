/*
 * Planning documents — Word-like pages and Excel-like spreadsheets kept
 * per classroom (main teachers) or per teacher (subject teachers).
 * Extracted from ClassHome so both dashboards share one implementation.
 *
 * Storage is localStorage ('bisnoc.demo.planningDocs'), bucketed by the
 * class/teacher name — the same bucket ClassHome has always used, so
 * existing documents survive the move.
 */
import { useEffect, useRef, useState } from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, IconButton, Snackbar,
    TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import WordEditor from '../WordEditor';
import Spreadsheet, { makeModel } from '../Spreadsheet';

const PLANNING_STORE_KEY = 'bisnoc.demo.planningDocs';
const readDocs = () => JSON.parse(localStorage.getItem(PLANNING_STORE_KEY) || '{}');
const writeDocs = (value) => localStorage.setItem(PLANNING_STORE_KEY, JSON.stringify(value));

const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const PLANNING_TEMPLATES = {
    blank: {
        label: 'Blank page',
        title: (k) => `Planning — ${k.name}`,
        html: '<p><br></p>',
    },
    sheet: {
        label: 'Spreadsheet',
        title: (k) => `Spreadsheet — ${k.name}`,
        sheet: true,
    },
    scheme: {
        label: 'Scheme of Work',
        title: (k) => `Scheme of Work — ${k.name}`,
        html: `
<h1>Scheme of Work</h1>
<p><strong>School:</strong> British International School — NOC Gerji<br>
<strong>Class:</strong> ____________ &nbsp;&nbsp; <strong>Subject:</strong> ____________ &nbsp;&nbsp; <strong>Term:</strong> ____________ (2026/27)<br>
<strong>Teacher:</strong> ____________</p>
<table class="doc-table"><tbody>
<tr><th>Week</th><th>Unit / Topic</th><th>Learning objectives</th><th>Activities &amp; resources</th><th>Reflection</th></tr>
${'<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>'.repeat(12)}
</tbody></table>
<p><br></p>`,
    },
    lesson: {
        label: 'Lesson Plan',
        title: (k) => `Lesson Plan — ${k.name}`,
        html: `
<h1>Lesson Plan</h1>
<p><strong>Date:</strong> ____________ &nbsp;&nbsp; <strong>Week:</strong> ____________ &nbsp;&nbsp;
<strong>Class:</strong> ____________ &nbsp;&nbsp; <strong>Subject:</strong> ____________ &nbsp;&nbsp;
<strong>Period:</strong> ____________</p>
<h2>1. Objectives</h2>
<p>By the end of the lesson, learners will be able to…</p>
<h2>2. Materials &amp; resources</h2>
<p><br></p>
<h2>3. Introduction (5–10 min)</h2>
<p><br></p>
<h2>4. Lesson development</h2>
<p><br></p>
<h2>5. Closure &amp; summary</h2>
<p><br></p>
<h2>6. Assessment / evidence of learning</h2>
<p><br></p>
<h2>7. Reflection (complete after teaching)</h2>
<p><br></p>`,
    },
};

const DOC_TYPE_META = {
    sheet: { label: 'Spreadsheet', color: '#0891b2' },
    scheme: { label: 'Scheme of Work', color: '#7c3aed' },
    lesson: { label: 'Lesson Plan', color: '#2563eb' },
    blank: { label: 'Document', color: '#64748b' },
};
function DocEditor({ doc, klass, onBack, onPatch, onToast }) {
    const saveTimer = useRef(null);
    const [status, setStatus] = useState('saved');

    const handleHtml = (html) => {
        setStatus('saving');
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            onPatch({ html });
            setStatus('saved');
        }, 600);
    };

    const handleModel = (model) => {
        setStatus('saving');
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            onPatch({ model });
            setStatus('saved');
        }, 600);
    };

    useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

    const meta = DOC_TYPE_META[doc.type] || DOC_TYPE_META.blank;

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2, flexWrap: 'wrap' }}>
                <Button size="small" onClick={onBack}
                    sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                    ← All documents
                </Button>
                <Chip size="small" label={meta.label}
                    sx={{ fontWeight: 700, borderRadius: 1, height: 22, fontSize: 11,
                        bgcolor: rgba(meta.color, 0.1), color: meta.color }} />
                <TextField size="small" value={doc.title} sx={{ flexGrow: 1, maxWidth: 460,
                    '& .MuiInputBase-input': { fontSize: 14, fontWeight: 700 } }}
                    onChange={(e) => onPatch({ title: e.target.value })} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, ml: 'auto',
                    color: status === 'saving' ? 'text.secondary' : '#16a34a' }}>
                    {status === 'saving' ? 'Saving…' : '✓ Saved'}
                </Typography>
            </Box>
            {doc.type === 'sheet' ? (
                <Spreadsheet
                    key={doc.id}
                    value={doc.model || makeModel()}
                    onChange={handleModel}
                />
            ) : (
                <WordEditor
                    key={doc.id}
                    initialHtml={doc.html}
                    onHtmlChange={handleHtml}
                    printHeader={`${meta.label} · ${klass.name}`}
                />
            )}
            <Snackbar open={false} message="" />
        </Box>
    );
}

function PlanningSection({ klass, onToast }) {
    const [docs, setDocs] = useState(() => readDocs()[klass.name] || []);
    const [openId, setOpenId] = useState(null);

    const persist = (next) => {
        setDocs(next);
        const all = readDocs();
        all[klass.name] = next;
        writeDocs(all);
    };

    const createDoc = (type) => {
        const tpl = PLANNING_TEMPLATES[type];
        const doc = {
            id: `doc-${Date.now()}`,
            type,
            title: tpl.title(klass),
            html: tpl.sheet ? undefined : tpl.html,
            model: tpl.sheet ? makeModel() : undefined,
            updatedAt: Date.now(),
        };
        persist([doc, ...docs]);
        setOpenId(doc.id);
        onToast(`${tpl.label} created`);
    };

    const patchDoc = (id, patch) => {
        persist(docs.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d)));
    };

    const deleteDoc = (id) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm('Delete this document? This cannot be undone.')) return;
        persist(docs.filter((d) => d.id !== id));
        if (openId === id) setOpenId(null);
        onToast('Document deleted');
    };

    const openDoc = docs.find((d) => d.id === openId);
    if (openDoc) {
        return (
            <DocEditor doc={openDoc} klass={klass}
                onBack={() => setOpenId(null)}
                onPatch={(patch) => patchDoc(openDoc.id, patch)}
                onToast={onToast} />
        );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', flexGrow: 1 }}>
                    Build your planning as a Word-like page (formatted text, tables, printing) or an
                    Excel-like spreadsheet — schemes of work, weekly plans, grade trackers, anything.
                </Typography>
                {Object.entries(PLANNING_TEMPLATES).map(([type, tpl]) => (
                    <Button key={type} size="small" variant={type === 'blank' ? 'outlined' : 'contained'}
                        disableElevation startIcon={<AddIcon sx={{ fontSize: 15 }} />}
                        onClick={() => createDoc(type)}
                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                        New {tpl.label}
                    </Button>
                ))}
            </Box>

            {docs.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                    No planning documents yet — start with a <strong>Scheme of Work</strong> for the term,
                    then add weekly <strong>Lesson Plans</strong>.
                </Alert>
            ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.75 }}>
                    {docs.map((d) => {
                        const meta = DOC_TYPE_META[d.type] || DOC_TYPE_META.blank;
                        return (
                            <Card key={d.id} variant="outlined"
                                sx={{ borderRadius: 1.5, cursor: 'pointer', transition: 'border-color .15s, transform .15s',
                                    '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' } }}
                                onClick={() => setOpenId(d.id)}>
                                <CardContent sx={{ p: 2.25 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Chip size="small" label={meta.label}
                                            sx={{ fontWeight: 700, borderRadius: 1, height: 20, fontSize: 10.5,
                                                bgcolor: rgba(meta.color, 0.1), color: meta.color }} />
                                        <Box sx={{ ml: 'auto' }} onClick={(e) => e.stopPropagation()}>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" onClick={() => deleteDoc(d.id)}>
                                                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                    <Typography sx={{ fontWeight: 800, fontSize: 14.5, lineHeight: 1.3 }}>
                                        {d.title}
                                    </Typography>
                                    <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: .75 }}>
                                        Last edited {new Date(d.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{' '}
                                        at {new Date(d.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                    </Typography>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}

/* ── students section ─────────────────────────────────────── */

export default PlanningSection;
