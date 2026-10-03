import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import BadgeIcon from '@mui/icons-material/Badge';
import ClassIcon from '@mui/icons-material/Class';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import GroupsIcon from '@mui/icons-material/Groups';
import PageHeader from '../components/PageHeader';
import Staff from './Staff';
import Assignments from './Assignments';

const TABS = [
    { value: 'staff', label: 'Staff', icon: <BadgeIcon fontSize="small" /> },
    { value: 'class-staffing', label: 'Class Staffing', icon: <ClassIcon fontSize="small" /> },
    { value: 'subject-teaching', label: 'Subject Teaching', icon: <MenuBookIcon fontSize="small" /> },
    { value: 'workload', label: 'Workload', icon: <AssignmentIndIcon fontSize="small" /> },
    { value: 'student-placement', label: 'Student Placement', icon: <GroupsIcon fontSize="small" /> },
];

export default function StaffAssignment() {
    const [tab, setTab] = useState('staff');

    return (
        <>
            <PageHeader
                title="Staff Assignment"
                subtitle="Manage staff accounts, class staffing, subject teaching and student placement."
            />
            <Tabs
                value={tab}
                onChange={(_, next) => setTab(next)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                aria-label="Staff assignment sections"
                sx={{
                    mb: 2.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                    minHeight: 46,
                    '& .MuiTab-root': { minHeight: 46, textTransform: 'none', fontWeight: 700 },
                }}
            >
                {TABS.map((item) => (
                    <Tab key={item.value} value={item.value} label={item.label} icon={item.icon} iconPosition="start" />
                ))}
            </Tabs>

            <Box>
                {tab === 'staff' && <Staff embedded />}
                {tab !== 'staff' && <Assignments embedded activeTab={tab} />}
            </Box>
        </>
    );
}
