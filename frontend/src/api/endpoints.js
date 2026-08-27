import client from './client';

/** Thin, typed-ish wrappers around the API. Keeps axios out of components. */

export const authApi = {
    login: (email, password) => client.post('/auth/login', { email, password }).then((r) => r.data),
    me: () => client.get('/auth/me').then((r) => r.data.user),
    changePassword: (currentPassword, newPassword) =>
        client.patch('/auth/password', { currentPassword, newPassword }).then((r) => r.data),
    updateProfile: (name) =>
        client.patch('/auth/profile', { name }).then((r) => r.data),
    sendVerificationCode: (email) =>
        client.post('/auth/send-verification-code', { email }).then((r) => r.data),
    verifyCode: (code) =>
        client.post('/auth/verify-code', { code }).then((r) => r.data),
    gmailRequest: (email) =>
        client.post('/auth/gmail/request', { email }).then((r) => r.data),
    gmailVerify: (email, code) =>
        client.post('/auth/gmail/verify', { email, code }).then((r) => r.data),
        telegramRequestCode: (identifier) =>
        client.post('/auth/telegram/request-code', { identifier }).then((r) => r.data),
    telegramVerifyCode: (identifier, code) =>
        client.post('/auth/telegram/verify-code', { identifier, code }).then((r) => r.data),
    telegramLogin: (payload) =>
        client.post('/auth/telegram', payload).then((r) => r.data),
    telegramConfig: () => client.get('/auth/telegram-config').then((r) => r.data),
    linkTelegram: (payload) =>
        client.post('/auth/link-telegram', payload).then((r) => r.data),
    unlinkTelegram: () => client.delete('/auth/link-telegram').then((r) => r.data),
};

export const dashboardApi = {
    summary: () => client.get('/dashboard/summary').then((r) => r.data),
    me: () => client.get('/dashboard/me').then((r) => r.data),
    dataFlow: () => client.get('/dashboard/data-flow').then((r) => r.data),
};

export const datacenterApi = {
    stats: () => client.get('/datacenter/stats').then((r) => r.data),
    academic: () => client.get('/datacenter/academic').then((r) => r.data),
};

export const academicYearApi = {
    list: () => client.get('/academic-years').then((r) => r.data.academicYears),
    create: (payload) => client.post('/academic-years', payload).then((r) => r.data.academicYear),
    setCurrent: (id) => client.post(`/academic-years/${id}/set-current`).then((r) => r.data),
};

export const termApi = {
    list: (params) => client.get('/terms', { params }).then((r) => r.data.terms),
    current: () => client.get('/terms/current').then((r) => r.data),
    weeks: (id) => client.get(`/terms/${id}/weeks`).then((r) => r.data),
    create: (payload) => client.post('/terms', payload).then((r) => r.data.term),
    update: (id, payload) => client.patch(`/terms/${id}`, payload).then((r) => r.data.term),
    setCurrent: (id) => client.post(`/terms/${id}/set-current`).then((r) => r.data.term),
    remove: (id) => client.delete(`/terms/${id}`).then((r) => r.data),
};

export const calendarApi = {
    list: (params) => client.get('/calendar', { params }).then((r) => r.data),
    upcoming: (days) => client.get('/calendar/upcoming', { params: { days } }).then((r) => r.data.events),
    create: (payload) => client.post('/calendar', payload).then((r) => r.data.event),
    update: (id, payload) => client.patch(`/calendar/${id}`, payload).then((r) => r.data.event),
    remove: (id) => client.delete(`/calendar/${id}`).then((r) => r.data),
};

export const planningApi = {
    schemes: (params) => client.get('/planning/schemes', { params }).then((r) => r.data.schemes),
    scheme: (id) => client.get(`/planning/schemes/${id}`).then((r) => r.data.scheme),
    createScheme: (payload) => client.post('/planning/schemes', payload).then((r) => r.data.scheme),
    updateScheme: (id, payload) => client.patch(`/planning/schemes/${id}`, payload).then((r) => r.data.scheme),
    saveSchemeWeek: (id, weekNumber, payload) =>
        client.put(`/planning/schemes/${id}/weeks/${weekNumber}`, payload).then((r) => r.data.week),

    lessonPlans: (params) => client.get('/planning/lesson-plans', { params }).then((r) => r.data.lessonPlans),
    saveLessonPlan: (payload) => client.put('/planning/lesson-plans', payload).then((r) => r.data.lessonPlan),
    deleteLessonPlan: (id) => client.delete(`/planning/lesson-plans/${id}`).then((r) => r.data),

    submit: (kind, id) => client.post(`/planning/${kind}/${id}/submit`).then((r) => r.data.document),
    review: (kind, id, decision, note) =>
        client.post(`/planning/${kind}/${id}/review`, { decision, note }).then((r) => r.data.document),

    overview: () => client.get('/planning/overview').then((r) => r.data),
};

