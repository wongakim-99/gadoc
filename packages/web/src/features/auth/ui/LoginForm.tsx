'use client';

import { useEffect, useState } from 'react';
import { useLogin } from '../model/useAuth';

interface Props {
    nextPath?: string;
}

export function LoginForm({ nextPath }: Props) {
    const { login, error, loading } = useLogin(nextPath);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    // 데스크톱 앱에서는 기본 체크
    useEffect(() => {
        if (typeof window !== 'undefined' && window.slacordDesktop?.isDesktop) {
            setRememberMe(true);
        }
    }, []);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        await login(email, password, rememberMe);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
                <p className="rounded-md border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                    {error}
                </p>
            )}
            <label className="block">
                <span className="mb-2 block text-sm text-text-primary">이메일</span>
                <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="team@company.com"
                    className="w-full rounded-md border border-border-primary bg-bg-tertiary px-4 py-3 text-white outline-none transition focus:border-action-text"
                />
            </label>
            <label className="block">
                <span className="mb-2 block text-sm text-text-primary">비밀번호</span>
                <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="비밀번호 입력"
                    className="w-full rounded-md border border-border-primary bg-bg-tertiary px-4 py-3 text-white outline-none transition focus:border-action-text"
                />
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-border-primary bg-bg-tertiary accent-action"
                />
                <span className="text-sm text-text-secondary">로그인 유지 (30일)</span>
            </label>
            <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-action px-4 py-3 font-semibold text-white transition hover:bg-action-hover disabled:opacity-50"
            >
                {loading ? '로그인 중...' : '로그인'}
            </button>
        </form>
    );
}
