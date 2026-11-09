import { MAIN_TEACHER_MARKSHEET_CODES, marksheetSubjectsFor } from '../pages/Marksheets';
import { mainTeacherMarksheetSubjectsFor } from '../utils/marksheetSubjects';

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

        expect([...MAIN_TEACHER_MARKSHEET_CODES].sort()).toEqual(['GCT', 'GLS', 'MAT', 'SCI']);
        expect(options.map((subject) => subject.code)).toEqual(['GLS', 'MAT', 'SCI']);
        expect(options.map((subject) => subject.name)).not.toContain('Spelling');
        expect(options.map((subject) => subject.name)).not.toContain('English');
    });

    test('the main teacher sees homeroom subjects after a handover even if assignment owners are stale', () => {
        const handedOverAssignments = assignments.map((assignment) => ({
            ...assignment,
            teacherId: 'previous-teacher',
        }));
        const user = { id: 'main-1', role: 'main_teacher' };

        expect(mainTeacherMarksheetSubjectsFor(handedOverAssignments)
            .map((subject) => subject.code)).toEqual(['GLS', 'MAT', 'SCI']);
        expect(marksheetSubjectsFor(handedOverAssignments, {
            user,
            isMainTeacherOfClass: true,
        }).map((subject) => subject.code)).toEqual(['GLS', 'MAT', 'SCI']);

        // The broader homeroom rule must not expose someone else's stale seat
        // when the logged-in teacher is not the class's main teacher.
        expect(marksheetSubjectsFor(handedOverAssignments, {
            user,
            isMainTeacherOfClass: false,
        })).toEqual([]);
    });

    test('main teachers can see Global Citizenship when their assignment uses legacy code GCT', () => {
        const legacyAssignment = [{
            teacherId: 'main-1',
            subject: { id: 'gct', code: 'GCT', name: 'Global Citizenship' },
        }];

        expect(marksheetSubjectsFor(legacyAssignment, {
            user: { id: 'main-1', role: 'main_teacher' },
        }).map((subject) => subject.code)).toEqual(['GCT']);
        expect(mainTeacherMarksheetSubjectsFor(legacyAssignment)
            .map((subject) => subject.code)).toEqual(['GCT']);
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
