const router = require('express').Router();
const { body, param, query } = require('express-validator');

const { authenticate, authorize, ROLES, TEACHER_ROLES } = require('../middleware/auth');
const { authLimiter, validate, uploadSingle } = require('../middleware/security');

const auth = require('../controllers/auth.controller');
const users = require('../controllers/user.controller');
const years = require('../controllers/academicYear.controller');
const classes = require('../controllers/class.controller');
const subjects = require('../controllers/subject.controller');
const assignments = require('../controllers/assignment.controller');
const students = require('../controllers/student.controller');
const attendance = require('../controllers/attendance.controller');
const marksheets = require('../controllers/marksheet.controller');
const library = require('../controllers/library.controller');
const clinic = require('../controllers/clinic.controller');
const terms = require('../controllers/term.controller');
const planning = require('../controllers/planning.controller');
const calendar = require('../controllers/calendar.controller');
const timetable = require('../controllers/timetable.controller');
const notices = require('../controllers/notice.controller');
const threads = require('../controllers/thread.controller');
const tasks = require('../controllers/task.controller');
const dashboard = require('../controllers/dashboard.controller');
const datacenter = require('../controllers/datacenter.controller');
const store = require('../controllers/store.controller');

const uuid = (name, where = param) => where(name).isUUID().withMessage(`${name} must be a valid id`);

const STAFF = [ROLES.ADMIN, ...TEACHER_ROLES];
const TEACHING = [ROLES.ADMIN, ROLES.MAIN_TEACHER, ROLES.SUBJECT_TEACHER];
const PASTORAL = [ROLES.ADMIN, ROLES.MAIN_TEACHER, ROLES.ASSISTANT_TEACHER];

// =============================================================================
// AUTH  (login is the only unauthenticated endpoint)
// =============================================================================
router.post(
    '/auth/login',
    authLimiter,
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
    body('password').isString().notEmpty().withMessage('Password is required'),
    validate,
    auth.login
);

router.get('/auth/me', authenticate, auth.me);

router.patch(
    '/auth/password',
    authenticate,
    body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 10 }).withMessage('New password must be at least 10 characters'),
    validate,
    auth.changePassword
);

// =============================================================================
// STAFF ACCOUNTS  (admin only)
// =============================================================================
router.get('/users', authenticate, authorize(ROLES.ADMIN), users.listUsers);

router.post(
    '/users',
    authenticate,
    authorize(ROLES.ADMIN),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 10 }).withMessage('Password must be at least 10 characters'),
    body('role').isIn([ROLES.ADMIN, ...TEACHER_ROLES, ROLES.STORE_MANAGER]).withMessage('Invalid role'),
    validate,
    users.createUser
);

router.patch(
    '/users/:id',
    authenticate,
    authorize(ROLES.ADMIN),
    uuid('id'),
    body('role').optional().isIn([ROLES.ADMIN, ...TEACHER_ROLES, ROLES.STORE_MANAGER]),
    body('isActive').optional().isBoolean(),
    validate,
    users.updateUser
);

router.delete('/users/:id', authenticate, authorize(ROLES.ADMIN), uuid('id'), validate, users.deactivateUser);

// =============================================================================
// ACADEMIC YEARS
// =============================================================================
router.get('/academic-years', authenticate, years.listYears);

router.post(
    '/academic-years',
    authenticate,
    authorize(ROLES.ADMIN),
    body('name').trim().notEmpty().withMessage('Year name is required'),
    body('startsOn').isISO8601().withMessage('A start date is required'),
    body('endsOn').isISO8601().withMessage('An end date is required'),
    validate,
    years.createYear
);

router.post(
    '/academic-years/:id/set-current',
    authenticate,
    authorize(ROLES.ADMIN),
    uuid('id'),
    validate,
    years.setCurrentYear
);

// =============================================================================
// CLASSES
// =============================================================================
router.get('/classes', authenticate, classes.listClasses);
router.get('/classes/:id', authenticate, uuid('id'), validate, classes.getClass);

