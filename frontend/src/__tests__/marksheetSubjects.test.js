import { MAIN_TEACHER_MARKSHEET_CODES, marksheetSubjectsFor } from '../pages/Marksheets';

describe('marksheet subject options', () => {
    const assignments = [
        { teacherId: 'main-1', subject: { id: 'mat', code: 'MAT', name: 'Mathematics' } },
        { teacherId: 'main-1', subject: { id: 'sci', code: 'SCI', name: 'Science' } },
        { teacherId: 'main-1', subject: { id: 'gls', code: 'GLS', name: 'Global Citizenship' } },
        { teacherId: 'main-1', subject: { id: 'spl', code: 'SPL', name: 'Spelling' } },
        { teacherId: 'main-1', subject: { id: 'eng', code: 'ENG', name: 'English' } },
        { teacherId: 'subject-1', subject: { id: 'amh', code: 'AMH', name: 'Amharic' } },
    ];

    test('main teachers see only Mathematics, Science and Global Citizenship', () => {
        const options = marksheetSubjectsFor(assignments, {
            user: { id: 'main-1', role: 'main_teacher' },
        });

        expect([...MAIN_TEACHER_MARKSHEET_CODES]).toEqual(['MAT', 'SCI', 'GLS']);
        expect(options.map((subject) => subject.code)).toEqual(['GLS', 'MAT', 'SCI']);
        expect(options.map((subject) => subject.name)).not.toContain('Spelling');
        expect(options.map((subject) => subject.name)).not.toContain('English');
    });

    test('subject teachers see only their own assigned subjects', () => {
        const options = marksheetSubjectsFor(assignments, {
            user: { id: 'subject-1', role: 'subject_teacher' },
        });

        expect(options.map((subject) => subject.code)).toEqual(['AMH']);
    });

    test('admins see all class subjects', () => {
        const options = marksheetSubjectsFor(assignments, {
            user: { id: 'admin', role: 'admin' },
            isAdmin: true,
        });

        expect(options.map((subject) => subject.code)).toEqual(['AMH', 'GLS', 'MAT', 'SCI', 'SPL', 'ENG'].sort());
    });
});
