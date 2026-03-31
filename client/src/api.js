import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

// Auth API
export const authAPI = {
    login: (credentials) => api.post('/auth/login', credentials),
    verify: () => api.get('/auth/verify'),
    changePassword: (data) => api.post('/auth/change-password', data),
};

// Users API (Admin)
export const usersAPI = {
    getAll: () => api.get('/users'),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`),
};

// Groups API
export const groupsAPI = {
    getAll: () => api.get('/groups'),
    getById: (id) => api.get(`/groups/${id}`),
    create: (data) => api.post('/groups', data),
    update: (id, data) => api.put(`/groups/${id}`, data),
    delete: (id) => api.delete(`/groups/${id}`),
};

// Employees API
export const employeesAPI = {
    getAll: (params) => api.get('/employees', { params }),
    getById: (id) => api.get(`/employees/${id}`),
    create: (data) => api.post('/employees', data),
    update: (id, data) => api.put(`/employees/${id}`, data),
    delete: (id) => api.delete(`/employees/${id}`),
};

// Attendance API
export const attendanceAPI = {
    getAll: (params) => api.get('/attendance', { params }),
    getByEmployeeAndDate: (employeeId, date) =>
        api.get(`/attendance/employee/${employeeId}/date/${date}`),
    create: (data) => api.post('/attendance', data),
    bulkCreate: (records) => api.post('/attendance/bulk', { records }),
    delete: (id) => api.delete(`/attendance/${id}`),
    getMonthlySummary: (month) =>
        api.get('/attendance/summary/monthly', { params: { month } }),
};

// Projects API
export const projectsAPI = {
    getAll: () => api.get('/projects'),
    getMatrix: () => api.get(`/projects/matrix?_t=${Date.now()}`),
    create: (data) => api.post('/projects', data),
    update: (id, data) => api.put(`/projects/${id}`, data),
    delete: (id) => api.delete(`/projects/${id}`),
    assignMember: (projectId, data) => api.post(`/projects/${projectId}/assign`, data),
    updateAssignment: (id, data) => api.put(`/projects/assignments/${id}`, data),
    removeMember: (assignmentId) => api.delete(`/projects/assignments/${assignmentId}`),
    updateAllocation: (data) => api.post('/projects/allocations', data),
    updateAllocationBatch: (updates) => api.post('/projects/allocations/batch', { updates }),
    reorderProjects: (projectIds) => api.put('/projects/reorder', { projectIds }),
    reorderMembers: (assignmentIds) => api.put('/projects/assignments/reorder', { assignmentIds }),
};

// Project Reports API
export const projectReportsAPI = {
    getByDate: (date) => api.get(`/project-reports/${date}`),
    save: (data) => api.post('/project-reports', data),
    updateAllColumnWidths: (columnWidths) => api.post('/project-reports/update-all-column-widths', { columnWidths }),
    syncProjectField: (projectName, field, value) => api.post('/project-reports/sync-project-field', { projectName, field, value }),
};

// Integrations API
export const integrationsAPI = {
    getAll: () => api.get('/integrations'),
    create: (data) => api.post('/integrations', data),
    update: (id, data) => api.put(`/integrations/${id}`, data),
    delete: (id) => api.delete(`/integrations/${id}`),
};

// Dashboard API
export const dashboardAPI = {
    getStats: () => api.get('/dashboard/stats'),
    health: () => api.get('/health'),
};

// Sales API
export const salesAPI = {
    get: () => api.get('/sales'),
    save: (data) => api.post('/sales', data)
};

export default api;
