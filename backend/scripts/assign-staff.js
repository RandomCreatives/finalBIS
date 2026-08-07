const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5000/api';

async function fetchAPI(endpoint, options, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const opts = { ...options, headers };
    const res = await fetch(`${API_URL}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) {
        console.error(`API Error ${res.status}:`, JSON.stringify(data));
    }
    return data;
}

function parseCSV(content) {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
        rows.push(row);
    }
    return rows;
}

async function main() {
    // Read CSV
    const csvPath = 'D:/DEV_TRIAL/BISFINAL/staff_info.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const staff = parseCSV(csvContent);
    console.log(`Parsed ${staff.length} staff records from CSV`);

    // Login as admin
    const loginRes = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@bisnoc.local', password: 'changeme123' })
    });
    const token = loginRes.token;
    console.log('Logged in as admin');

    // Get classes
    const classesRes = await fetchAPI('/classes', {}, token);
    const classes = classesRes.classes;
    const classByNameColor = {};
    classes.forEach(c => { 
        const color = c.name.replace('Year 3 - ', '');
        classByNameColor[color] = c;
        console.log(`Class: ${c.name} (id: ${c.id})`);
    });

    // Get subjects
    const subjectsRes = await fetchAPI('/subjects', {}, token);
    const subjects = subjectsRes.subjects;
    const subjectByName = {};
    subjects.forEach(s => { subjectByName[s.name] = s; });

    // Get existing users
    const usersRes = await fetchAPI('/users', {}, token);
    const users = usersRes.users;
    const userByName = {};
    users.forEach(u => { userByName[u.name] = u; });

    console.log('\n--- Assigning Class Staff ---\n');

    // First assign main/assistant teachers to classes
    for (const row of staff) {
        const fullName = row['Staff Full Name*'];
        const jobTitle = row['Job Title*'];
        const classroom = row['Class room'];
        
        const user = userByName[fullName];
        if (!user) continue;

        if ((jobTitle === 'Main Teacher' || jobTitle === 'Assistant Teacher') && classroom) {
            const position = jobTitle === 'Main Teacher' ? 'main' : 'assistant';
            const classObj = classByNameColor[classroom];
            if (classObj) {
                const res = await fetchAPI('/assignments/class-staff', {
                    method: 'PUT',
                    body: JSON.stringify({
                        classId: classObj.id,
                        userId: user.id,
                        position: position
                    })
                }, token);
                console.log(`Assigned ${fullName} as ${position} teacher to ${classObj.name}: ${JSON.stringify(res).slice(0, 100)}`);
            } else {
                console.log(`Class not found: ${classroom} for ${fullName}`);
            }
        }
    }

    console.log('\n--- Assigning Subject Teachers ---\n');

    // Now assign subject teachers across all classes
    const classIds = classes.map(c => c.id);
    
    for (const row of staff) {
        const fullName = row['Staff Full Name*'];
        const jobTitle = row['Job Title*'];
        const subjectName = row['Subject'];
        
        // Only assign subject teachers and special need teachers
        if (!jobTitle) continue;
        if (!['Subject Teacher', 'Teacher'].some(t => jobTitle === t)) continue;
        if (jobTitle === 'Cover Teacher') continue; // no subject assigned
        if (jobTitle.includes('Special Need')) continue; // no subject assigned
        
        if (!subjectName) continue;

        const user = userByName[fullName];
        if (!user) continue;

        const subjectObj = subjectByName[subjectName];
        if (!subjectObj) {
            console.log(`Subject not found: ${subjectName} for ${fullName}`);
            continue;
        }

        // ICT isn't in the subjects table, skip
        if (subjectName === 'ICT') {
            console.log(`Skipping ${fullName} - ICT not in subjects`);
            continue;
        }

        const res = await fetchAPI('/assignments/subjects/bulk', {
            method: 'POST',
            body: JSON.stringify({
                subjectId: subjectObj.id,
                classIds: classIds,
                teacherId: user.id
            })
        }, token);
        const status = res.error ? `ERROR: ${res.error}` : 'OK';
        console.log(`${fullName} -> ${subjectName} (${classIds.length} classes): ${status}`);
    }

    console.log('\n--- Import Complete ---\n');
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
