const fs = require('fs');

const API_URL = 'http://localhost:5000/api';

async function fetchAPI(endpoint, options, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const opts = { ...options, headers };
    const res = await fetch(`${API_URL}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) {
        console.error(`API Error ${res.status}:`, JSON.stringify(data).slice(0, 200));
    }
    return data;
}

async function main() {
    const loginRes = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@bisnoc.local', password: 'changeme123' })
    });
    const token = loginRes.token;

    // Get classes
    const classesRes = await fetchAPI('/classes', {}, token);
    const classes = classesRes.classes;
    const classIds = classes.map(c => c.id);

    // Get subjects
    const subjectsRes = await fetchAPI('/subjects', {}, token);
    const subjects = subjectsRes.subjects;
    const subjectByName = {};
    subjects.forEach(s => { subjectByName[s.name] = s; });

    // Get existing assignments to delete them
    const assignsRes = await fetchAPI('/assignments/subjects', {}, token);
    const assignments = assignsRes.assignments || [];

    console.log(`Found ${assignments.length} existing assignments to clear...`);

    // Delete all existing subject assignments
    for (const a of assignments) {
        await fetchAPI(`/assignments/subjects/${a.id}`, { method: 'DELETE' }, token);
    }
    console.log('Cleared all assignments');

    // Get users (teachers)
    const usersRes = await fetchAPI('/users', {}, token);
    const users = usersRes.users;

    // Helper to find user by name
    function findUser(name) {
        return users.find(u => u.name === name);
    }

    // Helper to distribute classes among teachers
    function distributeClasses(teachers, allClasses) {
        const result = {};
        const total = allClasses.length;
        const perTeacher = Math.floor(total / teachers.length);
        const remainder = total % teachers.length;
        
        let idx = 0;
        teachers.forEach((teacher, i) => {
            const count = perTeacher + (i < remainder ? 1 : 0);
            result[teacher.id] = allClasses.slice(idx, idx + count);
            idx += count;
        });
        return result;
    }

    // Define subject -> teachers mapping
    const subjectTeachers = {
        'English': ['Deborah Kasasye Alemu', 'Michael Okwara Okwara', 'Dihurwe Desire'],
        'Amharic': ['Fremnet Mamo Esubalew', 'Mihiret Moges H/Mariam'],
        'Arts': ['Kalab Bizueinh Mekonen', 'Andu Getachew Tulu'],
        'Physical Education': ['Yalew Endale Gossaye', 'Gebremariam Yismaw Fanthahun'],
        'Music': ['Sena Elias Tasisa'],
        'French': ['Thomas Asmelash Gebray'],
    };

    console.log('\n--- Redistributing Assignments ---\n');

    for (const [subjectName, teacherNames] of Object.entries(subjectTeachers)) {
        const subject = subjectByName[subjectName];
        if (!subject) {
            console.log(`Subject not found: ${subjectName}`);
            continue;
        }

        const teachers = teacherNames.map(name => findUser(name)).filter(Boolean);
        const teacherNamesFound = teachers.map(t => t.name);
        const missing = teacherNames.filter(name => !findUser(name));
        
        if (missing.length > 0) {
            console.log(`Missing teachers for ${subjectName}:`, missing);
        }

        if (teachers.length === 0) {
            console.log(`No teachers found for ${subjectName}`);
            continue;
        }

        const distribution = distributeClasses(teachers, classIds);

        for (const [teacherId, assignedClassIds] of Object.entries(distribution)) {
            const teacher = users.find(u => u.id === teacherId);
            const res = await fetchAPI('/assignments/subjects/bulk', {
                method: 'POST',
                body: JSON.stringify({
                    subjectId: subject.id,
                    classIds: assignedClassIds,
                    teacherId: teacherId
                })
            }, token);
            const status = res.error ? `ERROR: ${res.error}` : 'OK';
            console.log(`${teacher.name} -> ${subjectName} (${assignedClassIds.length} classes): ${status}`);
        }
    }

    console.log('\n--- Done ---\n');
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
