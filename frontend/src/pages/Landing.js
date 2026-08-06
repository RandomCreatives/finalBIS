import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    AppBar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Slider,
    Stack,
    Tab,
    Tabs,
    Toolbar,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    useMediaQuery,
    Drawer,
    Avatar,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SchoolIcon from '@mui/icons-material/School';
import GroupsIcon from '@mui/icons-material/Groups';
import ClassIcon from '@mui/icons-material/Class';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventNoteIcon from '@mui/icons-material/EventNote';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import CampaignIcon from '@mui/icons-material/Campaign';
import ForumIcon from '@mui/icons-material/Forum';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LoginIcon from '@mui/icons-material/Login';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CalculateIcon from '@mui/icons-material/Calculate';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VerifiedIcon from '@mui/icons-material/Verified';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import PublicIcon from '@mui/icons-material/Public';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { useAuth } from '../auth/AuthContext';

/**
 * -----------------------------------------------------------------------------
 * DATA DEFINITIONS: MODULES, STAFFING, FAQS
 * -----------------------------------------------------------------------------
 */

const MODULES_DATA = [
    {
        id: 'students',
        title: 'Students & Enrolment',
        category: 'safeguarding',
        categoryLabel: 'Safeguarding & Welfare',
        icon: <GroupsIcon />,
        color: '#1e40af',
        summary: 'Enrolment records, guardians, special-needs flags, class placement, and transfers.',
        description: 'Comprehensive student profile management with database-enforced integrity. Track enrolment dates, assigned homerooms, confidential special educational needs (SEN) flags, and guardian contact records.',
        workflows: [
            'Admin-guided bulk or individual student placement across 12 homeroom classes.',
            'Instant capacity validation preventing overcrowded classes.',
            'Safeguarding badges for medical alerts and special educational needs.',
            'Seamless student transfer tracking between homerooms.',
        ],
        permissions: 'Admins manage enrolment and placement; Teachers view profiles and safeguarding flags for their assigned students.',
        specHighlight: 'PostgreSQL capacity checks & SEN flags',
    },
    {
        id: 'classes',
        title: 'Classes & Homerooms',
        category: 'staff',
        categoryLabel: 'Staff & Operations',
        icon: <ClassIcon />,
        color: '#0f766e',
        summary: 'Homeroom groups across EYFS to KS4, each with exactly one main and one assistant teacher.',
        description: 'The architectural spine of BIS NOC Gerji. Exactly 12 homeroom classes spanning Early Years Foundation Stage (EYFS) through Key Stage 4, structured for dual-teacher accountability.',
        workflows: [
            'Database-enforced partial unique index: (class_id, position) prevents seat double-filling.',
            'Instant teacher rotation and swapping utilities for school administrators.',
            'Real-time class roster lookup ("Who attends this class?").',
            'Workload reporting flagging any unassigned teaching seats.',
        ],
        permissions: 'Admins configure classes and assign teachers; Teachers view homeroom rosters.',
        specHighlight: 'Partial Unique Index on (class_id, position)',
    },
    {
        id: 'subjects',
        title: 'Subjects Catalogue',
        category: 'academic',
        categoryLabel: 'Academic & Teaching',
        icon: <MenuBookIcon />,
        color: '#7e22ce',
        summary: 'School-wide curriculum catalogue with clear "who normally delivers it" rules.',
        description: 'A unified subject catalogue where "English" is a single school-wide entity, not duplicated per class. Enforces clear delivery policies across Main, Assistant, and Specialist teachers.',
        workflows: [
            'Main Teacher policy: English, Mathematics, Science, Social Studies, Art, History.',
            'Assistant Teacher policy: Amharic, General Science, Spoken English, Citizenship.',
            'Specialist policy: ICT, Physical Education, French, Music.',
            'Automated subject teaching assignment across every staffed homeroom class.',
        ],
        permissions: 'Admins manage curriculum catalogue and policies; Teachers view assigned subjects.',
        specHighlight: 'Policy enum: main_teacher, assistant_teacher, specialist',
    },
    {
        id: 'assignments',
        title: 'Teaching Assignments',
        category: 'academic',
        categoryLabel: 'Academic & Teaching',
        icon: <AssignmentIndIcon />,
        color: '#b45309',
        summary: 'Class staffing, cross-class subject assignments, and teacher workload reporting.',
        description: 'Manage who teaches what across the school. Enables bulk assignment of subject specialists across several classes and generates instant teacher workload reports.',
        workflows: [
            'Assign a specialist subject teacher across multiple classes in one transaction.',
            'Workload reporting dashboard showing total teaching periods and class coverage.',
            'Automated detection of unstaffed or missing subject assignments.',
            'Clear separation between homeroom leadership and subject delivery.',
        ],
        permissions: 'Admin-only module for assignment and workload management.',
        specHighlight: 'Multi-class atomic assignments & workload audits',
    },
    {
        id: 'planning',
        title: 'Schemes of Work & Lesson Plans',
        category: 'academic',
        categoryLabel: 'Academic & Teaching',
        icon: <AutoStoriesIcon />,
        color: '#1d4ed8',
        summary: 'Termly schemes of work and weekly lesson plans with a structured submit/review workflow.',
        description: '100% digital academic planning. Teachers scaffold termly schemes of work by week and write detailed weekly lesson plans. Supervisors review, comment, and approve submitted documents.',
        workflows: [
            'Scaffold one scheme row per teaching week automatically based on term dates.',
            'Draft -> Submit -> Review workflow with supervisor approval auditing.',
            'Lock approved lesson schemes against unauthorized edits.',
            'Supervisor planning overview flagging missing or overdue schemes.',
        ],
        permissions: 'Teachers create and submit their schemes; Admins review and approve.',
        specHighlight: 'State machine: draft → submitted → approved / revision_requested',
    },
    {
        id: 'timetable',
        title: 'Timetable & Clash Prevention',
        category: 'academic',
        categoryLabel: 'Academic & Teaching',
        icon: <CalendarMonthIcon />,
        color: '#047857',
        summary: 'Weekly schedule grid with database-enforced double-booking prevention.',
        description: 'A dynamic weekly timetable grid for 12 classes across Monday to Friday. Database constraints guarantee that neither a teacher nor a room can ever be double-booked.',
        workflows: [
            'Database constraint rejects overlapping time slots for the same teacher or class.',
            'Role-scoped visibility: Main & Assistant teachers see their whole homeroom week.',
            'Subject teachers see an instant "My Week" view narrowed to their own periods.',
            'One-click class roster inspection per period ("Who attends this class?").',
        ],
        permissions: 'Admins edit and publish timetable slots; all staff view their relevant schedules.',
        specHighlight: 'PostgreSQL exclusion & unique period constraints',
    },
    {
        id: 'attendance',
        title: 'Attendance Registers',
        category: 'safeguarding',
        categoryLabel: 'Safeguarding & Welfare',
        icon: <FactCheckIcon />,
        color: '#c2410c',
        summary: 'Homeroom daily registers or per-subject attendance tracking with instant stats.',
        description: 'Replace paper registers with instant digital roll calls. Supports daily homeroom morning attendance as well as per-period subject attendance.',
        workflows: [
            'Mark students as Present, Absent, Late, or Excused with optional notes.',
            'Instant daily homeroom attendance summary for academic leaders.',
            'Per-subject attendance logs for specialist subject teachers.',
            'Automated attendance percentages calculated on the server.',
        ],
        permissions: 'Main, Assistant, and Subject teachers record attendance for their students.',
        specHighlight: 'Daily & period-scoped attendance rollup',
    },
    {
        id: 'marksheets',
        title: 'Marksheets & Server Grading',
        category: 'academic',
        categoryLabel: 'Academic & Teaching',
        icon: <CalculateIcon />,
        color: '#4338ca',
        summary: 'Per-student, subject, and term marksheets with server-side percentage and grade derivation.',
        description: 'Eliminate manual spreadsheet errors. Teachers enter raw scores and the backend automatically derives standard percentages, letter grades (A* to F), and GPA points.',
        workflows: [
            'One marksheet record per student, subject, and term.',
            'Server-side grading: A* (90-100), A (80-89), B (70-79), C (60-69), D (50-59), E (40-49), F (<40).',
            'Input validation rejecting impossible scores above maximum marks.',
            'Term-end academic summary reports for homerooms.',
        ],
        permissions: 'Teachers input marks for their assigned classes; Admins oversee school reports.',
        specHighlight: 'Immutable server-side grade calculation engine',
    },
    {
        id: 'library',
        title: 'Library & Automated Fines',
        category: 'safeguarding',
        categoryLabel: 'Safeguarding & Welfare',
        icon: <LocalLibraryIcon />,
        color: '#0e7490',
        summary: 'Book loans, returns, 3-book borrowing limit, and overdue fines at 5 ETB/day.',
        description: 'Complete library circulation management for NOC Gerji Campus. Tracks book checkouts, enforces borrowing limits, and automatically calculates overdue fines.',
        workflows: [
            'Automated 3-book active loan limit per student or staff member.',
            'Server-calculated overdue fines at exactly 5 ETB per day.',
            'One-click book return and loan extension tracking.',
            'Overdue inventory reporting for school librarians and administrators.',
        ],
        permissions: 'Admins and librarians manage loans and returns; Teachers view student library status.',
        specHighlight: 'Dynamic fine formula: max(0, days_overdue) × 5.00 ETB',
    },
    {
        id: 'clinic',
        title: 'Clinic & Medical Leave',
        category: 'safeguarding',
        categoryLabel: 'Safeguarding & Welfare',
        icon: <HealthAndSafetyIcon />,
        color: '#be123c',
        summary: 'Confidential student medical visits and formal leave requests approved by an admin.',
        description: 'Safeguard student health on campus. Teachers or nurses log clinic visits with symptoms and treatments. Medical leave requests follow a strict admin approval workflow.',
        workflows: [
            'Log clinic visits with timestamped symptom and treatment notes.',
            'Medical leave request submission with guardian notification flags.',
            'Admin-only approval workflow for official medical leaves.',
            'Confidential health records integrated with student safeguarding profiles.',
        ],
        permissions: 'Teachers and nurses log visits; Admins approve medical leave requests.',
        specHighlight: 'Confidentiality rules & admin leave sign-off',
    },
    {
        id: 'messages',
        title: 'Threaded Communications',
        category: 'staff',
        categoryLabel: 'Staff & Operations',
        icon: <ForumIcon />,
        color: '#0369a1',
        summary: 'Threaded admin ↔ teacher conversations, attachable to a student or class.',
        description: 'Keep staff communication organized and auditable. Start threaded conversations with colleagues, optionally linking threads directly to a student profile or homeroom class.',
        workflows: [
            'Direct admin-to-teacher or teacher-to-teacher threaded messages.',
            'Attach conversations to specific students or classes for context.',
            'Automated unread counts that ignore your own outgoing messages.',
            'Opening a thread automatically clears its unread receipt count.',
        ],
        permissions: 'All authenticated staff members can participate in their conversation threads.',
        specHighlight: 'Participant-scoped inbox & context linking',
    },
    {
        id: 'tasks',
        title: 'Task Management',
        category: 'staff',
        categoryLabel: 'Staff & Operations',
        icon: <TaskAltIcon />,
        color: '#15803d',
        summary: 'Assignable action items with due dates, priority tags, and status tracking.',
        description: 'Empower school leadership to assign action items to teachers and staff. Track preparation tasks, committee work, and deadlines in a shared operational dashboard.',
        workflows: [
            'Assign tasks with due dates, priority levels, and detailed descriptions.',
            'Real-time status updates: Pending, In Progress, or Completed.',
            'Filtered task list by assignee, due date, and priority.',
            'Overdue task highlighting for academic coordinators.',
        ],
        permissions: 'Admins assign and oversee tasks; Teachers view and update assigned items.',
        specHighlight: 'Status tracking & priority filtering',
    },
    {
        id: 'notices',
        title: 'Targeted Notices & Receipts',
        category: 'staff',
        categoryLabel: 'Staff & Operations',
        icon: <CampaignIcon />,
        color: '#b91c1c',
        summary: 'Targeted announcements with read and acknowledgment receipts.',
        description: 'Broadcast urgent campus news or policy updates. Target notices to all staff, specific roles, or specific homerooms, complete with digital acknowledgment tracking.',
        workflows: [
            'Publish notices targeted by role (Admin, Main Teacher, Assistant Teacher, etc.).',
            'Optional mandatory acknowledgment receipt required from recipients.',
            'Real-time tracking of who has read and acknowledged each notice.',
            'Archived notice bulletin board for compliance auditing.',
        ],
        permissions: 'Admins publish notices; targeted staff view and acknowledge.',
        specHighlight: 'Role targeting & read-receipt audit table',
    },
    {
        id: 'calendar',
        title: 'Term & Exam Calendar',
        category: 'staff',
        categoryLabel: 'Staff & Operations',
        icon: <EventNoteIcon />,
        color: '#4f46e5',
        summary: 'Term dates, exams, meetings, holidays and trips, targeted by role or class.',
        description: 'The master academic schedule for BIS NOC Gerji. Tracks term boundaries, exam periods, staff meetings, holidays, and school trips with role-based filtering.',
        workflows: [
            'Publish school events across standard categories: term, exam, meeting, holiday, trip.',
            'Target events to specific roles or homeroom classes.',
            'Automatic date validation preventing inverted start/end times.',
            'Cascading deletion cleanup when classes or terms are updated.',
        ],
        permissions: 'Admins publish calendar events; staff view their relevant schedules.',
        specHighlight: 'Role & class targeting with date constraints',
    },
];