export const assignmentApi = {
    classStaff: (params) => client.get('/assignments/class-staff', { params }).then((r) => r.data),
    assignStaff: (payload) => client.put('/assignments/class-staff', payload).then((r) => r.data),
    removeStaff: (id) => client.delete(`/assignments/class-staff/${id}`).then((r) => r.data),

    subjects: (params) => client.get('/assignments/subjects', { params }).then((r) => r.data),
    assignSubject: (payload) => client.put('/assignments/subjects', payload).then((r) => r.data.assignment),
    bulkAssignSubject: (payload) => client.post('/assignments/subjects/bulk', payload).then((r) => r.data),
    removeSubject: (id) => client.delete(`/assignments/subjects/${id}`).then((r) => r.data),

    rotate: (payload) => client.post('/assignments/rotate', payload).then((r) => r.data),
    autoAssignMain: (sessionsPerWeek) =>
        client.post('/assignments/auto-assign-main', { sessionsPerWeek }).then((r) => r.data),

    workload: () => client.get('/assignments/workload').then((r) => r.data),
};

export const timetableApi = {
    get: (params) => client.get('/timetable', { params }).then((r) => r.data.slots),
    myWeek: () => client.get('/timetable/my-week').then((r) => r.data.slots),
    roster: (classId) => client.get(`/timetable/class/${classId}/roster`).then((r) => r.data),
    create: (payload) => client.post('/timetable', payload).then((r) => r.data.slot),
    update: (id, payload) => client.patch(`/timetable/${id}`, payload).then((r) => r.data.slot),
    remove: (id) => client.delete(`/timetable/${id}`).then((r) => r.data),
};

export const threadApi = {
    list: (params) => client.get('/threads', { params }).then((r) => r.data.threads),
    get: (id) => client.get(`/threads/${id}`).then((r) => r.data),
    create: (payload) => client.post('/threads', payload).then((r) => r.data.thread),
    reply: (id, body) => client.post(`/threads/${id}/messages`, { body }).then((r) => r.data.message),
    update: (id, payload) => client.patch(`/threads/${id}`, payload).then((r) => r.data.thread),
    unreadCount: () => client.get('/threads/unread-count').then((r) => r.data),
};

export const taskApi = {
    list: (params) => client.get('/tasks', { params }).then((r) => r.data.tasks),
    create: (payload) => client.post('/tasks', payload).then((r) => r.data.task),
    update: (id, payload) => client.patch(`/tasks/${id}`, payload).then((r) => r.data.task),
    remove: (id) => client.delete(`/tasks/${id}`).then((r) => r.data),
};