router.post(
    '/classes',
    authenticate,
    authorize(ROLES.ADMIN),
    body('name').trim().notEmpty().withMessage('Class name is required'),
    body('yearLevel').optional({ nullable: true }).isInt({ min: 0 }),
    body('capacity').optional({ nullable: true }).isInt({ min: 1 }),
    validate,
    classes.createClass
);

router.patch('/classes/:id', authenticate, authorize(ROLES.ADMIN), uuid('id'), validate, classes.updateClass);
router.delete('/classes/:id', authenticate, authorize(ROLES.ADMIN), uuid('id'), validate, classes.deleteClass);

// =============================================================================
// SUBJECTS (school-wide catalogue)
// =============================================================================
router.get('/subjects', authenticate, subjects.listSubjects);

router.post(
    '/subjects',
    authenticate,
    authorize(ROLES.ADMIN),
    body('name').trim().notEmpty().withMessage('Subject name is required'),
    body('code').trim().notEmpty().withMessage('Subject code is required'),
    body('taughtBy').optional().isIn(['subject_teacher', 'main_teacher']),
    body('isSemester').optional().isBoolean(),
    validate,
    subjects.createSubject
);

router.patch('/subjects/:id', authenticate, authorize(ROLES.ADMIN), uuid('id'), validate, subjects.updateSubject);
router.delete('/subjects/:id', authenticate, authorize(ROLES.ADMIN), uuid('id'), validate, subjects.deleteSubject);

// =============================================================================
// ASSIGNMENTS — class staffing and subject teaching
// =============================================================================
router.get('/assignments/class-staff', authenticate, assignments.listClassStaff);

router.put(
    '/assignments/class-staff',
    authenticate,
    authorize(ROLES.ADMIN),
    body('classId').isUUID(),
    body('userId').isUUID(),
    body('position').isIn(['main', 'assistant']).withMessage('Position must be main or assistant'),
    validate,
    assignments.assignClassStaff
);

router.post(
    '/assignments/rotate',
    authenticate,
    authorize(ROLES.ADMIN),
    body('classAId').isUUID(),
    body('classBId').isUUID(),
    body('position').isIn(['main', 'assistant']).withMessage('Position must be main or assistant'),
    validate,
    assignments.rotateClassStaff
);

router.delete(
    '/assignments/class-staff/:id',
    authenticate,
    authorize(ROLES.ADMIN),
    uuid('id'),
    validate,
    assignments.removeClassStaff
);

router.get('/assignments/subjects', authenticate, assignments.listSubjectAssignments);

router.put(
    '/assignments/subjects',
    authenticate,
    authorize(ROLES.ADMIN),
    body('classId').isUUID(),
    body('subjectId').isUUID(),
    body('teacherId').optional({ nullable: true }).isUUID(),
    body('sessionsPerWeek').optional().isInt({ min: 0 }),
    validate,
    assignments.upsertSubjectAssignment
);

router.post(
    '/assignments/subjects/bulk',
    authenticate,
    authorize(ROLES.ADMIN),
    body('subjectId').isUUID(),
    body('classIds').isArray({ min: 1 }).withMessage('Select at least one class'),
    body('classIds.*').isUUID(),
    body('teacherId').optional({ nullable: true }).isUUID(),
    validate,
    assignments.bulkAssignSubject
);

router.delete(
    '/assignments/subjects/:id',
    authenticate,
    authorize(ROLES.ADMIN),
    uuid('id'),
    validate,
    assignments.removeSubjectAssignment
);

router.post(
    '/assignments/auto-assign-main',
    authenticate,
    authorize(ROLES.ADMIN),
    body('sessionsPerWeek').optional().isInt({ min: 0 }),
    validate,
    assignments.autoAssignMainTeacherSubjects
);

router.get('/assignments/workload', authenticate, authorize(ROLES.ADMIN), assignments.getWorkload);

// =============================================================================
// STUDENTS
// =============================================================================
router.get('/students', authenticate, students.listStudents);
router.get('/students/unassigned', authenticate, students.listUnassigned);
router.get('/students/:id', authenticate, uuid('id'), validate, students.getStudent);

router.post(
    '/students/assign',
    authenticate,
    authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER),
    body('studentIds').isArray({ min: 1 }).withMessage('Select at least one student'),
    body('studentIds.*').isUUID(),
    body('classId').isUUID().withMessage('Choose a class'),
    validate,
    students.assignStudents
);