const FAQS_DATA = [
    {
        q: 'How do I get my login credentials for the BIS NOC Gerji Staff Portal?',
        a: 'There is no self-service registration to ensure absolute security. Staff accounts are provisioned directly by the School Administrator. Once your account is created, you can sign in using your official school email address and initial password, which you can update anytime via your profile settings.',
    },
    {
        q: 'Why does every homeroom class have both a Main Teacher and an Assistant Teacher?',
        a: 'BIS NOC Gerji enforces a dual-teacher model across all 12 homeroom classes (EYFS to Key Stage 4). The Main Teacher oversees pastoral care and core academic delivery, while the Assistant Teacher delivers supportive subjects and assists with classroom management. A PostgreSQL partial unique index guarantees that neither position can ever be double-filled.',
    },
    {
        q: 'How does the timetable clash prevention work?',
        a: 'Our database schema uses PostgreSQL exclusion and unique constraints on class periods and teacher schedules. If an administrator attempts to assign a teacher or room to two overlapping lessons, the database rejects the transaction outright, ensuring zero clashes.',
    },
    {
        q: 'How are marksheet percentages and grades calculated?',
        a: 'To eliminate manual formula errors, teachers input only the raw mark and maximum mark. The Express server automatically calculates the percentage and maps it to the standard grading scale: A* (90-100%), A (80-89%), B (70-79%), C (60-69%), D (50-59%), E (40-49%), and F (<40%).',
    },
    {
        q: 'What is the library loan policy and how are overdue fines calculated?',
        a: 'Students and staff can borrow up to 3 books simultaneously. When a book exceeds its loan period, the system automatically calculates a daily overdue fine of exactly 5.00 ETB per day overdue. Borrowing is paused until overdue books are returned.',
    },
    {
        q: 'Who can view confidential clinic visits and medical leave requests?',
        a: 'Student safeguarding is paramount. Clinic medical records are visible only to the clinic nurse and authorized school administrators. When a medical leave request is submitted, only an Administrator can approve or reject the leave.',
    },
];

/**
 * -----------------------------------------------------------------------------
 * MAIN LANDING PAGE COMPONENT
 * -----------------------------------------------------------------------------
 */
