import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserCircle, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-page">
            {/* Animated Background Elements */}
            <div className="login-sphere sphere-1"></div>
            <div className="login-sphere sphere-2"></div>
            <div className="login-sphere sphere-3"></div>

            <div className="glass-login-card">
                <div className="login-logo-container">
                    <div className="login-logo-icon">
                        <UserCircle size={40} strokeWidth={2.5} />
                    </div>
                    <h1 className="login-title">Workforce Status</h1>
                    <p className="login-subtitle">인력 현황 관리 시스템</p>
                </div>

                {error && (
                    <div className="login-error">
                        <AlertCircle size={18} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="login-field">
                        <label className="login-label">이메일 주소</label>
                        <div className="login-input-wrapper">
                            <input
                                type="email"
                                className="login-input"
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <Mail className="login-input-icon" size={18} />
                        </div>
                    </div>

                    <div className="login-field">
                        <label className="login-label">비밀번호</label>
                        <div className="login-input-wrapper">
                            <input
                                type="password"
                                className="login-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <Lock className="login-input-icon" size={18} />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="login-submit-btn"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <span>로그인</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>

                    <div className="login-footer">
                        초기 관리자 계정: admin@admin.com / admin123
                    </div>
                </form>
            </div>
        </div>
    );
}
