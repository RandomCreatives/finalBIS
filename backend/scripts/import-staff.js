const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: './backend/.env' });

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
    process.exit(1);
}

const ENV_INITIAL_PASS = process.env.STAFF_INITIAL_PASSWORD;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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
    const csvPath = path.join(__dirname, '..', '..', 'staff_info.csv');
    if (!fs.existsSync(csvPath)) {
        console.error(`CSV file not found at ${csvPath}`);
        rl.close();
        process.exit(1);
    }
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const staff = parseCSV(csvContent);
    console.log(`Parsed ${staff.length} staff records from CSV`);

    // Login as admin
    const loginRes = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        })
    });
    const token = loginRes.token;
    if (!token) {
        console.error('Admin login failed. Check ADMIN_EMAIL and ADMIN_PASSWORD.');
        rl.close();
        process.exit(1);
    }
    console.log('Logged in as admin');

    // Get classes
    const classesRes = await fetchAPI('/classes', {}, token);
    const classes = classesRes.classes || [];
    
    const classByNameColor = {};
    classes.forEach(c => { 
        const color = c.name.replace('Year 3 - ', '');
        classByNameColor[color] = c;
    });

    // Get subjects
    const subjectsRes = await fetchAPI('/subjects', {}, token);
    const subjects = subjectsRes.subjects || [];
    const subjectByName = {};
    subjects.forEach(s => { subjectByName[s.name] = s; });

    console.log('\nClasses found:', Object.keys(classByNameColor));
    console.log('Subjects found:', Object.keys(subjectByName));

    // Track created users
    const createdUsers = {};
    const createdSummary = [];

    // Process each staff member
    console.log('\n--- Creating Staff Users ---\n');
    for (const row of staff) {
        const fullName = row['Staff Full Name*'];
        const jobTitle = row['Job Title*'];
        const subject = row['Subject'];
        const classroom = row['Class room'];

        // Determine role from job title
        let role = 'subject_teacher';
        if (jobTitle === 'Main Teacher') role = 'main_teacher';
        else if (jobTitle === 'Assistant Teacher') role = 'assistant_teacher';
        else if (jobTitle === 'Cover Teacher') role = 'subject_teacher';
        else if (jobTitle.includes('Special Need')) role = 'subject_teacher';
        else if (jobTitle === 'Teacher') role = 'subject_teacher';

        // Generate email from name
        const nameParts = fullName.toLowerCase().replace(/[^a-z\s]/g, '').split(' ').filter(Boolean);
        const email = `${nameParts[0]}.${nameParts.slice(-1)[0]}@bisnoc.local`;

        const password = ENV_INITIAL_PASS || crypto.randomBytes(16).toString('hex');
        const displayPass = ENV_INITIAL_PASS ? '(from STAFF_INITIAL_PASSWORD)' : password;

        try {
            const userRes = await fetchAPI('/users', {
                method: 'POST',
                body: JSON.stringify({
                    name: fullName,
                    email: email,
                    password: password,
                    role: role
                })
            }, token);

            const user = userRes.user;
            if (user) {
                createdUsers[fullName] = user;
                createdSummary.push({ name: fullName, email, role, displayPass });
                console.log(`Created: ${fullName} (${role}) - email: ${email}`);
            } else {
                console.log(`Error creating ${fullName}:`, JSON.stringify(userRes));
            }
        } catch (e) {
            console.log(`Failed to create ${fullName}:`, e.message);
        }
    }

    // Assign class staff and subject teachers
    console.log('\n--- Assigning Staff ---\n');
    for (const row of staff) {
        const fullName = row['Staff Full Name*'];
        const jobTitle = row['Job Title*'];
        const subjectName = row['Subject'];
        const classroom = row['Class room'];
        
        const user = createdUsers[fullName];
        if (!user) {
            console.log(`Skipping assignment for ${fullName} - user not created`);
            continue;
        }

        // Main/Assistant Teacher -> assign to class
        if ((jobTitle === 'Main Teacher' || jobTitle === 'Assistant Teacher') && classroom) {
            const position = jobTitle === 'Main Teacher' ? 'main' : 'assistant';
            const classObj = classByNameColor[classroom];
            if (classObj) {
                try {
                    await fetchAPI('/assignments/class-staff', {
                        method: 'PUT',
                        body: JSON.stringify({
                            classId: classObj.id,
                            userId: user.id,
                            position: position
                        })
                    }, token);
                    console.log(`Assigned ${fullName} as ${position} teacher to ${classObj.name}`);
                } catch (e) {
                    console.log(`Failed to assign ${fullName} to class:`, e.message);
                }
            } else {
                console.log(`Class not found: ${classroom} for ${fullName}`);
            }
        }
    }

    // Special case: assign subject teachers to subjects across classes
    console.log('\n--- Assigning Subject Teachers to Subjects ---\n');
    for (const row of staff) {
        const fullName = row['Staff Full Name*'];
        const jobTitle = row['Job Title*'];
        const subjectName = row['Subject'];
        
        // Only assign subject teachers and special need teachers
        if (!jobTitle) continue;
        if (!['Subject Teacher', 'Teacher', 'Special Need Teacher', 'Cover Teacher'].some(t => jobTitle.includes(t))) continue;
        if (!subjectName) continue;

        const user = createdUsers[fullName];
        if (!user) continue;

        const subjectObj = subjectByName[subjectName];
        if (!subjectObj) continue;

        // For ICT subject (don't exist in subjects), skip or map it
        if (subjectName === 'ICT') {
            console.log(`Note: ICT subject not in subject catalogue, skipping ${fullName}`);
            continue;
        }

        // Assign this teacher to teach this subject across all classes
        try {
            const classIds = classes.map(c => c.id);
            await fetchAPI('/assignments/subjects/bulk', {
                method: 'POST',
                body: JSON.stringify({
                    subjectId: subjectObj.id,
                    classIds: classIds,
                    teacherId: user.id
                })
            }, token);
            console.log(`Assigned ${fullName} to teach ${subjectName} across all ${classIds.length} classes`);
        } catch (e) {
            console.log(`Failed to assign ${fullName} for ${subjectName}:`, e.message);
        }
    }

    console.log('\n--- Staff Credentials Summary ---');
    createdSummary.forEach(s => {
        console.log(`  ${s.email.padEnd(30)} / ${s.displayPass.padEnd(35)} (${s.name})`);
    });

    console.log('\n--- Import Complete ---');
    rl.close();
}

main().catch(e => {
    console.error('Fatal error:', e);
    rl.close();
    process.exit(1);
});
