import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    CircularProgress,
    Alert,
    Button,
    Divider,
    Chip,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { datacenterApi } from '../api/endpoints';

export default function DataCenter() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await datacenterApi.getStats();
                setStats(data);
            } catch (err) {
                setError(err.message || 'Failed to load statistics');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const handleDownloadExcel = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/datacenter/stats?download=excel`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('bisnoc.token')}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to download');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'school_statistics.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            setError(err.message || 'Failed to download Excel file');
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
                School Data Center
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Public statistics and analytics for British International School — NOC Gerji Campus
            </Typography>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            School Overview
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={handleDownloadExcel}
                            sx={{ textTransform: 'none' }}
                        >
                            Download Excel
                        </Button>
                    </Box>
                    <Divider sx={{ my: 2 }} />

                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6} md={4}>
                            <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Total Students
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 700, my: 1 }}>
                                    {stats?.totalStudents ?? 0}
                                </Typography>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Total Classes
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 700, my: 1 }}>
                                    {stats?.totalClasses ?? 0}
                                </Typography>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Total Subjects
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 700, my: 1 }}>
                                    {stats?.totalSubjects ?? 0}
                                </Typography>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={4}>
                            <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Male Students
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 700, my: 1, color: 'primary.main' }}>
                                    {stats?.maleStudents ?? 0}
                                </Typography>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Female Students
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 700, my: 1, color: 'secondary.main' }}>
                                    {stats?.femaleStudents ?? 0}
                                </Typography>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Other Gender Students
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 700, my: 1 }}>
                                    {stats?.otherGenderStudents ?? 0}
                                </Typography>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                    Teachers by Role
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {stats?.teachersByRole && Object.entries(stats.teachersByRole).map(([role, count]) => (
                                        <Chip
                                            key={role}
                                            label={`${role.replace('_', ' ')}: ${count}`}
                                            variant="outlined"
                                            sx={{ fontWeight: 600 }}
                                        />
                                    ))}
                                    {!stats?.teachersByRole || Object.keys(stats.teachersByRole || {}).length === 0 && (
                                        <Typography variant="body2" color="text.secondary">
                                            No teacher data available
                                        </Typography>
                                    )}
                                </Box>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Card variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                    Total Teaching Staff
                                </Typography>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                    {stats?.totalTeachers ?? 0}
                                </Typography>
                            </Card>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                British International School — NOC Gerji Campus | Internal Staff Use Only
            </Typography>
        </Box>
    );
}
