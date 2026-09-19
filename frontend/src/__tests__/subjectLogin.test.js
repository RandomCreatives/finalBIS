import { groupTeachers, subjectOf } from '../pages/SubjectLogin';

describe('subjectOf', () => {
    test('strips the "Teacher N" suffix', () => {
        expect(subjectOf('English Teacher 1')).toBe('English');
        expect(subjectOf('Amharic Teacher 2')).toBe('Amharic');
        expect(subjectOf('Physical Education Teacher 1')).toBe('Physical Education');
        expect(subjectOf('ICT Teacher 1')).toBe('ICT');
        expect(subjectOf('French Teacher 1')).toBe('French');
    });

    test('leaves real names alone', () => {
        expect(subjectOf('Meron Abebe')).toBe('Meron Abebe');
    });
});

describe('groupTeachers', () => {
    test('groups by subject, sorted, numeric order within a subject', () => {
        const teachers = [
            { id: '4', name: 'English Teacher 3' },
            { id: '1', name: 'Amharic Teacher 1' },
            { id: '3', name: 'English Teacher 2' },
            { id: '2', name: 'English Teacher 1' },
            { id: '5', name: 'Amharic Teacher 2' },
        ];
        const groups = groupTeachers(teachers);
        expect(groups.map((g) => g.subject)).toEqual(['Amharic', 'English']);
        expect(groups[0].teachers.map((t) => t.name)).toEqual(['Amharic Teacher 1', 'Amharic Teacher 2']);
        expect(groups[1].teachers.map((t) => t.name)).toEqual(
            ['English Teacher 1', 'English Teacher 2', 'English Teacher 3']
        );
    });
});
