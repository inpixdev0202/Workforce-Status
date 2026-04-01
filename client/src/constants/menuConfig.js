import { LayoutDashboard, TrendingUp, Briefcase, Settings, FileText } from 'lucide-react';

export const ROLES = {
    ADMIN: 'Admin',
    GROUP_LEADER: 'GroupLeader',
    TEAM_LEADER: 'TeamLeader',
    PD: 'PD',
    PM: 'PM',
    GM: 'GM'
};

export const MENU_ITEMS = [
    {
        id: 'dashboard',
        label: '대시보드',
        path: '/',
        icon: LayoutDashboard,
        allowedRoles: [ROLES.ADMIN, ROLES.GROUP_LEADER, ROLES.TEAM_LEADER, ROLES.PD, ROLES.PM, ROLES.GM],
        permissionKey: 'dashboard'
    },
    {
        id: 'sales',
        label: '영업현황',
        path: '/sales',
        icon: TrendingUp,
        allowedRoles: [ROLES.ADMIN, ROLES.GROUP_LEADER, ROLES.TEAM_LEADER, ROLES.PD, ROLES.PM, ROLES.GM],
        permissionKey: 'sales'
    },
    {
        id: 'projects',
        label: '프로젝트 배정',
        path: '/projects',
        icon: Briefcase,
        allowedRoles: [ROLES.ADMIN, ROLES.GROUP_LEADER, ROLES.TEAM_LEADER, ROLES.PD, ROLES.PM, ROLES.GM],
        permissionKey: 'projects'
    },
    {
        id: 'project-report',
        label: '프로젝트 보고',
        path: '/project-report',
        icon: FileText,
        allowedRoles: [ROLES.ADMIN, ROLES.GROUP_LEADER, ROLES.TEAM_LEADER, ROLES.PD, ROLES.PM, ROLES.GM],
        permissionKey: 'project-report'
    },
    {
        id: 'project-master',
        label: '프로젝트 마스터',
        path: '/project-master',
        icon: Briefcase,
        allowedRoles: [ROLES.ADMIN, ROLES.GROUP_LEADER, ROLES.TEAM_LEADER, ROLES.PD, ROLES.PM],
        permissionKey: 'project-master'
    },
    {
        id: 'settings',
        label: '설정',
        path: '/settings',
        icon: Settings,
        allowedRoles: [ROLES.ADMIN, ROLES.GROUP_LEADER, ROLES.TEAM_LEADER, ROLES.PD, ROLES.PM],
        permissionKey: 'settings'
    }
];

export const hasAccess = (user, item) => {
    if (!user) return false;
    if (user.role === ROLES.ADMIN) return true;

    // 1. Check granular permissions first if explicitly set
    if (user.permissions && item.permissionKey) {
        if (user.permissions[item.permissionKey] === true) return true;
        if (user.permissions[item.permissionKey] === false) return false;
    }

    // 2. Fallback to role-based access if no specific granular permission is set
    const allowedRoles = item.allowedRoles;
    if (!allowedRoles || allowedRoles.length === 0) return true;
    return allowedRoles.includes(user.role);
};
