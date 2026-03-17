import React from 'react';
import { Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, Settings as SettingsIcon, UserCircle, LogOut, TrendingUp } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Dashboard from './components/Dashboard';
import SalesStatus from './components/SalesStatus';
import EmployeeList from './components/EmployeeList';
import GroupManager from './components/GroupManager';
import Settings from './components/Settings';
import ProjectStatus from './components/ProjectStatus';
import Login from './pages/Login';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, info: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        this.setState({ info });
        console.error('ErrorBoundary caught:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', color: 'red', background: '#fff0f0', margin: '2rem', borderRadius: '8px', border: '1px solid red' }}>
                    <h2>⚠️ 렌더링 에러 발생</h2>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85em' }}>{this.state.error?.toString()}</pre>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.75em', color: '#666' }}>{this.state.info?.componentStack}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

// Protected Route Component
const ProtectedRoute = ({ children, requireAdmin }) => {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requireAdmin && user.role !== 'Admin') {
        return <Navigate to="/" replace />;
    }

    return children;
};

// Main Layout Component
const MainLayout = () => {
    const { user, logout } = useAuth();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="app">
            <nav className="navbar">
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <Link to="/" className="navbar-brand">
                            <span><UserCircle size={28} /></span>
                            <span>Workforce Status</span>
                        </Link>
                        <ul className="navbar-nav">
                            <li>
                                <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                                    <LayoutDashboard size={18} />
                                    <span>대시보드</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/sales" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                    <TrendingUp size={18} />
                                    <span>영업현황</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/projects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                    <Briefcase size={18} />
                                    <span>프로젝트 배정</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/groups" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                    <Users size={18} />
                                    <span>그룹 관리</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/employees" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                    <Users size={18} />
                                    <span>직원 관리</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                    <SettingsIcon size={18} />
                                    <span>설정</span>
                                </NavLink>
                            </li>
                        </ul>
                    </div>
                    {/* User Profile & Logout */}
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-700/50 gap-2 items-center">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="text-gray-300 font-medium">{user.name}</span>
                            <span className="text-gray-500 text-xs px-1.5 py-0.5 bg-gray-800 rounded">{user.role === 'Admin' ? '관리자' : '그룹장'}</span>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
                            title="로그아웃"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </nav>

            <main>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/sales" element={<SalesStatus />} />
                    <Route path="/employees" element={<EmployeeList />} />
                    <Route path="/groups" element={<GroupManager />} />
                    <Route path="/projects" element={<ErrorBoundary><ProjectStatus /></ErrorBoundary>} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </main>
        </div>
    );
};

export { ErrorBoundary, ProtectedRoute, MainLayout };
