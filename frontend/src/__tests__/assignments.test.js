import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Assignments from '../pages/Assignments';
import { assignmentApi, classApi, subjectApi, userApi, studentApi } from '../api/endpoints';

jest.mock('../api/endpoints', () => ({
    assignmentApi: {
        workload: jest.fn(),
        subjects: jest.fn(),
        assignStaff: jest.fn(),
        rotate: jest.fn(),
        bulkAssignSubject: jest.fn(),
        autoAssignMain: jest.fn(),
    },
    classApi: { list: jest.fn() },
    subjectApi: { list: jest.fn() },
    userApi: { list: jest.fn() },
    studentApi: {
        unassigned: jest.fn(),
        assign: jest.fn(),
    },
}));

const renderPage = () =>
    render(
        <ThemeProvider>
            <BrowserRouter>
                <Assignments />
            </BrowserRouter>
        </ThemeProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    classApi.list.mockResolvedValue([{ id: 'c1', name: 'Year 3 - Blue' }]);
    subjectApi.list.mockResolvedValue([
        { id: 's1', name: 'English', code: 'ENG', taughtBy: 'subject_teacher', isSemester: false, assignmentCount: 1 },
        { id: 's2', name: 'Registration', code: 'REG', taughtBy: 'main_teacher', isSemester: false, assignmentCount: 12 },
    ]);
    userApi.list.mockResolvedValue([]);
    assignmentApi.workload.mockResolvedValue({ academicYearId: 'y1', teachers: [], gaps: [], unassignedSubjects: 0 });
    assignmentApi.subjects.mockResolvedValue({ academicYearId: 'y1', assignments: [] });
    studentApi.unassigned.mockResolvedValue([]);
});

describe('Assignments page', () => {
    test('the assign-subject dialog never offers the registration fixture', async () => {
        renderPage();

        fireEvent.click(await screen.findByRole('button', { name: /assign subject across classes/i }));

        const dialog = await screen.findByRole('dialog');
        fireEvent.mouseDown(within(dialog).getByLabelText(/^Subject/));

        const listbox = await screen.findByRole('listbox');
        expect(within(listbox).getByText('English')).toBeInTheDocument();
        expect(within(listbox).queryByText('Registration')).not.toBeInTheDocument();
    });

    test('no registration seat appears in the assignment table', async () => {
        assignmentApi.subjects.mockResolvedValue({
            academicYearId: 'y1',
            assignments: [{
                id: 'a1', classId: 'c1', subjectId: 's1', teacherId: 't1', sessionsPerWeek: 4,
                class: { id: 'c1', name: 'Year 3 - Blue' },
                subject: { id: 's1', name: 'English', code: 'ENG' },
                teacher: { id: 't1', name: 'Ms. Meron', email: 'meron@school.et' },
            }],
        });

        renderPage();

        expect(await screen.findByText('English')).toBeInTheDocument();
        expect(screen.queryByText('Registration')).not.toBeInTheDocument();
    });
});
