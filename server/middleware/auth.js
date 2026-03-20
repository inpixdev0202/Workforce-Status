import jwt from 'jsonwebtoken';
import { get } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

export const authenticateToken = (req, res, next) => {
    // Development fallback if auth is disabled entirely (optional, but we enforce it now)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '인증 토큰이 없습니다. 다시 로그인해 주세요.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: '세션이 만료되었거나 유효하지 않습니다.' });
        }

        // Fetch user from DB to ensure they still exist and check their role
        try {
            const user = get('SELECT id, name, email, role, group_id, permissions FROM users WHERE id = ?', [decoded.id]);
            if (!user) {
                return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
            }
            if (user.permissions) {
                try {
                    user.permissions = JSON.parse(user.permissions);
                } catch (e) {
                    user.permissions = {};
                }
            } else {
                user.permissions = {};
            }
            req.user = user;
            next();
        } catch (dbErr) {
            return res.status(500).json({ error: '서버 인증 오류' });
        }
    });
};

export const requireRoles = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }
    next();
};

export const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'Admin') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }
    next();
};
