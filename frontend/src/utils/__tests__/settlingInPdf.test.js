import html2pdf from 'html2pdf.js';
import JSZip from 'jszip';
import {
    createSettlingInPdf,
    createSettlingInPdfZip,
    safeFileSegment,
    settlingInClassZipFilename,
    settlingInStudentPdfFilename,
} from '../settlingInPdf';

jest.mock('html2pdf.js', () => jest.fn());
jest.mock('jszip', () => jest.fn());

describe('Settling In PDF exports', () => {
    let pdfBlob;
    let zipBlob;
    let worker;
    let zip;

    beforeEach(() => {
        jest.clearAllMocks();
        pdfBlob = new Blob(['student-pdf'], { type: 'application/pdf' });
        zipBlob = new Blob(['class-zip'], { type: 'application/zip' });
        worker = {
            set: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            outputPdf: jest.fn().mockResolvedValue(pdfBlob),
        };
        zip = {
            file: jest.fn(),
            generateAsync: jest.fn().mockImplementation(async (_options, onUpdate) => {
                onUpdate?.({ percent: 100 });
                return zipBlob;
            }),
        };
        html2pdf.mockReturnValue(worker);
        JSZip.mockImplementation(() => zip);
    });

    test('renders one student booklet as a two-sided A4 landscape PDF', async () => {
        const element = document.createElement('div');

        await expect(createSettlingInPdf(element)).resolves.toBe(pdfBlob);

        expect(html2pdf).toHaveBeenCalledTimes(1);
        expect(worker.set).toHaveBeenCalledWith(expect.objectContaining({
            margin: [4, 4, 4, 4],
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak: { mode: ['css', 'legacy'], before: ['.settling-in-pdf-inside'] },
        }));
        expect(worker.from).toHaveBeenCalledWith(element);
        expect(worker.outputPdf).toHaveBeenCalledWith('blob');
    });

    test('puts a separate PDF for every student into the ZIP and reports progress', async () => {
        const entries = [
            { element: document.createElement('div'), filename: 'Year-3_Abel.pdf' },
            { element: document.createElement('div'), filename: 'Year-3_Bethlehem.pdf' },
        ];
        const progress = jest.fn();

        await expect(createSettlingInPdfZip(entries, progress)).resolves.toBe(zipBlob);

        expect(html2pdf).toHaveBeenCalledTimes(2);
        expect(zip.file).toHaveBeenNthCalledWith(1, entries[0].filename, pdfBlob);
        expect(zip.file).toHaveBeenNthCalledWith(2, entries[1].filename, pdfBlob);
        expect(zip.generateAsync).toHaveBeenCalledWith(
            { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
            expect.any(Function),
        );
        expect(progress).toHaveBeenNthCalledWith(1, 1, 2, 'pdfs');
        expect(progress).toHaveBeenNthCalledWith(2, 2, 2, 'pdfs');
        expect(progress).toHaveBeenLastCalledWith(2, 2, 'archive', 100);
    });

    test('keeps same-named students as separate ZIP files', async () => {
        const entries = [
            { element: document.createElement('div'), filename: 'Settling-In_Student.pdf' },
            { element: document.createElement('div'), filename: 'Settling-In_Student.pdf' },
        ];

        await createSettlingInPdfZip(entries);

        expect(zip.file).toHaveBeenNthCalledWith(1, 'Settling-In_Student.pdf', pdfBlob);
        expect(zip.file).toHaveBeenNthCalledWith(2, 'Settling-In_Student-2.pdf', pdfBlob);
    });

    test('uses readable, distinct filenames and rejects missing export input', async () => {
        expect(safeFileSegment('Year 3 / Blue')).toBe('Year-3-Blue');
        expect(settlingInStudentPdfFilename({
            name: 'Béthlehem Adera',
            admissionNo: 'BIS-302',
            rollNum: 2,
        }, {
            className: 'Year 3 - Blue',
            termName: 'Term 1',
            yearName: '2026-27',
        })).toBe('Settling-In_Year-3-Blue_Term-1_2026-27_Roll-2_BIS-302_Bethlehem-Adera.pdf');
        expect(settlingInClassZipFilename({
            className: 'Year 3 - Blue',
            termName: 'Term 1',
            yearName: '2026-27',
        })).toBe('Settling-In_Year-3-Blue_Term-1_2026-27_Student-PDFs.zip');

        await expect(createSettlingInPdf(null)).rejects.toThrow('not ready to export');
        await expect(createSettlingInPdfZip([])).rejects.toThrow('no student reports');
    });
});
