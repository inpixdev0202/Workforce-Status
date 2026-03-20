import React, { useState, useRef } from 'react';
import { Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, Settings as SettingsIcon, UserCircle, LogOut, TrendingUp, ChevronDown } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Dashboard from './components/Dashboard';
import SalesStatus from './components/SalesStatus';
import EmployeeList from './components/EmployeeList';
import GroupManager from './components/GroupManager';
import Settings from './components/Settings';
import ProjectStatus from './components/ProjectStatus';
import ProjectReport from './components/ProjectReport';
import Login from './pages/Login';
import { MENU_ITEMS, hasAccess, ROLES } from './constants/menuConfig';

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

const ProjectsPage = () => (
    <ErrorBoundary>
        <ProjectStatus />
    </ErrorBoundary>
);

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !hasAccess(user, { allowedRoles, permissionKey: location.pathname.substring(1) })) {
        return <Navigate to="/" replace />;
    }

    return children;
};

// Main Layout Component
const MainLayout = () => {
    const { user, logout } = useAuth();
    const [openDropdown, setOpenDropdown] = useState(null);
    const timeoutRef = useRef(null);

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const handleMouseEnter = (itemId) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setOpenDropdown(itemId);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => setOpenDropdown(null), 150);
    };

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
                            {MENU_ITEMS.filter(item => hasAccess(user, item)).map(item => {
                                const visibleChildren = item.children?.filter(c => hasAccess(user, c));
                                const hasDropdown = visibleChildren && visibleChildren.length > 0;

                                return (
                                    <li key={item.id} className="nav-item-wrapper" style={{ position: 'relative' }}
                                        onMouseEnter={() => hasDropdown && handleMouseEnter(item.id)}
                                        onMouseLeave={() => hasDropdown && handleMouseLeave()}
                                    >
                                        <NavLink
                                            to={item.path}
                                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                            end={item.path === '/'}
                                        >
                                            <item.icon size={18} />
                                            <span>{item.label}</span>
                                            {hasDropdown && (
                                                <ChevronDown
                                                    size={13}
                                                    style={{
                                                        marginLeft: '2px',
                                                        transition: 'transform 0.2s ease',
                                                        transform: openDropdown === item.id ? 'rotate(180deg)' : 'rotate(0deg)',
                                                        opacity: 0.7
                                                    }}
                                                />
                                            )}
                                        </NavLink>

                                        {hasDropdown && openDropdown === item.id && (
                                            <ul className="nav-dropdown">
                                                {visibleChildren.map(child => (
                                                    <li key={child.id}>
                                                        <NavLink
                                                            to={child.path}
                                                            className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                                                            onClick={() => setOpenDropdown(null)}
                                                        >
                                                            <child.icon size={15} />
                                                            <span>{child.label}</span>
                                                        </NavLink>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    {/* User Profile & Logout */}
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-700/50 gap-2 items-center">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="text-gray-300 font-medium">{user.name}</span>
                             <span className="text-gray-500 text-xs px-1.5 py-0.5 bg-gray-800 rounded">
                                 {user.role === ROLES.ADMIN ? '관리자' : 
                                  user.role === ROLES.GROUP_LEADER ? '그룹장' :
                                  user.role === ROLES.TEAM_LEADER ? '팀장' : user.role}
                             </span>
                        </div>
                        <button
                            onClick={logout}
                            className="premium-icon-btn"
                            title="로그아웃"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </nav>


            <main>
                <Routes>
                    {MENU_ITEMS.flatMap(item => {
                        const componentMap = {
                            'dashboard': Dashboard,
                            'sales': SalesStatus,
                            'employees': EmployeeList,
                            'groups': GroupManager,
                            'projects': ProjectsPage,
                            'project-report': ProjectReport,
                            'settings': Settings
                        };

                        const allItems = [item, ...(item.children || [])];

                        return allItems.map(menuItem => {
                            const PageComponent = componentMap[menuItem.id];
                            if (!PageComponent) return null;
                            return (
                                <Route
                                    key={menuItem.id}
                                    path={menuItem.path}
                                    element={
                                        <ProtectedRoute allowedRoles={menuItem.allowedRoles}>
                                            {typeof PageComponent === 'function' ? <PageComponent /> : PageComponent}
                                        </ProtectedRoute>
                                    }
                                />
                            );
                        }).filter(Boolean);
                    })}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
};

export { ErrorBoundary, ProtectedRoute, MainLayout };
