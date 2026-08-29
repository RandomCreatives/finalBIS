import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Container, Dialog, DialogActions,
    DialogContent, InputAdornment, TextField, Typography, useTheme, Grid, Chip, IconButton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SchoolIcon from '@mui/icons-material/School';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useColorScheme } from '../theme';
import {
    CLASSES, passwordFor, saveClassLogin, slugFor,
} from '../data/classes';

/*
 * Public, login-free view of the school's classes.
 *
 * The roster mirrors Year_3_and_Year_4_Class_Teachers.csv and lives in
 * src/data/classes.js. Each class card carries a main-teacher login: a
 * popup dialog welcomes the teacher by name, and — for now, while the real
 * sign-in is being redesigned — the password is the class name itself
 * (e.g. "year 3 blue"). A correct password opens the class's teacher home.
 */

function ClassCard({ klass, onLogin }) {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';

    return (
        <Card variant="outlined" sx={{ height: '100%', borderRadius: 1, bgcolor: surface,
            borderColor: border,
            transition: 'transform .18s, border-color .18s, box-shadow .18s',
            '&:hover': {
                transform: 'translateY(-4px)', borderColor: 'primary.main',
                boxShadow: dark ? '0 16px 40px rgba(0,0,0,.4)' : '0 16px 40px rgba(15,23,42,.08)',
            } }}>
            <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{ width: 42, height: 42, borderRadius: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                        <SchoolIcon />
                    </Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{klass.name}</Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                                textTransform: 'uppercase', letterSpacing: .5 }}>
                                Main Teacher
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {klass.mainTeacher || 'Not assigned'}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                                textTransform: 'uppercase', letterSpacing: .5 }}>
                                Assistant Teacher
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {klass.assistantTeacher || 'Not assigned'}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mt: .5 }}>
                        <GroupsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                                textTransform: 'uppercase', letterSpacing: .5 }}>
                                Students
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {klass.studentCount}
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                <Button
                    fullWidth size="small" variant="outlined"
                    startIcon={<LockIcon sx={{ fontSize: 16 }} />}
                    onClick={() => onLogin(klass)}
                    sx={{ mt: 2.5, fontWeight: 700, borderRadius: 1, textTransform: 'none' }}>
                    {klass.mainTeacher ? 'Main Teacher Login' : 'Teacher Login'}
                </Button>
            </CardContent>
        </Card>
    );
}