router.post(
    '/students',
    authenticate,
    authorize(...PASTORAL),
    body('admissionNo').trim().notEmpty().withMessage('Admission number is required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('classId').optional({ nullable: true }).isUUID(),
    body('rollNum').optional({ nullable: true }).isInt({ min: 1 }),
    body('gender').optional({ nullable: true }).isIn(['male', 'female', 'other']),
    body('guardianEmail').optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
    validate,
    students.createStudent
);

router.post(
    '/students/import',
    authenticate,
    authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER),
    uploadSingle,
    students.importStudents
);

router.patch(
    '/students/:id',
    authenticate,
    authorize(...PASTORAL),
    uuid('id'),
    body('guardianEmail').optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
    validate,
    students.updateStudent
);

router.post(
    '/students/:id/transfer',
    authenticate,
    authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER),
    uuid('id'),
    body('toClassId').isUUID().withMessage('A destination class is required'),
    validate,
    students.transferStudent
);

router.get('/students/:id/transfers', authenticate, uuid('id'), validate, students.getTransferHistory);

// =============================================================================
// ATTENDANCE
// =============================================================================
router.post(
    '/attendance',
    authenticate,
    authorize(...STAFF),
    body('classId').isUUID().withMessage('A class is required'),
    body('date').isISO8601().withMessage('A valid date is required'),
    body('subjectId').optional({ nullable: true }).isUUID(),
    body('records').isArray({ min: 1 }).withMessage('At least one attendance record is required'),
    body('records.*.studentId').isUUID(),
    body('records.*.status').isIn(['present', 'absent', 'late', 'excused']),
    validate,
    attendance.markAttendance
);

router.get(
    '/attendance',
    authenticate,
    query('classId').isUUID().withMessage('classId is required'),
    query('date').isISO8601().withMessage('date is required'),
    validate,
    attendance.getClassAttendance
);

router.get('/attendance/summary', authenticate, attendance.getAttendanceSummary);
router.get('/attendance/student/:studentId', authenticate, uuid('studentId'), validate, attendance.getStudentAttendance);

// =============================================================================
// MARKSHEETS
// =============================================================================
router.put(
    '/marksheets',
    authenticate,
    authorize(...TEACHING),
    body('studentId').isUUID(),
    body('subjectId').isUUID(),
    body('termId').optional().isUUID(),
    body('marks').isFloat({ min: 0 }).withMessage('Marks must be zero or greater'),
    body('maxMarks').optional().isFloat({ gt: 0 }),
    validate,
    marksheets.upsertMarksheet
);

router.get('/marksheets', authenticate, marksheets.listMarksheets);
router.get('/marksheets/student/:studentId', authenticate, uuid('studentId'), validate, marksheets.getStudentMarksheet);
router.delete('/marksheets/:id', authenticate, authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER), uuid('id'), validate, marksheets.deleteMarksheet);

// =============================================================================
// LIBRARY
// =============================================================================
router.get('/library/loans', authenticate, library.listLoans);
router.get('/library/summary', authenticate, library.getLibrarySummary);

router.post(
    '/library/loans',
    authenticate,
    authorize(...PASTORAL),
    body('studentId').isUUID(),
    body('bookTitle').trim().notEmpty().withMessage('Book title is required'),
    body('dueOn').isISO8601().withMessage('A due date is required'),
    validate,
    library.issueBook
);

router.post('/library/loans/:id/return', authenticate, authorize(...PASTORAL), uuid('id'), validate, library.returnBook);
router.post('/library/loans/:id/pay-fine', authenticate, authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER), uuid('id'), validate, library.payFine);

// =============================================================================
// CLINIC
// =============================================================================
router.get('/clinic/visits', authenticate, clinic.listVisits);
router.get('/clinic/summary', authenticate, clinic.getClinicSummary);

