import express from 'express';
import bcrypt from 'bcryptjs';
import { query, run, get } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All user routes require admin access
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/users - List all users
router.get('/', async (req, res) => {
    try {
        const rows = await query(`
            SELECT u.id, u.name, u.email, u.role, u.group_id, u.permissions, u.created_at, g.name as group_name 
            FROM users u
            LEFT JOIN groups g ON u.group_id = g.id
            ORDER BY u.role, u.name
        `);
        
        const users = rows.map(u => {
            let permissions = {};
            try {
                if (u.permissions) {
                    permissions = typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions;
                }
            } catch (e) {
                console.error(`Error parsing permissions for user ${u.id}:`, e);
                permissions = {};
            }
            return { ...u, permissions };
        });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: '사용자 목록을 불러오는 데 실패했습니다.' });
    }
});

// POST /api/users - Create a new user
router.post('/', async (req, res) => {
    try {
        const { name, email, password, role, group_id, permissions } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' });
        }

        // Check for existing email
        const existing = await get('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const result = await run(
            'INSERT INTO users (name, email, password_hash, role, group_id, permissions) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
            [name, email, hash, role, group_id || null, permissions ? JSON.stringify(permissions) : null]
        );

        res.status(201).json({ id: result.rows[0].id, message: '사용자가 성공적으로 생성되었습니다.' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: '사용자 생성에 실패했습니다.' });
    }
});

// PUT /api/users/:id - Update user (name, role, group, or password)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password, role, group_id, permissions } = req.body;

        const user = await get('SELECT * FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // If email changed, check uniqueness
        if (email !== user.email) {
            const existing = await get('SELECT id FROM users WHERE email = ?', [email]);
            if (existing) {
                return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
            }
        }

        let hashToUpdate = user.password_hash;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            hashToUpdate = await bcrypt.hash(password, salt);
        }

        await run(
            'UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, group_id = ?, permissions = ? WHERE id = ?',
            [name, email, hashToUpdate, role, group_id || null, permissions ? JSON.stringify(permissions) : null, id]
        );

        res.json({ message: '사용자 정보가 업데이트되었습니다.' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: '사용자 업데이트에 실패했습니다.' });
    }
});

// DELETE /api/users/:id - Delete a user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent deleting oneself
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: '자신의 계정은 삭제할 수 없습니다.' });
        }

        await run('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: '사용자가 삭제되었습니다.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: '사용자 삭제에 실패했습니다.' });
    }
});

export default router;