export default function Landing() {
    const { user, isAuthenticated, logout } = useAuth();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // UI state
    const [mobileOpen, setMobileOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedModule, setSelectedModule] = useState(null);
    const [userMenuAnchor, setUserMenuAnchor] = useState(null);

    // Interactive Hero Snapshot Tabs
    const [heroTab, setHeroTab] = useState(0);

    // Interactive Simulators State
    const [demoScore, setDemoScore] = useState(84);
    const [demoOverdueDays, setDemoOverdueDays] = useState(4);
    const [demoDay, setDemoDay] = useState('Monday');
    const [demoPeriod, setDemoPeriod] = useState(2);
    const [demoClashSim, setDemoClashSim] = useState(false);

    // Staffing Model interactive filter
    const [staffingFilter, setStaffingFilter] = useState('all');

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleScrollTo = (id) => {
        setMobileOpen(false);
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Derived grade calculations for Simulator 1
    const getGradeInfo = (score) => {
        if (score >= 90) return { grade: 'A*', gpa: '4.0', desc: 'Outstanding Excellence', color: '#15803d' };
        if (score >= 80) return { grade: 'A', gpa: '4.0', desc: 'Superior Attainment', color: '#16a34a' };
        if (score >= 70) return { grade: 'B', gpa: '3.0', desc: 'Commendable Achievement', color: '#2563eb' };
        if (score >= 60) return { grade: 'C', gpa: '2.0', desc: 'Satisfactory Performance', color: '#0284c7' };
        if (score >= 50) return { grade: 'D', gpa: '1.0', desc: 'Minimum Pass Level', color: '#d97706' };
        if (score >= 40) return { grade: 'E', gpa: '0.5', desc: 'Marginal Performance', color: '#ea580c' };
        return { grade: 'F', gpa: '0.0', desc: 'Needs Academic Support', color: '#dc2626' };
    };

    const gradeInfo = getGradeInfo(demoScore);
    const calculatedFine = Math.max(0, demoOverdueDays) * 5;

    const filteredModules = selectedCategory === 'all'
        ? MODULES_DATA
        : MODULES_DATA.filter((m) => m.category === selectedCategory);

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: '#1f2937' }}>
            {/* --------------------------------------------------------------------- */}
            {/* TOP APP BAR / NAVIGATION                                               */}
            {/* --------------------------------------------------------------------- */}
            <AppBar
                position="sticky"
                elevation={0}
                sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid #e5e7eb',
                    color: '#1f2937',
                    zIndex: (t) => t.zIndex.drawer + 1,
                }}
            >
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: 72 }}>
                        {/* Logo & School Branding */}
                        <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                            sx={{ cursor: 'pointer' }}
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        >
                            <Box
                                sx={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 2.5,
                                    bgcolor: 'primary.main',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    boxShadow: '0 4px 12px rgba(30, 64, 175, 0.25)',
                                }}
                            >
                                <SchoolIcon sx={{ fontSize: 26 }} />
                            </Box>
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.15, color: '#111827', fontSize: '1.1rem' }}>
                                    British International School
                                </Typography>
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                        NOC Gerji Campus
                                    </Typography>
                                    <Chip
                                        label="SMS v1.0"
                                        size="small"
                                        sx={{
                                            height: 18,
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            bgcolor: '#dbeafe',
                                            color: '#1e40af',
                                        }}
                                    />
                                </Stack>
                            </Box>
                        </Stack>

                        {/* Desktop Navigation Links */}
                        {!isMobile && (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Button color="inherit" onClick={() => handleScrollTo('overview')} sx={{ fontWeight: 600, color: '#4b5563' }}>
                                    Overview
                                </Button>
                                <Button color="inherit" onClick={() => handleScrollTo('modules')} sx={{ fontWeight: 600, color: '#4b5563' }}>
                                    System Modules
                                </Button>
                                <Button color="inherit" onClick={() => handleScrollTo('demo')} sx={{ fontWeight: 600, color: '#4b5563' }}>
                                    Interactive Simulators
                                </Button>
                                <Button color="inherit" onClick={() => handleScrollTo('staffing')} sx={{ fontWeight: 600, color: '#4b5563' }}>
                                    Staffing Model
                                </Button>
                                <Button color="inherit" onClick={() => handleScrollTo('campus')} sx={{ fontWeight: 600, color: '#4b5563' }}>
                                    Campus Life
                                </Button>
                                <Button color="inherit" onClick={() => handleScrollTo('faq')} sx={{ fontWeight: 600, color: '#4b5563' }}>
                                    FAQs
                                </Button>
                            </Stack>
                        )}

                        {/* Call to Action & Account status */}
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            {isAuthenticated ? (
                                <>
                                    <Button
                                        variant="contained"
                                        component={RouterLink}
                                        to="/app"
                                        startIcon={<DashboardIcon />}
                                        sx={{
                                            bgcolor: 'primary.main',
                                            '&:hover': { bgcolor: 'primary.dark' },
                                            fontWeight: 700,
                                            px: 2.5,
                                            boxShadow: '0 4px 14px rgba(30, 64, 175, 0.3)',
                                        }}
                                    >
                                        Staff Dashboard
                                    </Button>
                                    <IconButton
                                        onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                                        sx={{ border: '1px solid #e5e7eb', p: 0.5 }}
                                    >
                                        <Avatar sx={{ bgcolor: '#0f766e', width: 34, height: 34, fontSize: '0.9rem', fontWeight: 700 }}>
                                            {user?.name?.[0] || 'U'}
                                        </Avatar>
                                    </IconButton>
                                    <Menu
                                        anchorEl={userMenuAnchor}
                                        open={Boolean(userMenuAnchor)}
                                        onClose={() => setUserMenuAnchor(null)}
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                    >
                                        <MenuItem disabled sx={{ opacity: 1, py: 1 }}>
                                            <Stack>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{user?.name}</Typography>
                                                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
                                            </Stack>
                                        </MenuItem>
                                        <Divider />
                                        <MenuItem component={RouterLink} to="/app">Go to Portal</MenuItem>
                                        <MenuItem onClick={logout} sx={{ color: 'error.main' }}>Sign out</MenuItem>
                                    </Menu>
                                </>
                            ) : (
                                <Button
                                    variant="contained"
                                    component={RouterLink}
                                    to="/login"
                                    startIcon={<LoginIcon />}
                                    sx={{
                                        bgcolor: 'primary.main',
                                        '&:hover': { bgcolor: 'primary.dark' },
                                        fontWeight: 700,
                                        px: { xs: 2, sm: 3 },
                                        py: 1,
                                        boxShadow: '0 4px 14px rgba(30, 64, 175, 0.3)',
                                        borderRadius: 2,
                                    }}
                                >
                                    Staff Portal Sign In
                                </Button>
                            )}

                            {isMobile && (
                                <IconButton onClick={handleDrawerToggle} sx={{ color: '#111827' }}>
                                    <MenuIcon />
                                </IconButton>
                            )}
                        </Stack>
                    </Toolbar>
                </Container>
            </AppBar>

            {/* Mobile Drawer Navigation */}
            <Drawer anchor="right" open={mobileOpen} onClose={handleDrawerToggle}>
                <Box sx={{ width: 280, p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>Navigation</Typography>
                        <IconButton onClick={handleDrawerToggle}>
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                    <Divider sx={{ mb: 2 }} />
                    <List>
                        <ListItem button onClick={() => handleScrollTo('overview')}>
                            <ListItemText primary="Overview" />
                        </ListItem>
                        <ListItem button onClick={() => handleScrollTo('modules')}>
                            <ListItemText primary="System Modules" />
                        </ListItem>
                        <ListItem button onClick={() => handleScrollTo('demo')}>
                            <ListItemText primary="Interactive Simulators" />
                        </ListItem>
                        <ListItem button onClick={() => handleScrollTo('staffing')}>
                            <ListItemText primary="Staffing Model" />
                        </ListItem>
                        <ListItem button onClick={() => handleScrollTo('campus')}>
                            <ListItemText primary="Campus Life" />
                        </ListItem>
                        <ListItem button onClick={() => handleScrollTo('faq')}>
                            <ListItemText primary="FAQs" />
                        </ListItem>
                    </List>
                    <Divider sx={{ my: 2 }} />
                    <Button
                        variant="contained"
                        fullWidth
                        component={RouterLink}
                        to={isAuthenticated ? '/app' : '/login'}
                        startIcon={isAuthenticated ? <DashboardIcon /> : <LoginIcon />}
                        sx={{ py: 1.5, fontWeight: 700 }}
                    >
                        {isAuthenticated ? 'Go to Dashboard' : 'Staff Sign In'}
                    </Button>
                </Box>
            </Drawer>

            {/* --------------------------------------------------------------------- */}
            {/* HERO SECTION (`#overview`)                                             */}
            {/* --------------------------------------------------------------------- */}
            <Box
                id="overview"
                sx={{
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 45%, #0f766e 100%)',
                    color: 'white',
                    pt: { xs: 8, md: 12 },
                    pb: { xs: 10, md: 14 },
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Decorative subtle circle overlay */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: -100,
                        right: -100,
                        width: 500,
                        height: 500,
                        borderRadius: '50%',
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        pointerEvents: 'none',
                    }}
                />

                <Container maxWidth="xl">
                    <Grid container spacing={6} alignItems="center">
                        {/* Left Column: Headline & CTAs */}
                        <Grid item xs={12} lg={6}>
                            <Stack spacing={3.5}>
                                <Box>
                                    <Chip
                                        icon={<VerifiedIcon sx={{ color: '#fff !important', fontSize: 16 }} />}
                                        label="BRITISH CURRICULUM • EYFS TO KEY STAGE 4 • ADDIS ABABA"
                                        sx={{
                                            bgcolor: 'rgba(255, 255, 255, 0.15)',
                                            color: '#ffffff',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            letterSpacing: '0.04em',
                                            mb: 2.5,
                                            border: '1px solid rgba(255, 255, 255, 0.25)',
                                            px: 1,
                                        }}
                                    />
                                    <Typography
                                        variant="h2"
                                        sx={{
                                            fontWeight: 900,
                                            lineHeight: 1.1,
                                            fontSize: { xs: '2.4rem', sm: '3.2rem', md: '3.8rem' },
                                            letterSpacing: '-0.03em',
                                            mb: 2.5,
                                        }}
                                    >
                                        The Complete Digital Spine for{' '}
                                        <Box component="span" sx={{ color: '#6ee7b7' }}>
                                            BIS NOC Gerji
                                        </Box>
                                    </Typography>
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            fontWeight: 400,
                                            color: 'rgba(255, 255, 255, 0.88)',
                                            lineHeight: 1.6,
                                            fontSize: { xs: '1.05rem', md: '1.2rem' },
                                            maxWidth: 620,
                                        }}
                                    >
                                        A staff-facing school management system engineered for the British International School, NOC Gerji Campus. Supporting 12 homeroom classes with database-enforced teacher accountability, digital lesson planning, server-graded marksheets, and real-time safeguarding.
                                    </Typography>
                                </Box>

                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
                                    <Button
                                        variant="contained"
                                        size="large"
                                        component={RouterLink}
                                        to={isAuthenticated ? '/app' : '/login'}
                                        endIcon={<ArrowForwardIcon />}
                                        sx={{
                                            bgcolor: '#ffffff',
                                            color: '#1e3a8a',
                                            '&:hover': { bgcolor: '#f3f4f6' },
                                            fontWeight: 800,
                                            px: 4,
                                            py: 1.75,
                                            fontSize: '1rem',
                                            borderRadius: 2,
                                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                                        }}
                                    >
                                        {isAuthenticated ? 'Open Staff Dashboard' : 'Sign In to Staff Portal'}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="large"
                                        onClick={() => handleScrollTo('modules')}
                                        sx={{
                                            borderColor: 'rgba(255, 255, 255, 0.5)',
                                            color: '#ffffff',
                                            '&:hover': {
                                                borderColor: '#ffffff',
                                                bgcolor: 'rgba(255, 255, 255, 0.1)',
                                            },
                                            fontWeight: 700,
                                            px: 3.5,
                                            py: 1.75,
                                            fontSize: '1rem',
                                            borderRadius: 2,
                                        }}
                                    >
                                        Explore All 14 Modules
                                    </Button>
                                </Stack>

                                {/* Quick trust badges */}
                                <Stack direction="row" spacing={3} sx={{ pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.15)' }}>
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#6ee7b7', fontSize: '1.1rem' }}>
                                            12 Classes
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)' }}>
                                            1 Main + 1 Assistant each
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#6ee7b7', fontSize: '1.1rem' }}>
                                            0 Clashes
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)' }}>
                                            DB-enforced timetable grid
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#6ee7b7', fontSize: '1.1rem' }}>
                                            100% Digital
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.75)' }}>
                                            Schemes, attendance & clinic
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Stack>
                        </Grid>

                        {/* Right Column: Interactive Hero Dashboard Card */}
                        <Grid item xs={12} lg={6}>
                            <Card
                                sx={{
                                    bgcolor: 'rgba(255, 255, 255, 0.98)',
                                    color: '#1f2937',
                                    borderRadius: 3,
                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255, 255, 255, 0.4)',
                                }}
                            >
                                {/* Card Top Bar */}
                                <Box
                                    sx={{
                                        px: 3,
                                        py: 1.75,
                                        bgcolor: '#0f172a',
                                        color: '#ffffff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ef4444' }} />
                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#eab308' }} />
                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#22c55e' }} />
                                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#cbd5e1', ml: 1 }}>
                                            BIS NOC Gerji • Live System Status
                                        </Typography>
                                    </Stack>
                                    <Chip label="PostgreSQL DB Protected" size="small" sx={{ bgcolor: '#1e293b', color: '#38bdf8', fontSize: '0.7rem', fontWeight: 700 }} />
                                </Box>

                                {/* Tabs inside interactive card */}
                                <Tabs
                                    value={heroTab}
                                    onChange={(e, val) => setHeroTab(val)}
                                    variant="fullWidth"
                                    sx={{ borderBottom: '1px solid #e5e7eb', bgcolor: '#f8fafc' }}
                                >
                                    <Tab label="Today's Pulse" sx={{ fontWeight: 700, textTransform: 'none', fontSize: '0.85rem' }} />
                                    <Tab label="Staffing Model" sx={{ fontWeight: 700, textTransform: 'none', fontSize: '0.85rem' }} />
                                    <Tab label="Academic Term 1" sx={{ fontWeight: 700, textTransform: 'none', fontSize: '0.85rem' }} />
                                </Tabs>

                                <CardContent sx={{ p: { xs: 2.5, sm: 3.5 }, minHeight: 310 }}>
                                    {heroTab === 0 && (
                                        <Stack spacing={2.5}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                <Box>
                                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#111827' }}>
                                                        Daily Operations Dashboard
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Real-time activity across British International School NOC Gerji Campus
                                                    </Typography>
                                                </Box>
                                                <Chip label="System Healthy" color="success" size="small" sx={{ fontWeight: 700 }} />
                                            </Stack>

                                            <Grid container spacing={2}>
                                                <Grid item xs={6} sm={6}>
                                                    <Paper sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
                                                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#166534' }}>
                                                            MORNING REGISTER
                                                        </Typography>
                                                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#14532d', my: 0.5 }}>
                                                            12 / 12 Classes
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#166534' }}>
                                                            100% homeroom registers submitted
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                                <Grid item xs={6} sm={6}>
                                                    <Paper sx={{ p: 2, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
                                                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#1e40af' }}>
                                                            TIMETABLE GRID
                                                        </Typography>
                                                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#1e3a8a', my: 0.5 }}>
                                                            360 Periods / Wk
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#1e40af' }}>
                                                            0 DB clashes detected
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                                <Grid item xs={6} sm={6}>
                                                    <Paper sx={{ p: 2, bgcolor: '#fef3c7', border: '1px solid #fde68a', borderRadius: 2 }}>
                                                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#92400e' }}>
                                                            LIBRARY LOANS
                                                        </Typography>
                                                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#78350f', my: 0.5 }}>
                                                            3-Book Limit
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#92400e' }}>
                                                            Automated 5 ETB/day fine rate
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                                <Grid item xs={6} sm={6}>
                                                    <Paper sx={{ p: 2, bgcolor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 2 }}>
                                                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#9f1239' }}>
                                                            CLINIC AUDIT
                                                        </Typography>
                                                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#881337', my: 0.5 }}>
                                                            Secured Visits
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#9f1239' }}>
                                                            Admin leave approval active
                                                        </Typography>
                                                    </Paper>
                                                </Grid>
                                            </Grid>
                                        </Stack>
                                    )}

                                    {heroTab === 1 && (
                                        <Stack spacing={2.5}>
                                            <Box>
                                                <Typography variant="h6" sx={{ fontWeight: 800, color: '#111827' }}>
                                                    Database-Enforced Staffing Guarantee
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    How BIS NOC Gerji prevents classroom staffing gaps and double-filled seats
                                                </Typography>
                                            </Box>

                                            <Paper sx={{ p: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                                                <Stack spacing={1.5}>
                                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e40af' }}>
                                                            PostgreSQL Index Rule
                                                        </Typography>
                                                        <Chip label="UNIQUE (class_id, position)" size="small" sx={{ bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 700, fontFamily: 'monospace' }} />
                                                    </Stack>
                                                    <Typography variant="body2" sx={{ color: '#334155' }}>
                                                        Each of the 12 homeroom classes has exactly one <b>main teacher</b> and one <b>assistant teacher</b>. A partial index prevents any attempt to assign two teachers to the same position in one class.
                                                    </Typography>
                                                    <Divider />
                                                    <Stack direction="row" spacing={2}>
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
                                                                MAIN TEACHER SUBJECTS
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                                                English, Maths, Science, Social Studies, Art, History
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
                                                                ASSISTANT SUBJECTS
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                                                Amharic, General Science, Spoken English, Citizenship
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                </Stack>
                                            </Paper>
                                        </Stack>
                                    )}

                                    {heroTab === 2 && (
                                        <Stack spacing={2.5}>
                                            <Box>
                                                <Typography variant="h6" sx={{ fontWeight: 800, color: '#111827' }}>
                                                    Term 1 • Schemes of Work Workflow
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    14 teaching weeks scaffolded with supervisor review & feedback
                                                </Typography>
                                            </Box>

                                            <Stack spacing={1.5}>
                                                <Box sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff' }}>
                                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                            Week 4: Quadratic Algebraic Equations
                                                        </Typography>
                                                        <Chip label="Approved" color="success" size="small" sx={{ fontWeight: 700 }} />
                                                    </Stack>
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                                                        Submitted by Mathematics Main Teacher • Reviewed by Academic Coordinator
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff' }}>
                                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                            Week 5: Photosynthesis & Cellular Respiration
                                                        </Typography>
                                                        <Chip label="Submitted for Review" color="primary" size="small" sx={{ fontWeight: 700 }} />
                                                    </Stack>
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                                                        Submitted by Science Specialist • Awaiting supervisor feedback
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </Stack>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* --------------------------------------------------------------------- */}
            {/* AT A GLANCE KEY STATS STRIP                                           */}
            {/* --------------------------------------------------------------------- */}
            <Box sx={{ py: 6, bgcolor: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
                <Container maxWidth="xl">
                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card sx={{ bgcolor: '#f8fafc', height: '100%', border: '1px solid #e2e8f0' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#dbeafe', color: '#1e40af' }}>
                                            <ClassIcon sx={{ fontSize: 28 }} />
                                        </Box>
                                        <Box>
                                            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a' }}>
                                                12
                                            </Typography>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>
                                                Dedicated Classes
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        Covering Early Years Foundation Stage (EYFS) through Key Stage 4 at NOC Gerji Campus.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Card sx={{ bgcolor: '#f8fafc', height: '100%', border: '1px solid #e2e8f0' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#ccfbf1', color: '#0f766e' }}>
                                            <GroupsIcon sx={{ fontSize: 28 }} />
                                        </Box>
                                        <Box>
                                            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a' }}>
                                                2
                                            </Typography>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>
                                                Teachers per Class
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        Exactly one Main Teacher and one Assistant Teacher per homeroom, guaranteed by database index.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Card sx={{ bgcolor: '#f8fafc', height: '100%', border: '1px solid #e2e8f0' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f3e8ff', color: '#7e22ce' }}>
                                            <SpeedIcon sx={{ fontSize: 28 }} />
                                        </Box>
                                        <Box>
                                            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a' }}>
                                                14
                                            </Typography>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>
                                                Integrated Modules
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        Unified suite covering students, timetable, planning, marksheets, library, clinic, and notices.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Card sx={{ bgcolor: '#f8fafc', height: '100%', border: '1px solid #e2e8f0' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#ffedd5', color: '#c2410c' }}>
                                            <SecurityIcon sx={{ fontSize: 28 }} />
                                        </Box>
                                        <Box>
                                            <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a' }}>
                                                100%
                                            </Typography>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>
                                                Server-Side Rules
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        Grading scales (A*-F), 5 ETB/day fines, and clash prevention calculated safely on the backend.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* --------------------------------------------------------------------- */}
            {/* SYSTEM MODULES SHOWCASE (`#modules`)                                   */}
            {/* --------------------------------------------------------------------- */}
            <Box id="modules" sx={{ py: 10, bgcolor: 'background.default' }}>
                <Container maxWidth="xl">
                    <Stack spacing={2} textAlign="center" alignItems="center" sx={{ mb: 6 }}>
                        <Chip label="COMPLETE CAPABILITY SUITE" color="primary" sx={{ fontWeight: 700, fontSize: '0.75rem' }} />
                        <Typography variant="h3" sx={{ fontWeight: 900, color: '#111827', fontSize: { xs: '2rem', md: '2.5rem' } }}>
                            14 Specialized Modules Built for School Operations
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 720, fontSize: '1.05rem' }}>
                            Every tool is tailored to British International School NOC Gerji’s operational rules. Filter by category or explore individual workflows below.
                        </Typography>

                        {/* Filter chips */}
                        <Stack direction="row" spacing={1} sx={{ pt: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {[
                                { id: 'all', label: 'All Modules (14)' },
                                { id: 'academic', label: 'Academic & Teaching (5)' },
                                { id: 'safeguarding', label: 'Safeguarding & Welfare (4)' },
                                { id: 'staff', label: 'Staff & Operations (5)' },
                            ].map((tab) => (
                                <Button
                                    key={tab.id}
                                    variant={selectedCategory === tab.id ? 'contained' : 'outlined'}
                                    onClick={() => setSelectedCategory(tab.id)}
                                    sx={{
                                        borderRadius: 6,
                                        px: 2.5,
                                        py: 0.75,
                                        fontWeight: 700,
                                        textTransform: 'none',
                                        mb: { xs: 1, sm: 0 },
                                    }}
                                >
                                    {tab.label}
                                </Button>
                            ))}
                        </Stack>
                    </Stack>

                    {/* Module Cards Grid */}
                    <Grid container spacing={3}>
                        {filteredModules.map((mod) => (
                            <Grid item xs={12} sm={6} md={4} key={mod.id}>
                                <Card
                                    onClick={() => setSelectedModule(mod)}
                                    sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease-in-out',
                                        border: '1px solid #e5e7eb',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: '0 12px 30px -10px rgba(30, 64, 175, 0.18)',
                                            borderColor: mod.color,
                                        },
                                    }}
                                >
                                    <CardContent sx={{ p: 3 }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                                            <Box
                                                sx={{
                                                    width: 52,
                                                    height: 52,
                                                    borderRadius: 2.5,
                                                    bgcolor: `${mod.color}15`,
                                                    color: mod.color,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                {mod.icon}
                                            </Box>
                                            <Chip
                                                label={mod.categoryLabel}
                                                size="small"
                                                sx={{
                                                    bgcolor: '#f1f5f9',
                                                    color: '#475569',
                                                    fontWeight: 700,
                                                    fontSize: '0.68rem',
                                                }}
                                            />
                                        </Stack>

                                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                                            {mod.title}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#475569', mb: 2.5, lineHeight: 1.5 }}>
                                            {mod.summary}
                                        </Typography>

                                        <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px dashed #cbd5e1' }}>
                                            <Typography variant="caption" sx={{ fontWeight: 700, color: mod.color }}>
                                                SPEC RULE: {mod.specHighlight}
                                            </Typography>
                                        </Box>
                                    </CardContent>

                                    <Box
                                        sx={{
                                            px: 3,
                                            py: 1.75,
                                            bgcolor: '#f8fafc',
                                            borderTop: '1px solid #f1f5f9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }}
                                    >
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: mod.color }}>
                                            Explore Workflow & Specs
                                        </Typography>
                                        <ArrowForwardIcon sx={{ fontSize: 18, color: mod.color }} />
                                    </Box>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {/* --------------------------------------------------------------------- */}
            {/* MODULE DETAIL MODAL                                                    */}
            {/* --------------------------------------------------------------------- */}
            <Dialog
                open={Boolean(selectedModule)}
                onClose={() => setSelectedModule(null)}
                maxWidth="md"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                {selectedModule && (
                    <>
                        <DialogTitle sx={{ pb: 1, pt: 3, px: 3 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 2,
                                            bgcolor: `${selectedModule.color}15`,
                                            color: selectedModule.color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {selectedModule.icon}
                                    </Box>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                            {selectedModule.title}
                                        </Typography>
                                        <Chip
                                            label={selectedModule.categoryLabel}
                                            size="small"
                                            sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 700, mt: 0.5 }}
                                        />
                                    </Box>
                                </Stack>
                                <IconButton onClick={() => setSelectedModule(null)}>
                                    <CloseIcon />
                                </IconButton>
                            </Stack>
                        </DialogTitle>
                        <Divider sx={{ my: 1 }} />
                        <DialogContent sx={{ p: 3 }}>
                            <Stack spacing={3}>
                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>
                                        ARCHITECTURAL OVERVIEW
                                    </Typography>
                                    <Typography variant="body1" sx={{ color: '#111827', lineHeight: 1.6 }}>
                                        {selectedModule.description}
                                    </Typography>
                                </Box>

                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1.5 }}>
                                        CORE WORKFLOWS & BUSINESS RULES
                                    </Typography>
                                    <Stack spacing={1.25}>
                                        {selectedModule.workflows.map((wf, idx) => (
                                            <Stack direction="row" spacing={1.5} alignItems="flex-start" key={idx}>
                                                <CheckCircleIcon sx={{ fontSize: 20, color: 'primary.main', mt: 0.25 }} />
                                                <Typography variant="body2" sx={{ color: '#334155', fontWeight: 500 }}>
                                                    {wf}
                                                </Typography>
                                            </Stack>
                                        ))}
                                    </Stack>
                                </Box>

                                <Paper sx={{ p: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                                        <SecurityIcon sx={{ color: selectedModule.color }} />
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                            Role Permissions & Access Control
                                        </Typography>
                                    </Stack>
                                    <Typography variant="body2" sx={{ color: '#475569' }}>
                                        {selectedModule.permissions}
                                    </Typography>
                                </Paper>
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 3, pt: 1, justifyContent: 'space-between' }}>
                            <Chip
                                label={`Database Spec: ${selectedModule.specHighlight}`}
                                sx={{ bgcolor: '#eff6ff', color: '#1e40af', fontWeight: 700 }}
                            />
                            <Button
                                variant="contained"
                                component={RouterLink}
                                to={isAuthenticated ? '/app' : '/login'}
                                sx={{ fontWeight: 700 }}
                            >
                                {isAuthenticated ? 'Open Module in Portal' : 'Sign in to Access'}
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>

            {/* --------------------------------------------------------------------- */}
            {/* INTERACTIVE SYSTEM SIMULATORS (`#demo`)                                */}
            {/* --------------------------------------------------------------------- */}
            <Box id="demo" sx={{ py: 10, bgcolor: '#ffffff', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                <Container maxWidth="xl">
                    <Stack spacing={2} textAlign="center" alignItems="center" sx={{ mb: 6 }}>
                        <Chip label="TRY IT LIVE IN YOUR BROWSER" color="secondary" sx={{ fontWeight: 700, fontSize: '0.75rem' }} />
                        <Typography variant="h3" sx={{ fontWeight: 900, color: '#111827', fontSize: { xs: '2rem', md: '2.5rem' } }}>
                            Interactive Backend Logic Simulators
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 720, fontSize: '1.05rem' }}>
                            Test drive how our Express server-side algorithms derive grades, calculate overdue library fines, and prevent timetable double-bookings.
                        </Typography>
                    </Stack>

                    <Grid container spacing={4}>
                        {/* Simulator 1: Server-Side Grading Engine */}
                        <Grid item xs={12} md={4}>
                            <Card sx={{ height: '100%', border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: '#f8fafc' }}>
                                <CardContent sx={{ p: 3.5 }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#dbeafe', color: '#1e40af' }}>
                                            <CalculateIcon />
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                Marksheet Grading Engine
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Server-side percentage to grade mapping
                                            </Typography>
                                        </Box>
                                    </Stack>

                                    <Typography variant="body2" sx={{ color: '#475569', mb: 3 }}>
                                        Slide the percentage mark below to see how our Express backend instantly assigns the official British International School letter grade and GPA points.
                                    </Typography>

                                    <Box sx={{ px: 1, mb: 3 }}>
                                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                Raw Mark Score:
                                            </Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 900, color: '#1e40af' }}>
                                                {demoScore}%
                                            </Typography>
                                        </Stack>
                                        <Slider
                                            value={demoScore}
                                            onChange={(e, v) => setDemoScore(v)}
                                            min={0}
                                            max={100}
                                            step={1}
                                            valueLabelDisplay="auto"
                                            sx={{ color: '#1e40af' }}
                                        />
                                    </Box>

                                    <Paper
                                        sx={{
                                            p: 2.5,
                                            bgcolor: '#ffffff',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: 2.5,
                                            textAlign: 'center',
                                        }}
                                    >
                                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                                            DERIVED LETTER GRADE
                                        </Typography>
                                        <Typography
                                            variant="h2"
                                            sx={{
                                                fontWeight: 900,
                                                color: gradeInfo.color,
                                                my: 0.5,
                                                fontSize: '3rem',
                                            }}
                                        >
                                            {gradeInfo.grade}
                                        </Typography>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e293b' }}>
                                            {gradeInfo.desc}
                                        </Typography>
                                        <Divider sx={{ my: 1.5 }} />
                                        <Stack direction="row" justifyContent="space-around">
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">GPA Value</Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 800 }}>{gradeInfo.gpa} / 4.0</Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">Threshold</Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 800 }}>
                                                    {demoScore >= 90 ? '90-100%' : demoScore >= 80 ? '80-89%' : demoScore >= 70 ? '70-79%' : demoScore >= 60 ? '60-69%' : demoScore >= 50 ? '50-59%' : demoScore >= 40 ? '40-49%' : '0-39%'}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Paper>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Simulator 2: Library Fine Calculator */}
                        <Grid item xs={12} md={4}>
                            <Card sx={{ height: '100%', border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: '#f8fafc' }}>
                                <CardContent sx={{ p: 3.5 }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#ccfbf1', color: '#0f766e' }}>
                                            <LocalLibraryIcon />
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                Library Overdue Calculator
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Enforcing 5.00 ETB / Day overdue policy
                                            </Typography>
                                        </Box>
                                    </Stack>

                                    <Typography variant="body2" sx={{ color: '#475569', mb: 3 }}>
                                        Slide the number of overdue days to simulate how our library module automatically calculates student fines and enforces borrowing holds.
                                    </Typography>

                                    <Box sx={{ px: 1, mb: 3 }}>
                                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                Days Overdue:
                                            </Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f766e' }}>
                                                {demoOverdueDays} Days
                                            </Typography>
                                        </Stack>
                                        <Slider
                                            value={demoOverdueDays}
                                            onChange={(e, v) => setDemoOverdueDays(v)}
                                            min={0}
                                            max={25}
                                            step={1}
                                            valueLabelDisplay="auto"
                                            sx={{ color: '#0f766e' }}
                                        />
                                    </Box>

                                    <Paper
                                        sx={{
                                            p: 2.5,
                                            bgcolor: '#ffffff',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: 2.5,
                                            textAlign: 'center',
                                        }}
                                    >
                                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                                            AUTOMATED OVERDUE FINE
                                        </Typography>
                                        <Typography
                                            variant="h2"
                                            sx={{
                                                fontWeight: 900,
                                                color: demoOverdueDays > 0 ? '#b91c1c' : '#15803d',
                                                my: 0.5,
                                                fontSize: '3rem',
                                            }}
                                        >
                                            {calculatedFine.toFixed(2)} <Box component="span" sx={{ fontSize: '1.2rem' }}>ETB</Box>
                                        </Typography>
                                        <Chip
                                            label={demoOverdueDays === 0 ? 'Account in Good Standing' : 'Fine Outstanding • Holds Active'}
                                            color={demoOverdueDays === 0 ? 'success' : 'error'}
                                            size="small"
                                            sx={{ fontWeight: 700, mt: 0.5 }}
                                        />
                                        <Divider sx={{ my: 1.5 }} />
                                        <Stack direction="row" justifyContent="space-around">
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">Fine Rate</Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 800 }}>5.00 ETB / day</Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">Max Books</Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 800 }}>3 Active Loans</Typography>
                                            </Box>
                                        </Stack>
                                    </Paper>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Simulator 3: Timetable Clash Validator */}
                        <Grid item xs={12} md={4}>
                            <Card sx={{ height: '100%', border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: '#f8fafc' }}>
                                <CardContent sx={{ p: 3.5 }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#f3e8ff', color: '#7e22ce' }}>
                                            <CalendarMonthIcon />
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                Timetable Clash Preventer
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                PostgreSQL exclusion constraint simulator
                                            </Typography>
                                        </Box>
                                    </Stack>

                                    <Typography variant="body2" sx={{ color: '#475569', mb: 3 }}>
                                        Test our database clash prevention. Selecting an overlapping teacher slot simulates how PostgreSQL rejects double-bookings.
                                    </Typography>

                                    <Stack spacing={1.5} sx={{ mb: 3 }}>
                                        <Stack direction="row" spacing={1}>
                                            {['Monday', 'Tuesday', 'Wednesday'].map((day) => (
                                                <Button
                                                    key={day}
                                                    size="small"
                                                    variant={demoDay === day ? 'contained' : 'outlined'}
                                                    onClick={() => setDemoDay(day)}
                                                    sx={{ flex: 1, fontWeight: 700, textTransform: 'none' }}
                                                >
                                                    {day.slice(0, 3)}
                                                </Button>
                                            ))}
                                        </Stack>
                                        <Stack direction="row" spacing={1}>
                                            {[1, 2, 3].map((p) => (
                                                <Button
                                                    key={p}
                                                    size="small"
                                                    variant={demoPeriod === p ? 'contained' : 'outlined'}
                                                    onClick={() => {
                                                        setDemoPeriod(p);
                                                        setDemoClashSim(p === 2 && demoDay === 'Monday');
                                                    }}
                                                    sx={{ flex: 1, fontWeight: 700 }}
                                                >
                                                    Period {p}
                                                </Button>
                                            ))}
                                        </Stack>
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            size="small"
                                            startIcon={<WarningAmberIcon />}
                                            onClick={() => {
                                                setDemoDay('Monday');
                                                setDemoPeriod(2);
                                                setDemoClashSim(true);
                                            }}
                                            sx={{ fontWeight: 700, textTransform: 'none' }}
                                        >
                                            Simulate Double-Booking Attempt
                                        </Button>
                                    </Stack>

                                    <Paper
                                        sx={{
                                            p: 2.5,
                                            bgcolor: '#ffffff',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: 2.5,
                                            textAlign: 'center',
                                        }}
                                    >
                                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                                            DATABASE TRANSACTION STATUS
                                        </Typography>
                                        {demoClashSim ? (
                                            <Box sx={{ mt: 1 }}>
                                                <Chip
                                                    icon={<WarningAmberIcon sx={{ color: '#ffffff !important' }} />}
                                                    label="TRANSACTION REJECTED"
                                                    color="error"
                                                    sx={{ fontWeight: 800, mb: 1 }}
                                                />
                                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#b91c1c' }}>
                                                    PostgreSQL Constraint Error: Teacher already booked on {demoDay} Period {demoPeriod}.
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <Box sx={{ mt: 1 }}>
                                                <Chip
                                                    icon={<CheckCircleIcon sx={{ color: '#ffffff !important' }} />}
                                                    label="SLOT AVAILABLE • NO CLASH"
                                                    color="success"
                                                    sx={{ fontWeight: 800, mb: 1 }}
                                                />
                                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#15803d' }}>
                                                    {demoDay} Period {demoPeriod} is clear. Ready to book for Homeroom Class.
                                                </Typography>
                                            </Box>
                                        )}
                                        <Divider sx={{ my: 1.5 }} />
                                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                            Enforced at the SQL layer — zero chance of race conditions
                                        </Typography>
                                    </Paper>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* --------------------------------------------------------------------- */}
            {/* THE STAFFING MODEL SPOTLIGHT (`#staffing`)                            */}
            {/* --------------------------------------------------------------------- */}
            <Box id="staffing" sx={{ py: 10, bgcolor: 'background.default' }}>
                <Container maxWidth="xl">
                    <Grid container spacing={6} alignItems="center">
                        <Grid item xs={12} lg={6}>
                            <Stack spacing={3}>
                                <Chip label="THE BIS NOC GERJI STAFFING ARCHITECTURE" color="primary" sx={{ fontWeight: 700, alignSelf: 'flex-start', fontSize: '0.75rem' }} />
                                <Typography variant="h3" sx={{ fontWeight: 900, color: '#111827', fontSize: { xs: '2rem', md: '2.5rem' } }}>
                                    How Our Dual-Teacher & Subject Policy Model Works
                                </Typography>
                                <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: '1.05rem', lineHeight: 1.7 }}>
                                    At British International School NOC Gerji Campus, homeroom pastoral care and subject teaching follow clear, database-enforced rules.
                                </Typography>

                                <Stack spacing={2} sx={{ pt: 1 }}>
                                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #cbd5e1', bgcolor: '#ffffff' }}>
                                        <Stack direction="row" spacing={2}>
                                            <Box sx={{ color: 'primary.main', mt: 0.25 }}>
                                                <ClassIcon sx={{ fontSize: 28 }} />
                                            </Box>
                                            <Box>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                                    1. Exactly One Main & One Assistant Teacher Per Class
                                                </Typography>
                                                <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
                                                    Every class from EYFS to Key Stage 4 has two dedicated teachers. The Main Teacher runs morning registers and pastoral leadership; the Assistant Teacher supports homeroom management and targeted interventions.
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Paper>

                                    <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid #cbd5e1', bgcolor: '#ffffff' }}>
                                        <Stack direction="row" spacing={2}>
                                            <Box sx={{ color: 'secondary.main', mt: 0.25 }}>
                                                <MenuBookIcon sx={{ fontSize: 28 }} />
                                            </Box>
                                            <Box>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                                    2. School-Wide Subject Delivery Policy
                                                </Typography>
                                                <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
                                                    Subjects are defined once in a school-wide catalogue and tagged by who normally delivers them. When a class is staffed, core subjects automatically assign to the Main Teacher and supporting subjects to the Assistant Teacher.
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Paper>
                                </Stack>
                            </Stack>
                        </Grid>

                        {/* Interactive Subject Delivery Explorer Card */}
                        <Grid item xs={12} lg={6}>
                            <Card sx={{ border: '1px solid #cbd5e1', borderRadius: 3, bgcolor: '#ffffff', overflow: 'hidden' }}>
                                <Box sx={{ p: 3, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                        Subject Delivery Policy Matrix
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Click a policy category to explore how subjects are distributed across staff
                                    </Typography>
                                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                                        {[
                                            { id: 'all', label: 'All (14)' },
                                            { id: 'main', label: 'Main Teacher' },
                                            { id: 'assistant', label: 'Assistant Teacher' },
                                            { id: 'specialist', label: 'Specialist Teacher' },
                                        ].map((btn) => (
                                            <Button
                                                key={btn.id}
                                                size="small"
                                                variant={staffingFilter === btn.id ? 'contained' : 'outlined'}
                                                onClick={() => setStaffingFilter(btn.id)}
                                                sx={{ fontWeight: 700, textTransform: 'none' }}
                                            >
                                                {btn.label}
                                            </Button>
                                        ))}
                                    </Stack>
                                </Box>

                                <CardContent sx={{ p: 3 }}>
                                    <Grid container spacing={2}>
                                        {[
                                            { name: 'English Language', type: 'main', badge: 'Main Teacher', color: '#1e40af' },
                                            { name: 'Mathematics', type: 'main', badge: 'Main Teacher', color: '#1e40af' },
                                            { name: 'Integrated Science', type: 'main', badge: 'Main Teacher', color: '#1e40af' },
                                            { name: 'Social Studies', type: 'main', badge: 'Main Teacher', color: '#1e40af' },
                                            { name: 'Art & Design', type: 'main', badge: 'Main Teacher', color: '#1e40af' },
                                            { name: 'History', type: 'main', badge: 'Main Teacher', color: '#1e40af' },
                                            { name: 'Amharic Language', type: 'assistant', badge: 'Assistant Teacher', color: '#0f766e' },
                                            { name: 'General Science Support', type: 'assistant', badge: 'Assistant Teacher', color: '#0f766e' },
                                            { name: 'Spoken English', type: 'assistant', badge: 'Assistant Teacher', color: '#0f766e' },
                                            { name: 'Citizenship & Ethics', type: 'assistant', badge: 'Assistant Teacher', color: '#0f766e' },
                                            { name: 'ICT & Computing', type: 'specialist', badge: 'Specialist Teacher', color: '#7e22ce' },
                                            { name: 'Physical Education', type: 'specialist', badge: 'Specialist Teacher', color: '#7e22ce' },
                                            { name: 'Music & Performance', type: 'specialist', badge: 'Specialist Teacher', color: '#7e22ce' },
                                            { name: 'French Language', type: 'specialist', badge: 'Specialist Teacher', color: '#7e22ce' },
                                        ]
                                            .filter((s) => staffingFilter === 'all' || s.type === staffingFilter)
                                            .map((subj, idx) => (
                                                <Grid item xs={12} sm={6} key={idx}>
                                                    <Paper
                                                        sx={{
                                                            p: 2,
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: 2,
                                                            bgcolor: '#f8fafc',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#111827' }}>
                                                            {subj.name}
                                                        </Typography>
                                                        <Chip
                                                            label={subj.badge}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: `${subj.color}15`,
                                                                color: subj.color,
                                                                fontWeight: 700,
                                                                fontSize: '0.65rem',
                                                            }}
                                                        />
                                                    </Paper>
                                                </Grid>
                                            ))}
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* --------------------------------------------------------------------- */}
            {/* CAMPUS LIFE & FACILITIES (`#campus`)                                   */}
            {/* --------------------------------------------------------------------- */}
            <Box id="campus" sx={{ py: 10, bgcolor: '#ffffff', borderTop: '1px solid #e5e7eb' }}>
                <Container maxWidth="xl">
                    <Stack spacing={2} textAlign="center" alignItems="center" sx={{ mb: 6 }}>
                        <Chip label="NOC GERJI CAMPUS • ADDIS ABABA" color="primary" sx={{ fontWeight: 700, fontSize: '0.75rem' }} />
                        <Typography variant="h3" sx={{ fontWeight: 900, color: '#111827', fontSize: { xs: '2rem', md: '2.5rem' } }}>
                            Empowering Academic Excellence & Student Wellbeing
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 720, fontSize: '1.05rem' }}>
                            Our management platform integrates seamlessly into the daily life of British International School NOC Gerji Campus.
                        </Typography>
                    </Stack>

                    <Grid container spacing={4}>
                        {[
                            {
                                title: 'British Curriculum Standard',
                                subtitle: 'EYFS to Key Stage 4',
                                icon: <PublicIcon />,
                                desc: 'Delivering world-class British international education structured across Early Years, Primary, and Secondary key stages with rigorous academic tracking.',
                                color: '#1e40af',
                            },
                            {
                                title: 'Integrated Safeguarding',
                                subtitle: 'SEN & Medical Alerts',
                                icon: <HealthAndSafetyIcon />,
                                desc: 'Confidential special educational needs flags, guardian contacts, and clinic visit auditing protect every child on campus.',
                                color: '#be123c',
                            },
                            {
                                title: 'Digital Library Services',
                                subtitle: 'Automated Fines & 3-Book Limit',
                                icon: <LocalLibraryIcon />,
                                desc: 'Automated circulation tracking encourages reading while maintaining fairness with 5.00 ETB/day overdue policies and borrowing limits.',
                                color: '#0f766e',
                            },
                            {
                                title: 'Staff Operational Clarity',
                                subtitle: 'Threaded Messages & Tasks',
                                icon: <ForumIcon />,
                                desc: 'Structured admin-to-teacher conversations, task assignments, and targeted notices ensure seamless staff coordination.',
                                color: '#7e22ce',
                            },
                        ].map((item, idx) => (
                            <Grid item xs={12} sm={6} md={3} key={idx}>
                                <Card sx={{ height: '100%', border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: '#f8fafc' }}>
                                    <CardContent sx={{ p: 3.5 }}>
                                        <Box
                                            sx={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 2,
                                                bgcolor: `${item.color}15`,
                                                color: item.color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                mb: 2.5,
                                            }}
                                        >
                                            {item.icon}
                                        </Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                                            {item.title}
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontWeight: 700, color: item.color, display: 'block', mb: 1.5 }}>
                                            {item.subtitle}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6 }}>
                                            {item.desc}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {/* --------------------------------------------------------------------- */}
            {/* FREQUENTLY ASKED QUESTIONS (`#faq`)                                    */}
            {/* --------------------------------------------------------------------- */}
            <Box id="faq" sx={{ py: 10, bgcolor: 'background.default', borderTop: '1px solid #e5e7eb' }}>
                <Container maxWidth="md">
                    <Stack spacing={2} textAlign="center" alignItems="center" sx={{ mb: 6 }}>
                        <Chip label="ANSWERS & GUIDANCE" color="secondary" sx={{ fontWeight: 700, fontSize: '0.75rem' }} />
                        <Typography variant="h3" sx={{ fontWeight: 900, color: '#111827', fontSize: { xs: '2rem', md: '2.5rem' } }}>
                            Frequently Asked Questions
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: '1.05rem' }}>
                            Everything you need to know about accessing and using the BIS NOC Gerji school management system.
                        </Typography>
                    </Stack>

                    <Stack spacing={2}>
                        {FAQS_DATA.map((faq, idx) => (
                            <Accordion
                                key={idx}
                                elevation={0}
                                sx={{
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '12px !important',
                                    bgcolor: '#ffffff',
                                    '&:before': { display: 'none' },
                                    overflow: 'hidden',
                                }}
                            >
                                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 3, py: 1 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                        {faq.q}
                                    </Typography>
                                </AccordionSummary>
                                <Divider />
                                <AccordionDetails sx={{ px: 3, py: 2.5, bgcolor: '#f8fafc' }}>
                                    <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.7 }}>
                                        {faq.a}
                                    </Typography>
                                </AccordionDetails>
                            </Accordion>
                        ))}
                    </Stack>
                </Container>
            </Box>

            {/* --------------------------------------------------------------------- */}
            {/* CALL TO ACTION BOTTOM BANNER                                          */}
            {/* --------------------------------------------------------------------- */}
            <Box
                sx={{
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #0f766e 100%)',
                    color: 'white',
                    py: 10,
                    textAlign: 'center',
                }}
            >
                <Container maxWidth="md">
                    <SchoolIcon sx={{ fontSize: 56, color: '#6ee7b7', mb: 2 }} />
                    <Typography variant="h3" sx={{ fontWeight: 900, mb: 2, fontSize: { xs: '2.2rem', md: '2.8rem' } }}>
                        Ready to Access Your Classroom Portal?
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.88)', mb: 4, fontWeight: 400, maxWidth: 600, mx: 'auto' }}>
                        Sign in to manage your homeroom, submit lesson plans, record attendance, and access student safeguarding records.
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        component={RouterLink}
                        to={isAuthenticated ? '/app' : '/login'}
                        endIcon={<ArrowForwardIcon />}
                        sx={{
                            bgcolor: '#ffffff',
                            color: '#1e3a8a',
                            '&:hover': { bgcolor: '#f3f4f6' },
                            fontWeight: 800,
                            px: 5,
                            py: 2,
                            fontSize: '1.1rem',
                            borderRadius: 2,
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                        }}
                    >
                        {isAuthenticated ? 'Open Staff Dashboard' : 'Sign in to Staff Portal'}
                    </Button>
                </Container>
            </Box>

            {/* --------------------------------------------------------------------- */}
            {/* FOOTER                                                                 */}
            {/* --------------------------------------------------------------------- */}
            <Box sx={{ bgcolor: '#0f172a', color: '#94a3b8', py: 6 }}>
                <Container maxWidth="xl">
                    <Grid container spacing={4} justifyContent="space-between">
                        <Grid item xs={12} md={5}>
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                                <Box
                                    sx={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: 2,
                                        bgcolor: 'primary.main',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                    }}
                                >
                                    <SchoolIcon sx={{ fontSize: 22 }} />
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 800, color: '#ffffff' }}>
                                    British International School
                                </Typography>
                            </Stack>
                            <Typography variant="body2" sx={{ color: '#94a3b8', maxWidth: 400, lineHeight: 1.6, mb: 2 }}>
                                NOC Gerji Campus • Addis Ababa, Ethiopia. An integrated school management platform enforcing academic excellence, safeguarding, and dual-teacher accountability.
                            </Typography>
                            <Chip label="MERN Stack • React 18 • Express 4 • Supabase PostgreSQL" size="small" sx={{ bgcolor: '#1e293b', color: '#cbd5e1', fontWeight: 600, fontSize: '0.7rem' }} />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Grid container spacing={3}>
                                <Grid item xs={6} sm={4}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#ffffff', mb: 2 }}>
                                        NAVIGATION
                                    </Typography>
                                    <Stack spacing={1.25}>
                                        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#ffffff' } }} onClick={() => handleScrollTo('overview')}>
                                            Overview
                                        </Typography>
                                        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#ffffff' } }} onClick={() => handleScrollTo('modules')}>
                                            System Modules
                                        </Typography>
                                        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#ffffff' } }} onClick={() => handleScrollTo('demo')}>
                                            Simulators
                                        </Typography>
                                        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#ffffff' } }} onClick={() => handleScrollTo('staffing')}>
                                            Staffing Model
                                        </Typography>
                                        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#ffffff' } }} onClick={() => handleScrollTo('campus')}>
                                            Campus Life
                                        </Typography>
                                        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#ffffff' } }} onClick={() => handleScrollTo('faq')}>
                                            FAQs
                                        </Typography>
                                    </Stack>
                                </Grid>

                                <Grid item xs={6} sm={4}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#ffffff', mb: 2 }}>
                                        ACADEMIC MODULES
                                    </Typography>
                                    <Stack spacing={1.25}>
                                        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#ffffff' } }} onClick={() => handleScrollTo('modules')}>
                                            Students & Classes
                                        </Typography>
                                        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#ffffff' } }} onClick={() => handleScrollTo('modules')}>
                                            Lesson Schemes
                                        </Typography>
                                        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#ffffff' } }} onClick={() => handleScrollTo('modules')}>
                                            Timetable Grid
                                        </Typography>
                                        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#ffffff' } }} onClick={() => handleScrollTo('modules')}>
                                            Marksheets & Grading
                                        </Typography>
                                        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: '#ffffff' } }} onClick={() => handleScrollTo('modules')}>
                                            Attendance Registers
                                        </Typography>
                                    </Stack>
                                </Grid>

                                <Grid item xs={12} sm={4}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#ffffff', mb: 2 }}>
                                        PORTAL ACCESS
                                    </Typography>
                                    <Stack spacing={1.25}>
                                        <Typography variant="body2" component={RouterLink} to="/login" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: '#ffffff' } }}>
                                            Staff Portal Login
                                        </Typography>
                                        <Typography variant="body2" component={RouterLink} to="/app" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: '#ffffff' } }}>
                                            Staff Dashboard
                                        </Typography>
                                        <Typography variant="body2" component={RouterLink} to="/app/messages" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: '#ffffff' } }}>
                                            Staff Messaging
                                        </Typography>
                                        <Typography variant="body2" component={RouterLink} to="/app/notices" sx={{ color: '#94a3b8', textDecoration: 'none', '&:hover': { color: '#ffffff' } }}>
                                            Campus Notices
                                        </Typography>
                                    </Stack>
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 4, borderColor: '#1e293b' }} />

                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                            © {new Date().getFullYear()} British International School — NOC Gerji Campus. All rights reserved.
                        </Typography>
                        <Stack direction="row" spacing={2}>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                                System Privacy & Security
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                                Admin Portal Provisioning
                            </Typography>
                        </Stack>
                    </Stack>
                </Container>
            </Box>
        </Box>
    );
}