router.post(
    '/clinic/visits',
    authenticate,
    authorize(...PASTORAL),
    body('studentId').isUUID(),
    body('complaint').trim().notEmpty().withMessage('A complaint description is required'),
    body('incidentType').isIn([
        'illness', 'injury', 'accident', 'emergency',
        'routine_checkup', 'medication', 'first_aid', 'other',
    ]),
    body('severity').optional().isIn(['minor', 'moderate', 'severe', 'critical']),
    body('outcome').isIn(['returned_to_class', 'sent_home', 'referred_to_hospital', 'observation']),
    validate,
    clinic.recordVisit
);

router.post(
    '/clinic/visits/:id/leave',
    authenticate,
    authorize(ROLES.ADMIN),
    uuid('id'),
    body('decision').isIn(['approved', 'rejected']).withMessage('Decision must be approved or rejected'),
    validate,
    clinic.reviewLeaveRequest
);

// =============================================================================
// TERMS
// =============================================================================
router.get('/terms', authenticate, terms.listTerms);
router.get('/terms/current', authenticate, terms.getCurrentTerm);
router.get('/terms/:id/weeks', authenticate, uuid('id'), validate, terms.getTermWeeks);

router.post(
    '/terms',
    authenticate,
    authorize(ROLES.ADMIN),
    body('name').trim().notEmpty().withMessage('Term name is required'),
    body('termIndex').isInt({ min: 1, max: 6 }).withMessage('Term number must be 1-6'),
    body('startsOn').isISO8601().withMessage('A start date is required'),
    body('endsOn').isISO8601().withMessage('An end date is required'),
    body('academicYearId').optional().isUUID(),
    validate,
    terms.createTerm
);

router.patch('/terms/:id', authenticate, authorize(ROLES.ADMIN), uuid('id'), validate, terms.updateTerm);
router.post('/terms/:id/set-current', authenticate, authorize(ROLES.ADMIN), uuid('id'), validate, terms.setCurrentTerm);
router.delete('/terms/:id', authenticate, authorize(ROLES.ADMIN), uuid('id'), validate, terms.deleteTerm);

// =============================================================================
// PLANNING — schemes of work and lesson plans
//
// Teachers author their own; admins and main teachers review.
// =============================================================================
router.get('/planning/overview', authenticate, authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER), planning.getPlanningOverview);

router.get('/planning/schemes', authenticate, planning.listSchemes);
router.get('/planning/schemes/:id', authenticate, uuid('id'), validate, planning.getScheme);

router.post(
    '/planning/schemes',
    authenticate,
    authorize(...STAFF),
    body('classSubjectId').isUUID().withMessage('Choose a subject you teach'),
    body('title').trim().notEmpty().withMessage('A title is required'),
    body('termId').optional().isUUID(),
    validate,
    planning.createScheme
);

router.patch('/planning/schemes/:id', authenticate, uuid('id'), validate, planning.updateScheme);

router.put(
    '/planning/schemes/:id/weeks/:weekNumber',
    authenticate,
    uuid('id'),
    param('weekNumber').isInt({ min: 1 }).withMessage('Invalid week number'),
    validate,
    planning.updateSchemeWeek
);

router.get('/planning/lesson-plans', authenticate, planning.listLessonPlans);

router.put(
    '/planning/lesson-plans',
    authenticate,
    authorize(...STAFF),
    body('classSubjectId').isUUID().withMessage('Choose a subject you teach'),
    body('weekNumber').isInt({ min: 1 }).withMessage('A week number is required'),
    body('topic').trim().notEmpty().withMessage('A topic is required'),
    body('termId').optional().isUUID(),
    validate,
    planning.upsertLessonPlan
);

router.delete('/planning/lesson-plans/:id', authenticate, uuid('id'), validate, planning.deleteLessonPlan);

// Submit / review. :kind is 'schemes' or 'lesson-plans'.
router.post(
    '/planning/:kind/:id/submit',
    authenticate,
    param('kind').isIn(['schemes', 'lesson-plans']),
    uuid('id'),
    validate,
    planning.submitDocument
);

router.post(
    '/planning/:kind/:id/review',
    authenticate,
    authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER),
    param('kind').isIn(['schemes', 'lesson-plans']),
    uuid('id'),
    body('decision').isIn(['approved', 'changes_requested']).withMessage('Invalid decision'),
    validate,
    planning.reviewDocument
);

