import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, Settings as SettingsIcon, UserCircle, LogOut, TrendingUp, ChevronDown, Key, Eye, EyeOff, Lock, Shield, X, User, Check, ShieldCheck, Sun, Moon } from 'lucide-react';
import Logo from './components/Logo';
import { useAuth } from './context/AuthContext';
import { authAPI } from './api';
import Dashboard from './components/Dashboard';
import SalesStatus from './components/SalesStatus';
import EmployeeList from './components/EmployeeList';
import GroupManager from './components/GroupManager';
import Settings from './components/Settings';
import ProjectStatus from './components/ProjectStatus';
import ProjectReport from './components/ProjectReport';
import ProjectMaster from './components/ProjectMaster';
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

// Change Password Modal Component
const ChangePasswordModal = ({ isOpen, onClose }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const toggleVisibility = (field) => {
        setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('새 비밀번호가 일치하지 않습니다.');
            return;
        }

        if (newPassword.length < 12) {
            setError('비밀번호는 최소 12자 이상이어야 합니다.');
            return;
        }

        setLoading(true);
        try {
            await authAPI.changePassword({
                currentPassword,
                newPassword
            });
            setSuccess('비밀번호가 성공적으로 변경되었습니다.');
            setTimeout(() => {
                onClose();
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setSuccess('');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || '비밀번호 변경 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(5, 8, 20, 0.9)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '20px'
        }}>
            <div className="premium-glass" style={{ 
                width: '100%', 
                maxWidth: '420px', 
                backgroundColor: 'var(--surface-highest)', 
                borderRadius: 'var(--radius-2xl)',
                border: '1px solid var(--outline-variant)',
                boxShadow: 'var(--shadow-xl)',
                overflow: 'hidden',
                position: 'relative',
                color: 'var(--text-primary)',
                fontFamily: 'Inter, sans-serif'
            }}>
                {/* Close Button */}
                <button 
                    onClick={onClose} 
                    style={{
                        position: 'absolute',
                        right: '24px',
                        top: '24px',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        transition: '0.2s',
                        zIndex: 10
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                    <X size={18} />
                </button>

                <div style={{ padding: '40px 32px 24px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                        <div style={{ 
                            width: '48px', 
                            height: '48px', 
                            borderRadius: '16px', 
                            backgroundColor: 'rgba(93, 214, 243, 0.1)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            color: 'var(--primary)',
                            border: '1px solid rgba(93, 214, 243, 0.2)',
                            boxShadow: '0 0 20px var(--primary-glow)'
                        }}>
                            <ShieldCheck size={28} />
                        </div>
                        <h2 style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0 }}>Change Password</h2>
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.6', margin: '8px 0 0', opacity: 0.9 }}>
                        Secure your account by updating your password. Make it strong and memorable.
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '0 32px 40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {error && (
                        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#f87171', fontSize: '13px', fontWeight: '500' }}>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', color: '#34d399', fontSize: '13px', fontWeight: '500' }}>
                            {success}
                        </div>
                    )}

                    {/* Inputs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Current */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', paddingLeft: '4px' }}>Current Password</label>
                            <div className="sunken-input-wrapper">
                                <Key style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 10 }} size={18} />
                                <input
                                    type={showPasswords.current ? "text" : "password"}
                                    className="sunken-input"
                                    style={{ paddingLeft: '48px', paddingRight: '48px' }}
                                    placeholder="••••••••"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    required
                                />
                                <div className="sunken-input-active-bar"></div>
                                <button type="button" onClick={() => toggleVisibility('current')} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', zIndex: 10 }}>
                                    {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* New */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', paddingLeft: '4px' }}>New Password</label>
                            <div className="sunken-input-wrapper">
                                <Shield style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 10 }} size={18} />
                                <input
                                    type={showPasswords.new ? "text" : "password"}
                                    className="sunken-input"
                                    style={{ paddingLeft: '48px', paddingRight: '48px' }}
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                />
                                <div className="sunken-input-active-bar"></div>
                                <button type="button" onClick={() => toggleVisibility('new')} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', zIndex: 10 }}>
                                    {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Validation hints to match mockup */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                color: newPassword.length >= 12 ? '#10b981' : 'rgba(255, 255, 255, 0.6)', 
                                fontSize: '11px', 
                                fontWeight: '600',
                                transition: 'color 0.3s'
                            }}>
                                <Check size={12} strokeWidth={3} /> At least 12 characters
                            </div>
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                color: (newPassword.length >= 12 && /[0-9]/.test(newPassword) && /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) ? '#10b981' : 'rgba(255, 255, 255, 0.6)', 
                                fontSize: '11px', 
                                fontWeight: '600',
                                transition: 'color 0.3s'
                            }}>
                                <Check size={12} strokeWidth={3} /> Strong
                            </div>
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            color: (/[0-9]/.test(newPassword) && /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) ? '#10b981' : 'rgba(255, 255, 255, 0.6)', 
                            fontSize: '11px', 
                            fontWeight: '600', 
                            padding: '0 4px', 
                            marginTop: '-12px',
                            transition: 'color 0.3s'
                        }}>
                            <Check size={12} strokeWidth={3} /> Include symbols & numbers
                        </div>

                        {/* Confirm */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', paddingLeft: '4px' }}>Confirm Password</label>
                            <div className="sunken-input-wrapper">
                                <Lock style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 10 }} size={18} />
                                <input
                                    type={showPasswords.confirm ? "text" : "password"}
                                    className="sunken-input"
                                    style={{ paddingLeft: '48px', paddingRight: '48px' }}
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                />
                                <div className="sunken-input-active-bar"></div>
                                <button type="button" onClick={() => toggleVisibility('confirm')} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', zIndex: 10 }}>
                                    {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                        <button 
                            type="submit" 
                            disabled={loading} 
                            style={{
                                width: '100%',
                                padding: '16px',
                                borderRadius: '14px',
                                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                                border: 'none',
                                color: 'white',
                                fontWeight: '700',
                                fontSize: '15px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: '0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                boxShadow: '0 8px 20px -4px rgba(6, 182, 212, 0.3)',
                                letterSpacing: '0.01em'
                            }}
                            onMouseOver={(e) => { if(!loading) e.currentTarget.style.filter = 'brightness(1.1)'; }}
                            onMouseOut={(e) => { if(!loading) e.currentTarget.style.filter = 'brightness(1)'; }}
                        >
                            <ShieldCheck size={18} />
                            {loading ? 'Processing...' : 'Change Password'}
                        </button>
                        <button 
                            type="button" 
                            onClick={onClose} 
                            style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: '14px',
                                background: 'transparent',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                color: '#94a3b8',
                                fontWeight: '600',
                                fontSize: '14px',
                                cursor: 'pointer',
                                transition: '0.2s'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

import { useTheme } from './context/ThemeContext';

// Main Layout Component
const MainLayout = () => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [openDropdown, setOpenDropdown] = useState(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const timeoutRef = useRef(null);
    const profileRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    // Handle click outside to close the profile dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };

        // On mobile, the backdrop handles closing, and since the sheet is portal-rendered,
        // a click-outside check relative to profileRef would incorrectly close it.
        if (isProfileOpen && !isMobile) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isProfileOpen, isMobile]);

    const toggleProfileDropdown = (e) => {
        setIsProfileOpen(!isProfileOpen);
    };

    return (
        <div className="app">
            <nav className="navbar premium-glass" style={{ border: 'none', borderBottom: '1px solid var(--outline-variant)', borderRadius: 0, overflow: 'visible' }}>
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="nav-left-group" style={{ display: 'flex', alignItems: 'center', gap: '2.5rem', flex: 1, minWidth: 0, overflow: 'visible' }}>
                        <Link to="/" className="navbar-brand" style={{ fontFamily: 'Manrope, sans-serif', flexShrink: 0 }}>
                            <span style={{ filter: 'drop-shadow(0 0 8px var(--primary-glow))' }}><Logo size={64} className="nav-logo-svg" /></span>
                            <span className="brand-text-desktop" style={{ fontWeight: 800 }}>Workforce Status</span>
                        </Link>
                        <div className="hide-scroll-bar-mobile" style={{ overflowX: 'auto', flex: 1, padding: '0 10px', WebkitOverflowScrolling: 'touch' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minWidth: 'max-content', gap: '2rem' }}>
                                <ul className="navbar-nav" style={{ display: 'flex', whiteSpace: 'nowrap', width: 'max-content' }}>
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
                                {/* User Profile, Theme Toggle & Logout */}
                                <div className="flex items-center gap-4 text-sm" style={{ flexShrink: 0, paddingRight: '10px' }}>
                                    {/* Theme Toggle Button */}
                        <button
                            onClick={toggleTheme}
                            className="premium-icon-btn"
                            style={{ 
                                width: '38px', 
                                height: '38px', 
                                borderRadius: '12px',
                                background: 'var(--surface-high)',
                                border: 'none',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: '0.3s'
                            }}
                            title={theme === 'dark' ? 'Switch to Editorial Light' : 'Switch to Mission Dark'}
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <div 
                            ref={profileRef}
                            className="relative py-2"
                        >
                            <div 
                                onClick={toggleProfileDropdown}
                                style={{ 
                                    display: 'flex', 
                                    backgroundColor: isProfileOpen ? 'var(--surface-bright)' : 'var(--surface-high)', 
                                    padding: '6px 16px', 
                                    borderRadius: '99px', 
                                    border: 'none', 
                                    gap: '10px', 
                                    alignItems: 'center', 
                                    cursor: 'pointer',
                                    transition: '0.3s',
                                    boxShadow: 'var(--shadow-sm)',
                                    transform: isProfileOpen ? 'translateY(-1px)' : 'translateY(0)',
                                    whiteSpace: 'nowrap',
                                    flexWrap: 'nowrap',
                                    flexShrink: 0
                                }}
                            >
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--tertiary)', boxShadow: '0 0 10px var(--tertiary-glow)' }}></div>
                                <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px', letterSpacing: '-0.01em' }}>{user.name}</span>
                                <span className="glow-pill glow-pill-teal" style={{ fontSize: '9px', padding: '1px 6px' }}>
                                    {user.role === ROLES.ADMIN ? '관리자' : 
                                     user.role === ROLES.GROUP_LEADER ? '그룹장' :
                                     user.role === ROLES.TEAM_LEADER ? '팀장' : user.role}
                                </span>
                                <ChevronDown size={14} style={{ color: 'var(--text-muted)', transition: '0.3s', transform: isProfileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                            </div>

                            {/* Profile Menu (Desktop: Dropdown, Mobile: Bottom Sheet) */}
                             {isProfileOpen && (
                                 isMobile ? (
                                     createPortal(
                                         <div className="bottom-sheet-wrapper" style={{ position: 'fixed', inset: 0, zIndex: 10000 }}>
                                             <div className="bottom-sheet-backdrop" onClick={() => setIsProfileOpen(false)} />
                                             <div className="mobile-bottom-sheet" onClick={(e) => e.stopPropagation()}>
                                                 <div className="bottom-sheet-handle" />
                                                 <div style={{ padding: '0 0 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                                     <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>내 정보</p>
                                                     <p style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: '700' }}>{user.email}</p>
                                                     <p style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '4px', fontWeight: '600' }}>
                                                         {user.role === ROLES.ADMIN ? '관리자 권한' : 
                                                          user.role === ROLES.GROUP_LEADER ? '그룹장 권한' :
                                                          user.role === ROLES.TEAM_LEADER ? '팀장 권한' : `${user.role} 권한`}
                                                     </p>
                                                 </div>
                                                 
                                                 <div style={{ padding: '12px 0 0' }}>
                                                     <button 
                                                         onClick={() => { setShowChangePassword(true); setIsProfileOpen(false); }}
                                                         style={{
                                                             width: '100%',
                                                             display: 'flex',
                                                             alignItems: 'center',
                                                             gap: '16px',
                                                             padding: '16px',
                                                             background: 'rgba(255, 255, 255, 0.03)',
                                                             border: '1px solid rgba(255, 255, 255, 0.05)',
                                                             borderRadius: '16px',
                                                             color: 'var(--text-primary)',
                                                             cursor: 'pointer',
                                                             textAlign: 'left',
                                                             marginBottom: '10px'
                                                         }}
                                                     >
                                                         <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                             <Key size={20} style={{ color: 'var(--primary)' }} />
                                                         </div>
                                                         <div style={{ flex: 1 }}>
                                                             <span style={{ fontSize: '15px', fontWeight: '700', display: 'block' }}>비밀번호 변경</span>
                                                             <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>계정 보안 설정을 관리합니다</span>
                                                         </div>
                                                     </button>

                                                     <button 
                                                         onClick={logout}
                                                         style={{
                                                             width: '100%',
                                                             display: 'flex',
                                                             alignItems: 'center',
                                                             gap: '16px',
                                                             padding: '16px',
                                                             background: 'rgba(255, 75, 75, 0.05)',
                                                             border: '1px solid rgba(255, 75, 75, 0.1)',
                                                             borderRadius: '16px',
                                                             color: '#ff4b4b',
                                                             cursor: 'pointer',
                                                             textAlign: 'left'
                                                         }}
                                                     >
                                                         <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(255, 75, 75, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                             <LogOut size={20} />
                                                         </div>
                                                         <div style={{ flex: 1 }}>
                                                             <span style={{ fontSize: '15px', fontWeight: '700', display: 'block' }}>로그아웃</span>
                                                             <span style={{ fontSize: '12px', color: 'rgba(255, 75, 75, 0.6)' }}>세션을 종료하고 안전하게 나갑니다</span>
                                                         </div>
                                                     </button>
                                                 </div>
                                             </div>
                                         </div>,
                                         document.body
                                     )
                                 ) : (
                                     <div 
                                         onClick={(e) => e.stopPropagation()}
                                         style={{ 
                                             position: 'absolute', 
                                             right: 0, 
                                             top: '100%', 
                                             paddingTop: '12px', 
                                             zIndex: 10000 
                                         }}
                                     >
                                         <div className="premium-glass" style={{ 
                                             minWidth: '240px', 
                                             backgroundColor: 'var(--surface-highest)', 
                                             borderRadius: 'var(--radius-xl)', 
                                             border: '1px solid var(--outline-variant)', 
                                             boxShadow: 'var(--shadow-xl)', 
                                             overflow: 'hidden' 
                                         }}>
                                             <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255, 255, 255, 0.02)' }}>
                                                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>내 정보</p>
                                                 <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
                                             </div>
                                             
                                             <div style={{ padding: '8px' }}>
                                                 <button 
                                                     onClick={() => { setShowChangePassword(true); setIsProfileOpen(false); }}
                                                     style={{
                                                         width: '100%',
                                                         display: 'flex',
                                                         alignItems: 'center',
                                                         gap: '12px',
                                                         padding: '12px 16px',
                                                         background: 'transparent',
                                                         border: 'none',
                                                         borderRadius: '16px',
                                                         color: 'var(--text-secondary)',
                                                         cursor: 'pointer',
                                                         transition: '0.2s',
                                                         textAlign: 'left'
                                                     }}
                                                     onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#fff'; }}
                                                     onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                                 >
                                                     <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                         <Key size={16} style={{ color: 'var(--primary)' }} />
                                                     </div>
                                                     <span style={{ fontSize: '14px', fontWeight: '600' }}>비밀번호 변경</span>
                                                 </button>

                                                 <button 
                                                     onClick={logout}
                                                     style={{
                                                         width: '100%',
                                                         display: 'flex',
                                                         alignItems: 'center',
                                                         gap: '12px',
                                                         padding: '12px 16px',
                                                         background: 'transparent',
                                                         border: 'none',
                                                         borderRadius: '16px',
                                                         color: 'var(--error)',
                                                         opacity: 0.9,
                                                         cursor: 'pointer',
                                                         transition: '0.2s',
                                                         textAlign: 'left',
                                                         marginTop: '4px'
                                                     }}
                                                     onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 180, 171, 0.08)'; e.currentTarget.style.opacity = '1'; }}
                                                     onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.opacity = '0.9'; }}
                                                 >
                                                     <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: 'rgba(255, 180, 171, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                         <LogOut size={16} />
                                                     </div>
                                                     <span style={{ fontSize: '14px', fontWeight: '600' }}>로그아웃</span>
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                 )
                             )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</nav>

            {/* Change Password Modal */}
            <ChangePasswordModal 
                isOpen={showChangePassword} 
                onClose={() => setShowChangePassword(false)} 
            />


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
                            'project-master': ProjectMaster,
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
