import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControl, FormControlLabel, IconButton, Input, InputAdornment,
    MenuItem, Paper, Select, Stack, Switch, Table, TableBody,
    TableCell, TableContainer, TableHead, TablePagination, TableRow,
    TableSortLabel, TextField, Tooltip, Typography, Snackbar,
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    FilterList as FilterIcon,
    Download as DownloadIcon,
    Upload as UploadIcon,
    ArrowDownward as ArrowDownIcon,
    ArrowUpward as ArrowUpIcon,
    SwapHoriz as TransferIcon,
    Visibility as ViewIcon,
    ContentCopy as DuplicateIcon,
    Search as SearchIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    MoreVert as MoreIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';

/* ── Styled components ───────────────────────────────────── */
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
    borderRadius: 3,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[1],
    overflow: 'visible',
}));

const StyledTableHead = styled(TableHead)(({ theme }) => ({
    '& .MuiTableCell-head': {
        backgroundColor: alpha(theme.palette.primary.main, 0.04),
        fontWeight: 700,
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: theme.palette.text.primary,
        borderBottom: `2px solid ${theme.palette.divider}`,
        padding: '12px 16px',
        whiteSpace: 'nowrap',
    },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
    '&:hover': {
        backgroundColor: alpha(theme.palette.action.hover, 0.5),
    },
    '&.Mui-selected': {
        backgroundColor: alpha(theme.palette.primary.main, 0.08),
        '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
        },
    },
    cursor: 'pointer',
    transition: 'background-color 0.15s',
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    padding: '12px 16px',
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontSize: 14,
    verticalAlign: 'middle',
}));

const FilterChip = styled(Chip)(({ theme }) => ({
    height: 32,
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 16,
    '& .MuiChip-deleteIcon': { fontSize: 16 },
}));

const ActionButton = styled(IconButton)(({ theme }) => ({
    width: 36,
    height: 36,
    borderRadius: 2,
    color: theme.palette.text.secondary,
    '&:hover': {
        backgroundColor: alpha(theme.palette.primary.main, 0.1),
        color: theme.palette.primary.main,
    },
    transition: 'all 0.15s',
    '@media (pointer: coarse)': {
        width: 44,
        height: 44,
    },
}));

const ToolbarButton = styled(Button)(({ theme }) => ({
    borderRadius: 2,
    textTransform: 'none',
    fontWeight: 600,
    fontSize: 13,
    padding: '8px 16px',
    minHeight: 40,
    '@media (pointer: coarse)': {
        minHeight: 48,
        padding: '12px 20px',
    },
}));

/* ── Column definition type ──────────────────────────────── */
const COLUMN_TYPES = {
    TEXT: 'text',
    NUMBER: 'number',
    DATE: 'date',
    BOOLEAN: 'boolean',
    CHIP: 'chip',
    ACTIONS: 'actions',
};