// =============================================================================
// CALENDAR
// =============================================================================
router.get('/calendar', authenticate, calendar.listEvents);
router.get('/calendar/upcoming', authenticate, calendar.getUpcoming);

router.post(
    '/calendar',
    authenticate,
    authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER),
    body('title').trim().notEmpty().withMessage('A title is required'),
    body('startsOn').isISO8601().withMessage('A start date is required'),
    body('endsOn').optional().isISO8601(),
    body('category').optional().isIn(['event', 'exam', 'meeting', 'holiday', 'trip', 'deadline', 'training']),
    body('audience').optional().isIn(['all', ...TEACHER_ROLES]),
    body('classId').optional({ nullable: true }).isUUID(),
    validate,
    calendar.createEvent
);

router.patch(
    '/calendar/:id',
    authenticate,
    authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER),
    uuid('id'),
    body('category').optional().isIn(['event', 'exam', 'meeting', 'holiday', 'trip', 'deadline', 'training']),
    validate,
    calendar.updateEvent
);

router.delete('/calendar/:id', authenticate, authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER), uuid('id'), validate, calendar.deleteEvent);

// =============================================================================
// TIMETABLE
//
// Reads are open to all staff; the controller narrows what each role sees.
// Only admins may edit the schedule.
// =============================================================================
router.get('/timetable', authenticate, timetable.getTimetable);
router.get('/timetable/my-week', authenticate, timetable.getMyWeek);

router.get(
    '/timetable/class/:classId/roster',
    authenticate,
    uuid('classId'),
    validate,
    timetable.getClassRoster
);

router.post(
    '/timetable',
    authenticate,
    authorize(ROLES.ADMIN),
    body('classSubjectId').isUUID().withMessage('Choose a subject assignment'),
    body('dayOfWeek').isInt({ min: 1, max: 7 }).withMessage('Day must be 1 (Mon) to 7 (Sun)'),
    body('startsAt').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Start time must be HH:MM'),
    body('endsAt').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('End time must be HH:MM'),
    validate,
    timetable.createSlot
);

router.patch(
    '/timetable/:id',
    authenticate,
    authorize(ROLES.ADMIN),
    uuid('id'),
    body('dayOfWeek').optional().isInt({ min: 1, max: 7 }),
    validate,
    timetable.updateSlot
);

router.delete('/timetable/:id', authenticate, authorize(ROLES.ADMIN), uuid('id'), validate, timetable.deleteSlot);

// =============================================================================
// STORE REQUESTS — class resource requisitions
//
// Teachers request items for their class; the store manager reviews first,
// then the admin gives the final approval. The approved form is printed and
// kept in the school's records.
// =============================================================================
router.get('/store/requests', authenticate, store.listRequests);
router.get('/store/requests/:id', authenticate, uuid('id'), validate, store.getRequest);

router.post(
    '/store/requests',
    authenticate,
    authorize(...STAFF, ROLES.STORE_MANAGER),
    body('classId').optional({ nullable: true }).isUUID(),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.item').trim().notEmpty().withMessage('Every item needs a name'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive number'),
    body('purpose').optional().trim(),
    validate,
    store.createRequest
);

router.patch(
    '/store/requests/:id',
    authenticate,
    uuid('id'),
    body('classId').optional({ nullable: true }).isUUID(),
    body('items').optional().isArray({ min: 1 }),
    body('items.*.item').optional().trim().notEmpty(),
    body('items.*.quantity').optional().isInt({ min: 1 }),
    body('purpose').optional().trim(),
    validate,
    store.updateRequest
);

router.delete('/store/requests/:id', authenticate, uuid('id'), validate, store.cancelRequest);

// Stage one — store manager (admin may stand in while there is no store account).
router.post(
    '/store/requests/:id/store-review',
    authenticate,
    authorize(ROLES.STORE_MANAGER, ROLES.ADMIN),
    uuid('id'),
    body('decision').isIn(['approved', 'rejected']).withMessage('Decision must be approved or rejected'),
    body('note').optional().trim(),
    validate,
    store.storeReview
);

