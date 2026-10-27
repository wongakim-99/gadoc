'use client';

import { useEffect, useState } from 'react';
import { Copy, KeyRound, Plus, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { ConfirmationDialog } from '@/src/shared/ui/ConfirmationDialog';

type Scope = 'documents:read' | 'documents:write' | 'files:write' | 'databases:read' | 'databases:write';
type Token = {
    id: string;
    name: string;
    prefix: string;
    scopes: Scope[];
    expiresAt: string;
    revokedAt: string | null;
    lastUsedAt: string | null;
};
type Activity = { tool: string; outcome: 'success' | 'error'; createdAt: string; tokenId: string };
const inputClass =
    'w-full rounded-lg border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-brand-400 focus:outline-none';

export function McpSettingsPanel({ teamId, canWrite }: { teamId: string; canWrite: boolean }) {
    const [tokens, setTokens] = useState<Token[]>([]);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [name, setName] = useState('내 AI 도구');
    const [days, setDays] = useState(30);
    const [write, setWrite] = useState(false);
    const [files, setFiles] = useState(false);
    const [databaseWrite, setDatabaseWrite] = useState(false);
    const [secret, setSecret] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [revoking, setRevoking] = useState<Token | null>(null);
    const endpoint =
        typeof window === 'undefined' ? 'https://slacord.cloud/api/mcp' : `${window.location.origin}/api/mcp`;
    const base = `/api/team/${teamId}/integrations`;

    useEffect(() => {
        let active = true;
        setSecret('');
        setLoading(true);
        Promise.all([apiFetch<Token[]>(`${base}/tokens`), apiFetch<Activity[]>(`${base}/activity`)])
            .then(([connections, events]) => {
                if (active) {
                    setTokens(connections.data ?? []);
                    setActivity(events.data ?? []);
                }
            })
            .catch((reason: Error) => {
                if (active) setError(reason.message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [base]);

    async function copy(value: string, label: string) {
        try {
            await navigator.clipboard.writeText(value);
            setNotice(`${label} 복사했습니다.`);
        } catch {
            setError('클립보드에 접근하지 못했습니다. 내용을 선택해 복사해 주세요.');
        }
    }

    async function create(event: React.FormEvent) {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        setSecret('');
        setNotice('');
        try {
            const scopes: Scope[] = ['documents:read', 'databases:read'];
            if (canWrite && write) scopes.push('documents:write');
            if (canWrite && databaseWrite) scopes.push('databases:write');
            if (canWrite && files) scopes.push('files:write');
            const response = await apiFetch<Token & { token: string }>(`${base}/tokens`, {
                method: 'POST',
                body: JSON.stringify({ name, expiresInDays: days, scopes }),
            });
            if (!response.data?.token) throw new Error('연결 키를 발급하지 못했습니다.');
            setSecret(response.data.token);
            const { token: _secret, ...connection } = response.data;
            setTokens((current) => [connection, ...current]);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '연결 생성 실패');
        } finally {
            setBusy(false);
        }
    }

    async function revoke() {
        if (!revoking || busy) return;
        setBusy(true);
        setError('');
        try {
            await apiFetch(`${base}/tokens/${revoking.id}`, { method: 'DELETE' });
            setTokens((current) =>
                current.map((token) =>
                    token.id === revoking.id ? { ...token, revokedAt: new Date().toISOString() } : token,
                ),
            );
            setSecret('');
            setRevoking(null);
            setNotice('연결을 폐기했습니다. 이 키로는 더 이상 접근할 수 없습니다.');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : '연결 폐기 실패');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-6" aria-label="AI 연결 관리">
            {error && (
                <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {error}
                </p>
            )}
            {notice && (
                <p role="status" className="text-sm text-brand-200">
                    {notice}
                </p>
            )}
            <div className="grid gap-6 xl:grid-cols-2">
                <form
                    onSubmit={create}
                    className="space-y-4 rounded-xl border border-border-primary bg-bg-secondary p-5"
                >
                    <h3 className="flex items-center gap-2 font-semibold">
                        <KeyRound size={18} /> 새 MCP 연결
                    </h3>
                    <p className="text-sm leading-6 text-text-secondary">
                        AI가 내 계정으로 이 워크스페이스의 문서를 읽고 정리합니다. 내가 접근할 수 없는 문서는 AI도 볼 수
                        없습니다.
                    </p>
                    <label className="block space-y-2 text-sm">
                        <span>연결 이름</span>
                        <input
                            required
                            maxLength={80}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className={inputClass}
                        />
                    </label>
                    <label className="block space-y-2 text-sm">
                        <span>만료 기간</span>
                        <select
                            value={days}
                            onChange={(event) => setDays(Number(event.target.value))}
                            className={inputClass}
                        >
                            <option value={7}>7일</option>
                            <option value={30}>30일</option>
                            <option value={90}>90일</option>
                        </select>
                    </label>
                    <fieldset className="space-y-3 text-sm">
                        <legend className="mb-3 text-text-secondary">허용할 작업</legend>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked disabled /> 문서·데이터베이스 조회와 검색
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={write}
                                disabled={!canWrite}
                                onChange={(event) => setWrite(event.target.checked)}
                            />{' '}
                            문서 작성과 수정
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={files}
                                disabled={!canWrite}
                                onChange={(event) => setFiles(event.target.checked)}
                            />{' '}
                            문서에 파일 첨부
                        </label>
                    </fieldset>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={databaseWrite} disabled={!canWrite} onChange={(event) => setDatabaseWrite(event.target.checked)} />
                        데이터베이스·일정 편집
                    </label>
                    {(write || files || databaseWrite) && (
                        <p className="text-xs leading-5 text-amber-200">
                            쓰기 권한을 켜면 AI가 실제 문서를 변경할 수 있습니다. 사용하는 AI 도구에서도 실행 전 확인을
                            켜 두세요.
                        </p>
                    )}
                    <button
                        disabled={busy || loading || !name.trim()}
                        className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                    >
                        <Plus size={16} /> {busy ? '처리 중...' : '연결 키 발급'}
                    </button>
                </form>
                <section className="space-y-4 rounded-xl border border-border-primary p-5">
                    <h3 className="font-semibold">AI 도구에 연결하기</h3>
                    <p className="text-sm leading-6 text-text-secondary">
                        Streamable HTTP와 인증 헤더를 지원하는 MCP 클라이언트에 아래 주소를 등록하세요. 로그인 쿠키나
                        계정 비밀번호는 필요하지 않습니다.
                    </p>
                    <label className="block space-y-2 text-sm">
                        <span>MCP 서버 주소</span>
                        <div className="flex gap-2">
                            <input aria-label="MCP 서버 주소" value={endpoint} readOnly className={inputClass} />
                            <button
                                type="button"
                                aria-label="MCP 주소 복사"
                                onClick={() => void copy(endpoint, '서버 주소를')}
                                className="rounded-lg border border-border-primary p-2"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                    </label>
                    <div className="rounded-lg bg-bg-secondary p-3 text-xs leading-6">
                        <p className="text-text-secondary">인증 헤더</p>
                        <code className="break-all">Authorization: Bearer 발급받은_연결_키</code>
                    </div>
                    {secret && (
                        <div className="space-y-3 rounded-lg border border-brand-400/40 bg-brand-500/10 p-4">
                            <p className="text-sm font-medium">연결 키는 지금 한 번만 표시됩니다.</p>
                            <input
                                aria-label="발급된 MCP 연결 키"
                                type="password"
                                readOnly
                                value={secret}
                                className={inputClass}
                                autoComplete="off"
                            />
                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    className="text-sm underline"
                                    onClick={() => void copy(secret, '연결 키를')}
                                >
                                    연결 키 복사
                                </button>
                                <button type="button" className="text-sm underline" onClick={() => setSecret('')}>
                                    확인했어요, 숨기기
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="flex gap-2 text-xs leading-6 text-text-secondary">
                        <ShieldCheck size={16} className="mt-1 shrink-0" />
                        <p>
                            키는 이 팀에만 연결되며 원문은 서버에 저장하지 않습니다. 문서·첨부 권한을 매 요청마다
                            확인합니다. 첨부는 비공개 MinIO에 저장되며 MCP 업로드는 파일당 2MB까지 지원합니다.
                        </p>
                    </div>
                    <p className="text-xs leading-6 text-text-secondary">
                        첫 요청 예시: “GaDoc 문서를 찾아보고, 선택한 페이지 아래에 회의록을 만들어 줘.” OAuth 로그인만
                        지원하는 클라이언트는 아직 연결할 수 없습니다.
                    </p>
                </section>
            </div>
            <section className="rounded-xl border border-border-primary p-5">
                <h3 className="mb-4 font-semibold">내 연결</h3>
                {loading ? (
                    <p role="status" className="text-sm text-text-secondary">
                        연결을 불러오는 중...
                    </p>
                ) : tokens.length === 0 ? (
                    <p className="text-sm text-text-secondary">아직 연결한 AI 도구가 없습니다.</p>
                ) : (
                    <ul className="divide-y divide-border-primary">
                        {tokens.map((token) => {
                            const inactive = !!token.revokedAt || new Date(token.expiresAt).getTime() <= Date.now();
                            return (
                                <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                                    <div>
                                        <p className="font-medium">
                                            {token.name}{' '}
                                            <span className="ml-2 text-xs text-text-tertiary">
                                                {token.revokedAt ? '폐기됨' : inactive ? '만료됨' : '사용 가능'}
                                            </span>
                                        </p>
                                        <p className="mt-1 text-xs text-text-secondary">
                                            {token.prefix}... · {new Date(token.expiresAt).toLocaleDateString('ko-KR')}{' '}
                                            만료 ·{' '}
                                            {token.scopes.some((scope) => scope.endsWith(':write'))
                                                ? '쓰기 허용'
                                                : '읽기 전용'}
                                        </p>
                                        <p className="mt-1 text-xs text-text-tertiary">
                                            {token.lastUsedAt
                                                ? `최근 사용 ${new Date(token.lastUsedAt).toLocaleString('ko-KR')}`
                                                : '아직 사용하지 않음'}
                                        </p>
                                    </div>
                                    {!inactive && (
                                        <button
                                            onClick={() => setRevoking(token)}
                                            className="rounded-lg border border-border-primary px-3 py-2 text-sm text-red-300"
                                        >
                                            폐기
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
            <section className="rounded-xl border border-border-primary p-5">
                <h3 className="mb-3 font-semibold">최근 AI 작업</h3>
                <p className="mb-4 text-xs text-text-secondary">
                    본문이나 파일 내용은 기록하지 않고, 작업 이름과 성공 여부만 180일간 보관합니다.
                </p>
                {activity.length === 0 ? (
                    <p className="text-sm text-text-secondary">아직 실행한 작업이 없습니다.</p>
                ) : (
                    <ul className="space-y-2">
                        {activity.map((event, index) => (
                            <li key={`${event.createdAt}-${index}`} className="flex flex-wrap gap-3 text-xs">
                                <time className="text-text-tertiary">
                                    {new Date(event.createdAt).toLocaleString('ko-KR')}
                                </time>
                                <code>{event.tool}</code>
                                <span className={event.outcome === 'error' ? 'text-red-300' : 'text-text-secondary'}>
                                    {event.outcome === 'success' ? '완료' : '실패'}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <ConfirmationDialog
                open={!!revoking}
                onClose={() => !busy && setRevoking(null)}
                onConfirm={revoke}
                busy={busy}
                title="AI 연결을 폐기할까요?"
                description={`${revoking?.name ?? ''}의 연결 키를 즉시 사용할 수 없게 됩니다. 다시 연결하려면 새 키를 발급해야 합니다.`}
                confirmLabel="연결 폐기"
                tone="danger"
            />
        </div>
    );
}