export default function PublicClasses() {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const { toggleColorScheme } = useColorScheme();
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';
    const navigate = useNavigate();

    // Per-class main-teacher login dialog state.
    const [loginClass, setLoginClass] = useState(null);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState('');

    const openLogin = (klass) => {
        setLoginClass(klass);
        setPassword('');
        setShowPassword(false);
        setLoginError('');
    };

    const closeLogin = () => setLoginClass(null);

    const submitLogin = (e) => {
        e.preventDefault();
        if (!loginClass) return;

        if (password.trim().toLowerCase() === passwordFor(loginClass.name)) {
            saveClassLogin(loginClass);
            navigate(`/class-home/${slugFor(loginClass.name)}`);
        } else {
            setLoginError('That password is not correct for this class.');
        }
    };

    const year3 = CLASSES.filter((c) => c.yearLevel === 3);
    const year4 = CLASSES.filter((c) => c.yearLevel === 4);

    const renderGroup = (title, list) => (
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                    {title}
                </Typography>
                <Chip label={`${list.length} classes`} size="small"
                    sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main' }} />
            </Box>
            <Grid container spacing={2.5}>
                {list.map((klass) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={klass.id}>
                        <ClassCard klass={klass} onLogin={openLogin} />
                    </Grid>
                ))}
            </Grid>
        </Box>
    );

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
            bgcolor: 'background.default', color: 'text.primary' }}>
            {/* ── header ── */}
            <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 100,
                borderBottom: `1px solid ${border}`, bgcolor: alpha(surface, 0.9),
                backdropFilter: 'blur(12px)' }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        minHeight: 68, gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: 'primary.main',
                                color: '#fff', display: 'flex', alignItems: 'center',
                                justifyContent: 'center' }}>
                                <SchoolIcon />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.1 }}>
                                    BIS NOC Gerji
                                </Typography>
                                <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary',
                                    letterSpacing: .5 }}>
                                    British International School
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Button component={RouterLink} to="/" variant="outlined" size="small"
                                startIcon={<ArrowBackIcon />} sx={{ fontWeight: 700, borderRadius: 1,
                                    px: 2, textTransform: 'none' }}>
                                Back
                            </Button>
                            <Box onClick={toggleColorScheme} sx={{ display: 'flex', alignItems: 'center',
                                justifyContent: 'center', width: 38, height: 38, borderRadius: 2,
                                border: `1px solid ${border}`, cursor: 'pointer', color: 'text.secondary',
                                '&:hover': { color: 'primary.main', borderColor: 'primary.main' } }}
                                aria-label="Toggle theme">
                                {dark
                                    ? <LightModeIcon sx={{ fontSize: 18 }} />
                                    : <DarkModeIcon  sx={{ fontSize: 18 }} />}
                            </Box>
                            <Button component={RouterLink} to="/login" variant="contained" size="small"
                                startIcon={<LoginIcon />} sx={{ fontWeight: 700, borderRadius: 2, px: 2.5,
                                    textTransform: 'none' }}>
                                Sign In
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── content ── */}
            <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
                <Box sx={{ mb: { xs: 5, md: 7 } }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                        Classes
                    </Typography>
                    <Typography sx={{ mt: 1.5, color: 'text.secondary', maxWidth: 600 }}>
                        The {CLASSES.length} homeroom groups at British International School, Gerji
                        Primary II — {year3.length} in Year 3 and {year4.length} in Year 4.
                    </Typography>
                </Box>

                {renderGroup('Year 3', year3)}
                {renderGroup('Year 4', year4)}
            </Container>

            {/* ── main-teacher login dialog ── */}
            <Dialog open={Boolean(loginClass)} onClose={closeLogin} maxWidth="xs" fullWidth
                PaperProps={{ sx: { borderRadius: 2, p: 1 } }}>
                {loginClass && (loginClass.mainTeacher ? (
                    <form onSubmit={submitLogin}>
                        <DialogContent sx={{ pt: 3.5, textAlign: 'center' }}>
                            <Box sx={{ width: 56, height: 56, borderRadius: '50%', mx: 'auto', mb: 2,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                                <SchoolIcon />
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                Welcome, {loginClass.mainTeacher}
                            </Typography>
                            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: .5 }}>
                                Main Teacher · {loginClass.name}
                            </Typography>

                            <TextField
                                autoFocus type={showPassword ? 'text' : 'password'}
                                label="Class password" fullWidth size="small" sx={{ mt: 2.5 }}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
                                error={Boolean(loginError)}
                                helperText={loginError || 'Hint (for now): the password is the class name — e.g. “year 3 blue”.'}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => setShowPassword((v) => !v)}
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                                {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                            <Button onClick={closeLogin} sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="contained" disableElevation
                                disabled={!password.trim()}
                                sx={{ fontWeight: 700, textTransform: 'none', px: 3 }}>
                                Sign In
                            </Button>
                        </DialogActions>
                    </form>
                ) : (
                    <>
                        <DialogContent sx={{ pt: 3.5, textAlign: 'center' }}>
                            <Box sx={{ width: 56, height: 56, borderRadius: '50%', mx: 'auto', mb: 2,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: alpha(theme.palette.warning.main, 0.12), color: 'warning.main' }}>
                                <PersonIcon />
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>{loginClass.name}</Typography>
                            <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
                                No main teacher has been assigned to this class yet. The teacher login
                                opens as soon as the school assigns one.
                            </Alert>
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 2.5 }}>
                            <Button onClick={closeLogin} variant="contained" disableElevation
                                sx={{ fontWeight: 700, textTransform: 'none', px: 3 }}>
                                Close
                            </Button>
                        </DialogActions>
                    </>
                ))}
            </Dialog>

            {/* ── footer ── */}
            <Box sx={{ py: 4, borderTop: `1px solid ${border}`, bgcolor: surface, mt: 'auto' }}>
                <Container maxWidth="lg">
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>
                        &copy; {new Date().getFullYear()} British International School, Gerji Primary II
                        &nbsp;·&nbsp; Internal Staff Use Only
                    </Typography>
                </Container>
            </Box>
        </Box>
    );
}