// Stage two — admin only.
router.post(
    '/store/requests/:id/admin-review',
    authenticate,
    authorize(ROLES.ADMIN),
    uuid('id'),
    body('decision').isIn(['approved', 'rejected']).withMessage('Decision must be approved or rejected'),
    body('note').optional().trim(),
    validate,
    store.adminReview
);


// =============================================================================
// NOTICES
// =============================================================================
router.get('/notices', authenticate, notices.listNotices);

router.post(
    '/notices',
    authenticate,
    authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('body').trim().notEmpty().withMessage('Body is required'),
    body('audience').optional().isIn(['all', ...TEACHER_ROLES]),
    body('requiresAck').optional().isBoolean(),
    body('isPinned').optional().isBoolean(),
    validate,
    notices.createNotice
);

router.patch('/notices/:id', authenticate, authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER), uuid('id'), validate, notices.updateNotice);
router.post('/notices/:id/read', authenticate, uuid('id'), validate, notices.markRead);
router.get('/notices/:id/receipts', authenticate, authorize(ROLES.ADMIN), uuid('id'), validate, notices.getReceipts);
router.delete('/notices/:id', authenticate, authorize(ROLES.ADMIN), uuid('id'), validate, notices.deleteNotice);

// =============================================================================
// CONVERSATIONS
// =============================================================================
router.get('/threads', authenticate, threads.listThreads);
router.get('/threads/unread-count', authenticate, threads.getUnreadCount);
router.get('/threads/:id', authenticate, uuid('id'), validate, threads.getThread);

router.post(
    '/threads',
    authenticate,
    body('subject').trim().notEmpty().withMessage('A subject is required'),
    body('body').trim().notEmpty().withMessage('A message is required'),
    body('participantIds').isArray({ min: 1 }).withMessage('Choose at least one recipient'),
    body('participantIds.*').isUUID(),
    body('studentId').optional({ nullable: true }).isUUID(),
    body('classId').optional({ nullable: true }).isUUID(),
    body('category').optional().isIn(['general', 'student', 'class', 'academic', 'welfare', 'admin']),
    body('priority').optional().isIn(['low', 'normal', 'high']),
    validate,
    threads.createThread
);

router.post(
    '/threads/:id/messages',
    authenticate,
    uuid('id'),
    body('body').trim().notEmpty().withMessage('Message cannot be empty'),
    validate,
    threads.postMessage
);

router.patch(
    '/threads/:id',
    authenticate,
    uuid('id'),
    body('status').optional().isIn(['open', 'resolved']),
    body('priority').optional().isIn(['low', 'normal', 'high']),
    validate,
    threads.updateThread
);

// =============================================================================
// TASKS
// =============================================================================
router.get('/tasks', authenticate, tasks.listTasks);

router.post(
    '/tasks',
    authenticate,
    authorize(ROLES.ADMIN, ROLES.MAIN_TEACHER),
    body('title').trim().notEmpty().withMessage('A title is required'),
    body('assignedTo').isUUID().withMessage('Choose who the task is for'),
    body('dueOn').optional({ nullable: true }).isISO8601(),
    body('priority').optional().isIn(['low', 'normal', 'high']),
    body('classId').optional({ nullable: true }).isUUID(),
    body('studentId').optional({ nullable: true }).isUUID(),
    validate,
    tasks.createTask
);

router.patch(
    '/tasks/:id',
    authenticate,
    uuid('id'),
    body('status').optional().isIn(['pending', 'in_progress', 'done', 'cancelled']),
    body('priority').optional().isIn(['low', 'normal', 'high']),
    body('assignedTo').optional().isUUID(),
    validate,
    tasks.updateTask
);

router.delete('/tasks/:id', authenticate, uuid('id'), validate, tasks.deleteTask);

// =============================================================================
// DASHBOARD
// =============================================================================
router.get('/dashboard/summary', authenticate, authorize(ROLES.ADMIN), dashboard.getAdminSummary);
router.get('/dashboard/me', authenticate, dashboard.getMySummary);
router.get('/dashboard/data-flow', authenticate, dashboard.getDataFlow);

// =============================================================================
// PUBLIC DATA CENTER
// =============================================================================
router.get('/datacenter/stats', datacenter.getStats);

module.exports = router;
