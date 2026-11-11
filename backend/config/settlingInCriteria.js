const SUBJECT_ORDER = [
    { key: 'english', label: 'English', assessorRole: 'subject_teacher' },
    { key: 'mathematics', label: 'Maths', assessorRole: 'main_teacher' },
    { key: 'science', label: 'Science', assessorRole: 'main_teacher' },
    { key: 'global_citizenship', label: 'Global Citizenship', assessorRole: 'main_teacher' },
    { key: 'amharic', label: 'Amharic', assessorRole: 'subject_teacher' },
];

const RATING_LABELS = {
    WT: 'Working Towards',
    WW: 'Working Within',
    WA: 'Working Above',
};

const CRITERIA = {
    3: {
        english: [
            'To make predictions using clues from the text.',
            'To find adjectives in a sentence and use one to describe a noun.',
            'To join sentences using a range of conjunctions and choose the one that fits the meaning.',
            'To add suffixes correctly, applying the spelling rules for dropping e, changing y to i, and doubling the final consonant.',
            'To name subject and object pronouns and replace a noun with the correct pronoun in a simple sentence.',
        ],
        mathematics: [
            'To recognize the place value of each digit in a three-digit number (hundreds, tens, ones).',
            'To add and subtract multiples of 10 and near multiples of 10 to and from 2-digit numbers.',
            'To write three digit numbers in figures and in words.',
            'To round two and three digit numbers to the nearest 10 and round three digit numbers to the nearest 100.',
            'To draw number lines and place numbers on number lines.',
            'To recognize and describe 3D shapes.',
            'To tell the time on an analogue and digital clock.',
            'To subtract by counting up.',
            'To halve and double odd and even numbers.',
        ],
        science: [
            'To define each categories of vertebrates and major categories of invertebrates.',
            'To identify adaptations that help Owls and Impala survive in their environment.',
            'To compare animals in contrasting habitats.',
            'To identify major components of snail habitat.',
        ],
        global_citizenship: [
            'To define the meaning of justice, injustice, and social justice.',
            'Recognize the difference between want and need.',
            'To recognize the barriers that prevent people being treated fairly and having equality of opportunity.',
            'To explain stereotype, generalization and assumption.',
            'To describe how behavior can affect ourselves and others positively and negatively.',
        ],
        amharic: [
            'To identify letters and their corresponding letter families.',
            'To combine and separating complex letters correctly.',
            'To identify and match synonym words.',
        ],
    },
    4: {
        english: [
            'To predict what happens next in a story: Use clues from the text. Give a reason using “I think... because...”.',
            'To put events in the right order: Find the main events. Order them using first, next, then, finally.',
            'To add a comma, question mark or exclamation mark inside the closing speech mark.',
            'To describe where a story takes place and use a few simple adjectives to describe it.',
            'To identify main clauses and subordinate clauses in a sentence.',
        ],
        mathematics: [
            'To identify the place value of each digit in a 4-digit number (1000s, 100s, 10s, 1s).',
            'To compare and order four digit numbers using <, > and = signs.',
            'To use mental and written strategies to add and subtract numbers accurately.',
            'To recall and use 6 and 9 times tables accurately and identify patterns in multiplication facts.',
            'To multiply 2-digit numbers by 1-digit numbers and solve multiplication and division problems.',
            'To find fractions of amounts.',
            'To tell the time using analogue and digital clocks and calculate time intervals.',
            'To measure and compare lengths using centimetres and millimetres, and convert between units of length.',
        ],
        science: [
            'To classify living things using observable characteristics and classification keys.',
            'To identify the basic needs of plants for healthy growth and survival.',
            'To identify and explain the functions of roots, stems, leaves and flowers.',
            'To group flowers and leaves according to observable features and similarities.',
            'To classify animals into different groups based on their features.',
        ],
        global_citizenship: [
            'To identify and explain examples of injustice in society.',
            'To recognise the needs of people and explain what helps individuals and communities thrive.',
            'To understand the importance of equality, inclusion and respect for all people.',
            'To explain the impact of bullying and demonstrate positive ways to resolve conflicts.',
        ],
        amharic: [
            'To match simple words to their antonyms and synonyms.',
            'To use all of the given words to build correct and meaningful sentences.',
            'To join two short sentences into one using a suitable conjunction.',
        ],
    },
};

const MAIN_TEACHER_CATEGORIES = [
    { key: 'conduct', label: 'Conduct' },
    { key: 'organisation', label: 'Organisation' },
    { key: 'attendance', label: 'Attendance' },
];

const MAIN_TEACHER_RATING_ORDER = ['pleasing', 'satisfactory', 'cause_for_concern'];
const MAIN_TEACHER_RATINGS = {
    pleasing: 'Pleasing',
    satisfactory: 'Satisfactory',
    cause_for_concern: 'Cause for Concern',
};
const MAIN_TEACHER_TEMPLATE_VERSION = 'settling-in-main-teacher-2026-27-v1';

const TEMPLATE_VERSION = {
    3: 'settling-in-year-3-2026-27-v1',
    4: 'settling-in-year-4-2026-27-v1',
};

const ratingOrder = (yearLevel) => (Number(yearLevel) === 4 ? ['WA', 'WW', 'WT'] : ['WT', 'WW', 'WA']);

const getSettlingInTemplate = (yearLevel) => {
    const grade = Number(yearLevel);
    if (![3, 4].includes(grade)) return null;

    return {
        yearLevel: grade,
        label: `Year ${grade}`,
        version: TEMPLATE_VERSION[grade],
        ratingOrder: ratingOrder(grade),
        ratings: RATING_LABELS,
        mainTeacherSection: {
            version: MAIN_TEACHER_TEMPLATE_VERSION,
            categories: MAIN_TEACHER_CATEGORIES,
            ratingOrder: MAIN_TEACHER_RATING_ORDER,
            ratings: MAIN_TEACHER_RATINGS,
        },
        subjects: SUBJECT_ORDER.map(({ key, label, assessorRole }) => ({
            key,
            label,
            assessorRole,
            criteria: CRITERIA[grade][key].map((text, index) => ({
                id: `y${grade}-${key}-${String(index + 1).padStart(2, '0')}`,
                text,
            })),
        })),
    };
};

const getSubjectForYear = (yearLevel, subjectKey) => {
    const template = getSettlingInTemplate(yearLevel);
    return template?.subjects.find((subject) => subject.key === subjectKey) || null;
};

const getSupportedSubjectKeys = () => SUBJECT_ORDER.map(({ key }) => key);

module.exports = {
    getSettlingInTemplate,
    getSubjectForYear,
    getSupportedSubjectKeys,
    MAIN_TEACHER_CATEGORIES,
    MAIN_TEACHER_RATING_ORDER,
    MAIN_TEACHER_RATINGS,
    MAIN_TEACHER_TEMPLATE_VERSION,
};
