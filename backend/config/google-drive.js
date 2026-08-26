const { google } = require('googleapis');
const env = require('./env');

/**
 * Google Drive client setup.
 *
 * Uses a Service Account with a shared folder. The school admin shares a
 * Google Drive folder with the service account email, then sets
 * GOOGLE_DRIVE_FOLDER_ID to that folder's ID. Files are organized by
 * school_id and category.
 *
 * Setup:
 *   1. Create a Google Cloud project and enable the Drive API
 *   2. Create a Service Account and download the JSON key
 *   3. Set GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY to the JSON string (or file path)
 *   4. Share your Drive folder with the service account's email
 *   5. Set GOOGLE_DRIVE_FOLDER_ID to the folder ID
 */

let driveClient = null;

const getDrive = () => {
    if (driveClient) return driveClient;

    const keyJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!keyJson || !folderId) {
        return null; // Google Drive not configured
    }

    try {
        let credentials;
        if (keyJson.startsWith('{')) {
            credentials = JSON.parse(keyJson);
        } else {
            // Treat as file path
            const fs = require('fs');
            credentials = JSON.parse(fs.readFileSync(keyJson, 'utf-8'));
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive'],
        });

        driveClient = google.drive({ version: 'v3', auth });
        return driveClient;
    } catch (err) {
        console.error('[google-drive] Failed to initialize:', err.message);
        return null;
    }
};

const isConfigured = () => {
    return Boolean(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_DRIVE_FOLDER_ID);
};

const getFolderId = () => process.env.GOOGLE_DRIVE_FOLDER_ID || null;

module.exports = { getDrive, isConfigured, getFolderId };
