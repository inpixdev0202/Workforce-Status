import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { get, run } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
        }

        const user = await get('SELECT * FROM users WHERE email = ?', [email]);

        if (!user) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, role: user.role, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' } // Token expires in 24 hours
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                group_id: user.group_id,
                permissions: user.permissions ? JSON.parse(user.permissions) : {}
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' });
        }

        const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: '현재 비밀번호가 일치하지 않습니다.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);

        res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: '비밀번호 변경 처리 중 오류가 발생했습니다.' });
    }
});

// GET /api/auth/verify - Get current active user from token
router.get('/verify', authenticateToken, async (req, res) => {
    // If the middleware passes, req.user is set
    res.json({
        user: req.user
    });
});

export default router;