/* ── DataTable Component ─────────────────────────────────── */
export function DataTable({
    title,
    subtitle,
    columns,
    data,
    loading = false,
    error = null,
    emptyMessage = 'No records found.',
    pageSize = 15,
    pageSizeOptions = [10, 15, 25, 50],
    sortable = true,
    filterable = true,
    selectable = false,
    onRowClick,
    onCreate,
    onEdit,
    onDelete,
    onView,
    onTransfer,
    onDuplicate,
    onExport,
    onImport,
    createLabel = 'Add new',
    transferLabel = 'Transfer',
    exportLabel = 'Export',
    importLabel = 'Import',
    getRowId = (row) => row.id,
    rowActions = [],
    toolbarActions = [],
    className = '',
    sx = {},
}) {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(pageSize);
    const [sortConfig, setSortConfig] = useState({ column: null, direction: 'asc' });
    const [filters, setFilters] = useState({});
    const [globalSearch, setGlobalSearch] = useState('');
    const [selectedRows, setSelectedRows] = useState([]);
    const [density, setDensity] = useState('standard');
    const [showFilters, setShowFilters] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const showToast = useCallback((message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    }, []);

    // Filter and sort data
    const processedData = useMemo(() => {
        if (!data) return [];

        let result = [...data];

        // Global search
        if (globalSearch) {
            const searchLower = globalSearch.toLowerCase();
            result = result.filter(row =>
                columns.some(col =>
                    col.accessor && String(row[col.accessor] ?? '').toLowerCase().includes(searchLower)
                )
            );
        }

        // Column filters
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== '' && value !== null && value !== undefined) {
                const col = columns.find(c => c.accessor === key);
                if (col?.filterable !== false) {
                    result = result.filter(row => {
                        const cellValue = row[key];
                        if (cellValue === null || cellValue === undefined) return false;
                        if (typeof value === 'string') {
                            return String(cellValue).toLowerCase().includes(value.toLowerCase());
                        }
                        return cellValue === value;
                    });
                }
            }
        });

        // Sorting
        if (sortConfig.column && sortable) {
            const col = columns.find(c => c.accessor === sortConfig.column);
            if (col?.sortable !== false) {
                result.sort((a, b) => {
                    const aVal = a[sortConfig.column];
                    const bVal = b[sortConfig.column];
                    if (aVal === null || aVal === undefined) return 1;
                    if (bVal === null || bVal === undefined) return -1;

                    let comparison = 0;
                    if (col.type === COLUMN_TYPES.NUMBER) {
                        comparison = Number(aVal) - Number(bVal);
                    } else if (col.type === COLUMN_TYPES.DATE) {
                        comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
                    } else {
                        comparison = String(aVal).localeCompare(String(bVal));
                    }
                    return sortConfig.direction === 'asc' ? comparison : -comparison;
                });
            }
        }

        return result;
    }, [data, globalSearch, filters, sortConfig, columns, sortable]);

    // Pagination
    const paginatedData = useMemo(() => {
        const start = page * rowsPerPage;
        return processedData.slice(start, start + rowsPerPage);
    }, [processedData, page, rowsPerPage]);

    // Selection handlers
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            setSelectedRows(paginatedData.map(getRowId));
        } else {
            setSelectedRows([]);
        }
    };

    const handleSelectOne = (id) => (event) => {
        if (event.target.checked) {
            setSelectedRows(prev => [...prev, id]);
        } else {
            setSelectedRows(prev => prev.filter(x => x !== id));
        }
    };

    const handleSort = (column) => {
        if (!sortable) return;
        const col = columns.find(c => c.accessor === column);
        if (col?.sortable === false) return;

        setSortConfig(prev => ({
            column,
            direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
        setPage(0);
    };

    const handleFilterChange = (column, value) => {
        setFilters(prev => ({ ...prev, [column]: value }));
        setPage(0);
    };

    const clearFilters = () => {
        setFilters({});
        setGlobalSearch('');
        setPage(0);
    };

    const hasActiveFilters = Object.values(filters).some(v => v !== '' && v != null) || globalSearch;

    // Pagination handlers
    const handlePageChange = (_, newPage) => setPage(newPage);
    const handleRowsPerPageChange = (event) => {
        setRowsPerPage(Number(event.target.value));
        setPage(0);
    };

    // Action handlers
    const handleCreate = () => onCreate?.();
    const handleEdit = (row, event) => { event.stopPropagation(); onEdit?.(row); };
    const handleDelete = (row, event) => { event.stopPropagation(); onDelete?.(row); };
    const handleView = (row, event) => { event.stopPropagation(); onView?.(row); };
    const handleTransfer = (row, event) => { event.stopPropagation(); onTransfer?.(row); };
    const handleDuplicate = (row, event) => { event.stopPropagation(); onDuplicate?.(row); };
    const handleRowClick = (row) => onRowClick?.(row);

    const showTransferButton = Boolean(onTransfer);
    const showViewButton = Boolean(onView);
    const showDuplicateButton = Boolean(onDuplicate);

    return (
        <Box className={className} sx={sx}>
            {/* Toolbar */}
            <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>

                    {/* Title & Search */}
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Stack direction="column" spacing={0.5} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                                {title}
                            </Typography>
                            {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
                        </Stack>

                        {(filterable && (globalSearch || showFilters)) && (
                            <Box sx={{ mt: 1.5 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Search all columns…"
                                    value={globalSearch}
                                    onChange={(e) => setGlobalSearch(e.target.value)}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
                                        endAdornment: globalSearch ? (
                                            <InputAdornment position="end">
                                                <IconButton size="small" onClick={() => setGlobalSearch('')} edge="end">
                                                    <FilterIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </InputAdornment>
                                        ) : null,
                                    }}
                                    variant="outlined"
                                    sx={{ maxWidth: { xs: '100%', sm: 360 } }}
                                />
                            </Box>
                        )}
                    </Box>

                    {/* Actions */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-end' }} sx={{ flexWrap: 'wrap' }}>

                        {/* Density selector */}
                        <FormControl size="small" variant="outlined" sx={{ minWidth: 160 }}>
                            <Select value={density} onChange={(e) => setDensity(e.target.value)} displayEmpty>
                                <MenuItem value="standard">Standard</MenuItem>
                                <MenuItem value="compact">Compact</MenuItem>
                                <MenuItem value="comfortable">Comfortable</MenuItem>
                            </Select>
                            <FormControlLabel control={<Input />} label="Density" />
                        </FormControl>

                        {/* Filter toggle */}
                        {filterable && (
                            <ToolbarButton
                                variant={showFilters ? 'contained' : 'outlined'}
                                startIcon={<FilterIcon />}
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                Filters
                            </ToolbarButton>
                        )}

                        {/* Export */}
                        {onExport && (
                            <ToolbarButton variant="outlined" startIcon={<DownloadIcon />} onClick={onExport}>
                                {exportLabel}
                            </ToolbarButton>
                        )}

                        {/* Import */}
                        {onImport && (
                            <ToolbarButton variant="outlined" startIcon={<UploadIcon />} onClick={onImport}>
                                {importLabel}
                            </ToolbarButton>
                        )}

                        {/* Create */}
                        {onCreate && (
                            <ToolbarButton variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                                {createLabel}
                            </ToolbarButton>
                        )}

                        {/* Custom toolbar actions */}
                        {toolbarActions.map((action, idx) => (
                            <ToolbarButton
                                key={idx}
                                variant={action.variant || 'outlined'
                                }
                                startIcon={action.icon}
                                onClick={action.onClick}
                                disabled={action.disabled}
                            >
                                {action.label}
                            </ToolbarButton>
                        ))}
                    </Stack>
                </Stack>

                {/* Advanced Filters */}
                {showFilters && filterable && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                            {columns
                                .filter(c => c.filterable !== false && c.accessor && c.type !== COLUMN_TYPES.ACTIONS)
                                .map(col => (
                                    <Box key={col.accessor} sx={{ flexGrow: 1, minWidth: 180 }}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            placeholder={`Filter ${col.header}`}
                                            value={filters[col.accessor] || ''}
                                            onChange={(e) => handleFilterChange(col.accessor, e.target.value)}
                                            variant="outlined"
                                            InputProps={{
                                                endAdornment: filters[col.accessor] ? (
                                                    <InputAdornment position="end">
                                                        <IconButton size="small" onClick={() => handleFilterChange(col.accessor, '')} edge="end">
                                                            <FilterIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    </InputAdornment>
                                                ) : null,
                                            }
                                        />
                                    </Box>
                                ))}
                            {hasActiveFilters && (
                                <ToolbarButton variant="text" color="error" onClick={clearFilters}>
                                    Clear all filters
                                </ToolbarButton>
                            )}
                        </Stack>
                    </Box>
                )}
            </Paper>

            {/* Table */}
            <StyledTableContainer>
                <Table
                    size={density === 'compact' ? 'small' : density === 'comfortable' ? 'medium' : 'medium'}
                    stickyHeader
                >
                    <StyledTableHead>
                        <TableRow>
                            {selectable && (
                                <TableCell padding="checkbox" sx={{ width: 56 }}>
                                    <FormControlLabel
                                        control={
                                            <input
                                                type="checkbox"
                                                checked={selectedRows.length === paginatedData.length && paginatedData.length > 0}
                                                indeterminate={selectedRows.length > 0 && selectedRows.length < paginatedData.length}
                                                onChange={handleSelectAll}
                                            />
                                        }
                                        label=""
                                    />
                                </TableCell>
                            )}
                            {columns.map((col) => (
                                <TableCell
                                    key={col.accessor || col.header}
                                    align={col.align}
                                    sortable={sortable && col.sortable !== false && col.type !== COLUMN_TYPES.ACTIONS}
                                    sortDirection={sortConfig.column === col.accessor ? sortConfig.direction : false}
                                >
                                    {sortable && col.sortable !== false && col.type !== COLUMN_TYPES.ACTIONS ? (
                                        <TableSortLabel
                                            active={sortConfig.column === col.accessor}
                                            direction={sortConfig.direction}
                                            onClick={() => handleSort(col.accessor)}
                                        >
                                            {col.header}
                                        </TableSortLabel>
                                    ) : (
                                        <Typography variant="overline" sx={{ fontWeight: 700 }}>{col.header}</Typography>
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>
                    </StyledTableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} align="center" sx={{ py: 4 }}>
                                    <Stack spacing={1} alignItems="center">
                                        <Typography variant="body2" color="text.secondary">Loading…</Typography>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} align="center" sx={{ py: 4 }}>
                                    <Stack spacing={1} alignItems="center">
                                        <Typography variant="body2" color="error">{error}</Typography>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ) : paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} align="center" sx={{ py: 6 }}>
                                    <Stack spacing={1} alignItems="center">
                                        <Typography variant="body1" color="text.secondary">{emptyMessage}</Typography>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((row, rowIndex) => (
                                <StyledTableRow
                                    key={getRowId(row)}
                                    hover
                                    onClick={() => handleRowClick(row)}
                                    selected={selectedRows.includes(getRowId(row))}
                                    sx={{
                                        '&:last-child td': { borderBottom: 'none' },
                                    }}
                                >
                                    {selectable && (
                                        <TableCell padding="checkbox">
                                            <FormControlLabel
                                                control={
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRows.includes(getRowId(row))}
                                                        onChange={handleSelectOne(getRowId(row))}
                                                    />
                                                }
                                                label=""
                                            />
                                        </TableCell>
                                    )}
                                    {columns.map((col) => (
                                        <StyledTableCell key={`${getRowId(row)}-${col.accessor || col.header}`} align={col.align}>
                                            {col.render
                                                ? col.render(row, rowIndex)
                                                : col.accessor
                                                    ? renderCell(row[col.accessor], col)
                                                    : null}
                                        </StyledTableCell>
                                    ))}
                                </StyledTableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </StyledTableContainer>

            {/* Pagination */}
            <Box sx={{ mt: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                    {processedData.length > 0
                        ? `Showing ${page * rowsPerPage + 1}–${Math.min((page + 1) * rowsPerPage, processedData.length)} of ${processedData.length}`
                        : 'No records to display'}
                </Typography>

                <TablePagination
                    component="div"
                    count={processedData.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handlePageChange}
                    onRowsPerPageChange={handleRowsPerPageChange}
                    rowsPerPageOptions={pageSizeOptions}
                    selectProps={{ size: 'small', variant: 'outlined' }}
                    ActionsComponent={({ page, count, ...props }) => (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton
                                onClick={() => props.onPageChange(page - 1)}
                                disabled={page === 0}
                                aria-label="Previous page"
                                size="small"
                            >
                                <ChevronLeftIcon />
                            </IconButton>
                            <Typography variant="body2" sx={{ minWidth: 60, textAlign: 'center' }}>
                                {page + 1} / {Math.ceil(count / rowsPerPage)}
                            </Typography>
                            <IconButton
                                onClick={() => props.onPageChange(page + 1)}
                                disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                                aria-label="Next page"
                                size="small"
                            >
                                <ChevronRightIcon />
                            </IconButton>
                        </Box>
                    )}
                />
            </Box>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                message={snackbar.message}
                severity={snackbar.severity}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </Box>
    );
}

/* ── Cell renderer ───────────────────────────────────────── */
function renderCell(value, column) {
    if (value === null || value === undefined || value === '') {
        return <Typography variant="body2" color="text.disabled">—</Typography>;
    }

    switch (column.type) {
        case COLUMN_TYPES.NUMBER:
            return <Typography variant="body2" sx={{ fontVariant: 'tabular-nums', fontWeight: 500 }}>{Number(value).toLocaleString()}</Typography>;
        case COLUMN_TYPES.DATE:
            return <Typography variant="body2">{new Date(value).toLocaleDateString()}</Typography>;
        case COLUMN_TYPES.BOOLEAN:
            return <Chip label={value ? 'Yes' : 'No'} size="small" color={value ? 'success' : 'default'} variant={value ? 'filled' : 'outlined'} />;
        case COLUMN_TYPES.CHIP:
            return <Chip label={value} size="small" variant="outlined" color={column.chipColor || 'primary'} />;
        default:
            return <Typography variant="body2">{String(value)}</Typography>;
    }
}

/* ── Column helpers ──────────────────────────────────────── */
export const columnTypes = COLUMN_TYPES;

export function createColumn({ accessor, header, type = COLUMN_TYPES.TEXT, ...rest }) {
    return { accessor, header, type, ...rest };
}

export function actionsColumn({ onEdit, onDelete, onView, onTransfer, onDuplicate, getRowId, editLabel = 'Edit', deleteLabel = 'Delete', viewLabel = 'View', transferLabel = 'Transfer', duplicateLabel = 'Duplicate' }) {
    return {
        accessor: '__actions__',
        header: '',
        type: COLUMN_TYPES.ACTIONS,
        align: 'center',
        width: 120,
        sortable: false,
        filterable: false,
        render: (row) => (
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                {onView && (
                    <Tooltip title={viewLabel}>
                        <ActionButton onClick={(e) => onView(row, e)} aria-label={viewLabel}>
                            <ViewIcon fontSize="small" />
                        </ActionButton>
                    </Tooltip>
                )}
                {onEdit && (
                    <Tooltip title={editLabel}>
                        <ActionButton onClick={(e) => onEdit(row, e)} aria-label={editLabel}>
                            <EditIcon fontSize="small" />
                        </ActionButton>
                    </Tooltip>
                )}
                {onDuplicate && (
                    <Tooltip title={duplicateLabel}>
                        <ActionButton onClick={(e) => onDuplicate(row, e)} aria-label={duplicateLabel}>
                            <DuplicateIcon fontSize="small" />
                        </ActionButton>
                    </Tooltip>
                )}
                {onTransfer && (
                    <Tooltip title={transferLabel}>
                        <ActionButton onClick={(e) => onTransfer(row, e)} aria-label={transferLabel} color="info">
                            <TransferIcon fontSize="small" />
                        </ActionButton>
                    </Tooltip>
                )}
                {onDelete && (
                    <Tooltip title={deleteLabel}>
                        <ActionButton onClick={(e) => onDelete(row, e)} aria-label={deleteLabel} color="error">
                            <DeleteIcon fontSize="small" />
                        </ActionButton>
                    </Tooltip>
                )}
            </Box>
        ),
    };
}

/* ── Filter components for specific types ────────────────── */
export function createSelectFilter(accessor, header, options, placeholder = 'All') {
    return {
        accessor,
        header,
        type: COLUMN_TYPES.TEXT,
        filterable: true,
        filterComponent: ({ value, onChange }) => (
            <FormControl size="small" variant="outlined" fullWidth sx={{ minWidth: 180 }}>
                <Select value={value} onChange={onChange} displayEmpty>
                    <MenuItem value="">{placeholder}</MenuItem>
                    {options.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        ),
    };
}

export function createDateFilter(accessor, header) {
    return {
        accessor,
        header,
        type: COLUMN_TYPES.DATE,
        filterable: true,
        filterComponent: ({ value, onChange }) => (
            <TextField
                type="date"
                fullWidth
                size="small"
                value={value || ''}
                onChange={(e) => onChange(e.target.value || '')}
                InputLabelProps={{ shrink: true }}
            />
        ),
    };
}

export default DataTable;