export const studentApi = {
    list: (params) => client.get('/students', { params }).then((r) => r.data.students),
    unassigned: () => client.get('/students/unassigned').then((r) => r.data.students),
    assign: (studentIds, classId, reason) =>
        client.post('/students/assign', { studentIds, classId, reason }).then((r) => r.data),
    get: (id) => client.get(`/students/${id}`).then((r) => r.data.student),
    create: (payload) => client.post('/students', payload).then((r) => r.data.student),
    update: (id, payload) => client.patch(`/students/${id}`, payload).then((r) => r.data.student),
    transfer: (id, toClassId, reason) =>
        client.post(`/students/${id}/transfer`, { toClassId, reason }).then((r) => r.data),
    transfers: (id) => client.get(`/students/${id}/transfers`).then((r) => r.data.transfers),
    import: (formData) => client.post('/students/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
};

export const classApi = {
    list: () => client.get('/classes').then((r) => r.data.classes),
    get: (id) => client.get(`/classes/${id}`).then((r) => r.data.class),
    create: (payload) => client.post('/classes', payload).then((r) => r.data.class),
    update: (id, payload) => client.patch(`/classes/${id}`, payload).then((r) => r.data.class),
    remove: (id) => client.delete(`/classes/${id}`).then((r) => r.data),
};

export const subjectApi = {
    list: () => client.get('/subjects').then((r) => r.data.subjects),
    create: (payload) => client.post('/subjects', payload).then((r) => r.data.subject),
    update: (id, payload) => client.patch(`/subjects/${id}`, payload).then((r) => r.data.subject),
    remove: (id) => client.delete(`/subjects/${id}`).then((r) => r.data),
};

export const userApi = {
    list: (params) => client.get('/users', { params }).then((r) => r.data.users),
    create: (payload) => client.post('/users', payload).then((r) => r.data.user),
    update: (id, payload) => client.patch(`/users/${id}`, payload).then((r) => r.data.user),
    deactivate: (id) => client.delete(`/users/${id}`).then((r) => r.data),
};

export const attendanceApi = {
    mark: (payload) => client.post('/attendance', payload).then((r) => r.data),
    forClass: (params) => client.get('/attendance', { params }).then((r) => r.data.attendance),
    forStudent: (studentId, params) =>
        client.get(`/attendance/student/${studentId}`, { params }).then((r) => r.data),
};

export const marksheetApi = {
    list: (params) => client.get('/marksheets', { params }).then((r) => r.data.marksheets),
    forStudent: (studentId, params) =>
        client.get(`/marksheets/student/${studentId}`, { params }).then((r) => r.data),
    save: (payload) => client.put('/marksheets', payload).then((r) => r.data.marksheet),
    bulkSave: (payload) => client.post('/marksheets/bulk', payload).then((r) => r.data),
    remove: (id) => client.delete(`/marksheets/${id}`).then((r) => r.data),
};

export const libraryApi = {
    loans: (params) => client.get('/library/loans', { params }).then((r) => r.data.loans),
    summary: () => client.get('/library/summary').then((r) => r.data),
    issue: (payload) => client.post('/library/loans', payload).then((r) => r.data.loan),
    returnBook: (id) => client.post(`/library/loans/${id}/return`).then((r) => r.data),
};

export const clinicApi = {
    visits: (params) => client.get('/clinic/visits', { params }).then((r) => r.data.visits),
    summary: () => client.get('/clinic/summary').then((r) => r.data),
    record: (payload) => client.post('/clinic/visits', payload).then((r) => r.data.visit),
    reviewLeave: (id, decision) =>
        client.post(`/clinic/visits/${id}/leave`, { decision }).then((r) => r.data),
};

export const noticeApi = {
    list: () => client.get('/notices').then((r) => r.data.notices),
    markRead: (id, acknowledge) =>
        client.post(`/notices/${id}/read`, { acknowledge }).then((r) => r.data.receipt),
    receipts: (id) => client.get(`/notices/${id}/receipts`).then((r) => r.data),
    create: (payload) => client.post('/notices', payload).then((r) => r.data.notice),
    update: (id, payload) => client.patch(`/notices/${id}`, payload).then((r) => r.data.notice),
    remove: (id) => client.delete(`/notices/${id}`).then((r) => r.data),
};

export const storeApi = {
    list: (params) => client.get('/store/requests', { params }).then((r) => r.data.requests),
    get: (id) => client.get(`/store/requests/${id}`).then((r) => r.data.request),
    create: (payload) => client.post('/store/requests', payload).then((r) => r.data.request),
    update: (id, payload) => client.patch(`/store/requests/${id}`, payload).then((r) => r.data.request),
    cancel: (id) => client.delete(`/store/requests/${id}`).then((r) => r.data),
    storeReview: (id, decision, note) =>
        client.post(`/store/requests/${id}/store-review`, { decision, note }).then((r) => r.data.request),
    adminReview: (id, decision, note) =>
        client.post(`/store/requests/${id}/admin-review`, { decision, note }).then((r) => r.data.request),
};

export const filesApi = {
    list: (params) => client.get('/files', { params }).then((r) => r.data.files),
    get: (id) => client.get(`/files/${id}`).then((r) => r.data.file),
    upload: (formData) => client.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data.file),
    download: (id) => client.get(`/files/${id}/download`).then((r) => r.data),
    remove: (id) => client.delete(`/files/${id}`).then((r) => r.data),
};
