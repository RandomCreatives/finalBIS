import html2pdf from 'html2pdf.js';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

const PDF_MARGIN_MM = 4;
const PDF_CONTENT_WIDTH_MM = 289;
const PDF_CONTENT_HEIGHT_MM = 202;
const PDF_PAGE_OPTIONS = { unit: 'mm', format: 'a4', orientation: 'landscape' };
const PDF_OPTIONS = {
    margin: [PDF_MARGIN_MM, PDF_MARGIN_MM, PDF_MARGIN_MM, PDF_MARGIN_MM],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
    },
    jsPDF: PDF_PAGE_OPTIONS,
    // Export each booklet side as its own image and add it to the PDF explicitly.
    // Avoid html2pdf's automatic page-break padding, which can create blank pages.
    pagebreak: { mode: [] },
};

export const safeFileSegment = (value) => String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^A-Za-z0-9\u1200-\u137F_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'Report';

const studentIdentitySegments = (student = {}) => [
    student.rollNum !== null && student.rollNum !== undefined && String(student.rollNum).trim()
        ? `Roll-${student.rollNum}`
        : '',
    student.admissionNo,
    student.name,
].filter((value) => value !== null && value !== undefined && String(value).trim())
    .map(safeFileSegment);

const reportFilenameSegments = ({ className, termName, yearName } = {}) => [
    'Settling-In',
    className,
    termName,
    yearName,
].filter((value) => value !== null && value !== undefined && String(value).trim())
    .map(safeFileSegment);

export const settlingInStudentPdfFilename = (student, reportDetails) => [
    ...reportFilenameSegments(reportDetails),
    ...studentIdentitySegments(student),
].join('_') + '.pdf';

export const settlingInClassZipFilename = (reportDetails) => [
    ...reportFilenameSegments(reportDetails),
    'Student-PDFs',
].join('_') + '.zip';

export const createSettlingInPdf = async (element) => {
    if (!element) throw new Error('The Settling In report is not ready to export.');
    const sides = ['outside', 'inside'].map((side) => element.querySelector(`.settling-in-pdf-${side}`));
    if (sides.some((side) => !side)) {
        throw new Error('Both booklet sides are required to export the Settling In PDF.');
    }

    const canvas = await html2pdf()
        .set(PDF_OPTIONS)
        .from(element)
        .toCanvas()
        .get('canvas');
    if (!canvas?.width || !canvas?.height) {
        throw new Error('Could not render the Settling In booklet.');
    }

    const pdf = new jsPDF(PDF_PAGE_OPTIONS);
    for (let pageIndex = 0; pageIndex < sides.length; pageIndex += 1) {
        if (pageIndex > 0) pdf.addPage('a4', 'landscape');
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.ceil(canvas.height / sides.length);
        const context = pageCanvas.getContext('2d');
        if (!context) throw new Error('Could not prepare the Settling In PDF page.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        const sourceY = pageIndex * pageCanvas.height;
        const sourceHeight = Math.min(pageCanvas.height, canvas.height - sourceY);
        if (sourceHeight > 0) {
            context.drawImage(
                canvas,
                0,
                sourceY,
                canvas.width,
                sourceHeight,
                0,
                0,
                pageCanvas.width,
                sourceHeight,
            );
        }
        const pageImage = pageCanvas.toDataURL(`image/${PDF_OPTIONS.image.type}`, PDF_OPTIONS.image.quality);
        pdf.addImage(
            pageImage,
            'JPEG',
            PDF_MARGIN_MM,
            PDF_MARGIN_MM,
            PDF_CONTENT_WIDTH_MM,
            PDF_CONTENT_HEIGHT_MM,
        );
        pageCanvas.width = 0;
        pageCanvas.height = 0;
    }
    canvas.width = 0;
    canvas.height = 0;

    return pdf.output('blob');
};

const uniqueArchiveFilename = (filename, usedFilenames) => {
    const extensionIndex = filename.lastIndexOf('.');
    const basename = extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;
    const extension = extensionIndex > 0 ? filename.slice(extensionIndex) : '';
    let candidate = filename;
    let suffix = 2;
    while (usedFilenames.has(candidate.toLocaleLowerCase())) {
        candidate = `${basename}-${suffix}${extension}`;
        suffix += 1;
    }
    usedFilenames.add(candidate.toLocaleLowerCase());
    return candidate;
};

export const createSettlingInPdfZip = async (entries, onProgress) => {
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error('There are no student reports to export.');
    }

    const zip = new JSZip();
    const usedFilenames = new Set();
    for (let index = 0; index < entries.length; index += 1) {
        const { element, filename } = entries[index];
        if (!element) throw new Error(`A Settling In report is missing for student ${index + 1}.`);
        if (!filename) throw new Error(`A PDF filename is missing for student ${index + 1}.`);
        const pdf = await createSettlingInPdf(element);
        zip.file(uniqueArchiveFilename(filename, usedFilenames), pdf);
        onProgress?.(index + 1, entries.length, 'pdfs');
    }

    return zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        ({ percent }) => onProgress?.(entries.length, entries.length, 'archive', percent),
    );
};

export const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
