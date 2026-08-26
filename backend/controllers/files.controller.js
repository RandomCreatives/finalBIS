const supabase = require('../config/supabase');
const { getDrive, isConfigured, getFolderId } = require('../config/google-drive');
const { NotFoundError, BadRequestError, ForbiddenError, asyncHandler } = require('../utils/errors');

/**
 * Files — Google Drive integration with Supabase metadata.
 *
 * Files are stored on Google Drive, organized by school and category.
 * Metadata (name, size, type, who uploaded it) is tracked in Supabase
 * so we can query, search, and control access without hitting Drive's API.
 *
 * Categories: academic, administrative, student, staff, other
 */

const SELECT = `
    id, school_id, google_drive_id, name, mime_type, size_bytes,
    category, description, uploaded_by, created_at,
    uploader:users!uploaded_by(id, name)
`;

const shape = (f) => ({
    id: f.id,
    googleDriveId: f.google_drive_id,
    name: f.name,
    mimeType: f.mime_type,
    sizeBytes: f.size_bytes,
    category: f.category,
    description: f.description,
    uploadedBy: f.uploader,
    createdAt: f.created_at,
});

/** GET /api/files?category=&search= */
const listFiles = asyncHandler(async (req, res) => {
    const { category, search } = req.query;

    let query = supabase
        .from('file_records')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (search) {
        const safe = search.replace(/[%_\\]/g, '\\$&');
        query = query.ilike('name', `%${safe}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ files: (data || []).map(shape) });
});

/** GET /api/files/:id */
const getFile = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('file_records')
        .select(SELECT)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('File not found');

    res.json({ file: shape(data) });
});

/** POST /api/files/upload — multipart form upload */
const uploadFile = asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('No file uploaded');

    const drive = getDrive();
    if (!drive) throw new BadRequestError('Google Drive is not configured. Contact your administrator.');

    const folderId = getFolderId();
    const category = req.body.category || 'other';
    const description = req.body.description || null;
    const schoolId = req.user.school_id;

    // Create a school subfolder if needed
    const schoolFolderName = `school-${schoolId}`;
    const schoolFolderId = await getOrCreateSubfolder(drive, folderId, schoolFolderName);

    // Create a category subfolder within the school folder
    const categoryFolderId = await getOrCreateSubfolder(drive, schoolFolderId, category);

    // Upload file to Google Drive
    const fileMetadata = {
        name: req.file.originalname,
        parents: [categoryFolderId],
    };

    const { data: driveFile, error: driveError } = await drive.files.create({
        resource: fileMetadata,
        media: {
            mimeType: req.file.mimetype,
            body: require('stream').Readable.from(req.file.buffer),
        },
        fields: 'id, name, mimeType, size',
    });

    if (driveError) {
        console.error('[files] Drive upload error:', driveError);
        throw new BadRequestError('Failed to upload file to Google Drive');
    }

    // Store metadata in Supabase
    const { data: record, error: dbError } = await supabase
        .from('file_records')
        .insert({
            school_id: schoolId,
            google_drive_id: driveFile.id,
            name: req.file.originalname,
            mime_type: driveFile.mimeType,
            size_bytes: Number(driveFile.size),
            category,
            description,
            uploaded_by: req.user.id,
        })
        .select(SELECT)
        .single();

    if (dbError) throw dbError;

    res.status(201).json({ file: shape(record) });
});

/** GET /api/files/:id/download — get a temporary download URL */
const downloadFile = asyncHandler(async (req, res) => {
    const drive = getDrive();
    if (!drive) throw new BadRequestError('Google Drive is not configured');

    const { data: record, error } = await supabase
        .from('file_records')
        .select('google_drive_id, name, school_id')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (error) throw error;
    if (!record) throw new NotFoundError('File not found');

    // Generate a temporary download URL
    const { data: permission } = await drive.files.get({
        fileId: record.google_drive_id,
        fields: 'webContentLink',
        supportsAllDrives: true,
    });

    // Create a direct download link
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${record.google_drive_id}`;

    res.json({ url: downloadUrl, name: record.name });
});

/** DELETE /api/files/:id */
const deleteFile = asyncHandler(async (req, res) => {
    if (!['admin', 'store_manager'].includes(req.user.role)) {
        throw new ForbiddenError('Only admins can delete files');
    }

    const drive = getDrive();
    if (!drive) throw new BadRequestError('Google Drive is not configured');

    const { data: record, error } = await supabase
        .from('file_records')
        .select('google_drive_id, school_id')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (error) throw error;
    if (!record) throw new NotFoundError('File not found');

    // Delete from Google Drive
    await drive.files.delete({
        fileId: record.google_drive_id,
        supportsAllDrives: true,
    });

    // Delete metadata from Supabase
    const { error: deleteError } = await supabase
        .from('file_records')
        .delete()
        .eq('id', req.params.id);

    if (deleteError) throw deleteError;

    res.json({ message: 'File deleted' });
});

/** Helper: get or create a subfolder within a parent folder */
async function getOrCreateSubfolder(drive, parentId, folderName) {
    // Search for existing folder
    const { files } = await drive.files.list({
        q: `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });

    if (files && files.length > 0) {
        return files[0].id;
    }

    // Create the folder
    const { data } = await drive.files.create({
        resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        fields: 'id',
        supportsAllDrives: true,
    });

    return data.id;
}

module.exports = { listFiles, getFile, uploadFile, downloadFile, deleteFile, isConfigured };
