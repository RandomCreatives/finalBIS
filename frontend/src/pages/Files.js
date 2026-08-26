import { useState, useEffect, useCallback } from 'react';
import {
    Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, MenuItem, Alert, Chip, Stack,
    LinearProgress, InputAdornment, Tooltip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageIcon from '@mui/icons-material/Image';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import FolderIcon from '@mui/icons-material/Folder';
import SearchIcon from '@mui/icons-material/Search';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { filesApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

const CATEGORIES = [
    { value: 'academic', label: 'Academic' },
    { value: 'administrative', label: 'Administrative' },
    { value: 'student', label: 'Student' },
    { value: 'staff', label: 'Staff' },
    { value: 'other', label: 'Other' },
];

const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mimeType) => {
    if (!mimeType) return <InsertDriveFileIcon />;
    if (mimeType.startsWith('image/')) return <ImageIcon color="primary" />;
    if (mimeType.startsWith('video/')) return <VideoFileIcon color="error" />;
    if (mimeType.startsWith('audio/')) return <AudioFileIcon color="success" />;
    if (mimeType.includes('pdf')) return <DescriptionIcon color="error" />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <DescriptionIcon color="primary" />;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <DescriptionIcon color="success" />;
    return <InsertDriveFileIcon />;
};

export default function Files() {
    const { isAdmin } = useAuth();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadCategory, setUploadCategory] = useState('other');
    const [uploadDescription, setUploadDescription] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const fetchFiles = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = {};
            if (categoryFilter) params.category = categoryFilter;
            if (search) params.search = search;
            const data = await filesApi.list(params);
            setFiles(data);
        } catch (err) {
            setError(err.message || 'Failed to load files');
        } finally {
            setLoading(false);
        }
    }, [categoryFilter, search]);

    useEffect(() => { fetchFiles(); }, [fetchFiles]);

    const handleUpload = async () => {
        if (!uploadFile) return;
        setUploading(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('category', uploadCategory);
            if (uploadDescription) formData.append('description', uploadDescription);
            await filesApi.upload(formData);
            setUploadOpen(false);
            setUploadFile(null);
            setUploadCategory('other');
            setUploadDescription('');
            fetchFiles();
        } catch (err) {
            setError(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (file) => {
        try {
            const { url, name } = await filesApi.download(file.id);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            setError(err.message || 'Download failed');
        }
    };

    const handleDelete = async (file) => {
        try {
            await filesApi.remove(file.id);
            setDeleteConfirm(null);
            fetchFiles();
        } catch (err) {
            setError(err.message || 'Delete failed');
        }
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 1 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <FolderIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography variant="h4" component="h1">Files</Typography>
                </Stack>
                <Button
                    variant="contained"
                    startIcon={<CloudUploadIcon />}
                    onClick={() => setUploadOpen(true)}
                >
                    Upload File
                </Button>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent sx={{ py: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField
                            size="small"
                            placeholder="Search files..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                            }}
                            sx={{ minWidth: 250 }}
                        />
                        <TextField
                            size="small"
                            select
                            label="Category"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            sx={{ minWidth: 180 }}
                        >
                            <MenuItem value="">All Categories</MenuItem>
                            {CATEGORIES.map((c) => (
                                <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                            ))}
                        </TextField>
                    </Stack>
                </CardContent>
            </Card>

            {/* File List */}
            <Card>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Category</TableCell>
                                <TableCell>Size</TableCell>
                                <TableCell>Uploaded by</TableCell>
                                <TableCell>Date</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                        <LinearProgress />
                                    </TableCell>
                                </TableRow>
                            ) : files.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                                        No files found. Upload your first file to get started.
                                    </TableCell>
                                </TableRow>
                            ) : files.map((file) => (
                                <TableRow key={file.id} hover>
                                    <TableCell>
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            {getFileIcon(file.mimeType)}
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {file.name}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={file.category}
                                            size="small"
                                            variant="outlined"
                                            color={file.category === 'academic' ? 'primary' : 'default'}
                                        />
                                    </TableCell>
                                    <TableCell>{formatSize(file.sizeBytes)}</TableCell>
                                    <TableCell>{file.uploadedBy?.name || '—'}</TableCell>
                                    <TableCell>{new Date(file.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Download">
                                            <IconButton size="small" onClick={() => handleDownload(file)}>
                                                <DownloadIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        {isAdmin && (
                                            <Tooltip title="Delete">
                                                <IconButton size="small" color="error" onClick={() => setDeleteConfirm(file)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>

            {/* Upload Dialog */}
            <Dialog open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Upload File</DialogTitle>
                <DialogContent>
                    <Stack spacing={2.5} sx={{ mt: 1 }}>
                        <Button
                            variant="outlined"
                            component="label"
                            startIcon={<CloudUploadIcon />}
                            fullWidth
                            sx={{ py: 2 }}
                        >
                            {uploadFile ? uploadFile.name : 'Choose file (max 20 MB)'}
                            <input
                                type="file"
                                hidden
                                onChange={(e) => setUploadFile(e.target.files[0])}
                            />
                        </Button>
                        <TextField
                            select
                            label="Category"
                            value={uploadCategory}
                            onChange={(e) => setUploadCategory(e.target.value)}
                            fullWidth
                        >
                            {CATEGORIES.map((c) => (
                                <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Description (optional)"
                            value={uploadDescription}
                            onChange={(e) => setUploadDescription(e.target.value)}
                            fullWidth
                            multiline
                            rows={2}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUploadOpen(false)} disabled={uploading}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleUpload}
                        disabled={!uploadFile || uploading}
                        startIcon={uploading ? undefined : <CloudUploadIcon />}
                    >
                        {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
                <DialogTitle>Delete File?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete "{deleteConfirm?.name}"? This cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => handleDelete(deleteConfirm)}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
