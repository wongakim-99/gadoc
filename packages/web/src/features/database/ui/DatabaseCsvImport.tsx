'use client';
import { useRef, useState } from 'react';
import { databaseApi } from '@/lib/api-client';
import { useWorkspaceLeaveGuard } from '@/src/features/workspace/model/useWorkspaceConnection';
import { parseDatabaseCsv, csvCell, csvWritable } from '../model/parseDatabaseCsv';
import type { DatabaseDetail, PropertyValue } from '../model/types';
const newId = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, '0')).join('');
export function DatabaseCsvImport({
    teamId,
    database,
    onImported,
}: {
    teamId: string;
    database: DatabaseDetail;
    onImported: () => Promise<void>;
}) {
    const [open, setOpen] = useState(false),
        [rows, setRows] = useState<string[][]>([]),
        [mapping, setMapping] = useState<string[]>([]);
    const [error, setError] = useState(''),
        [busy, setBusy] = useState(false),
        [done, setDone] = useState(0);
    const jobs = useRef<Array<{ id: string; title: string; values: Record<string, PropertyValue> }>>([]);
    const active = useRef(false),
        completed = useRef(0);
    useWorkspaceLeaveGuard(() => !active.current);
    const editable = database.properties.filter(csvWritable);
    const preview = () => {
        if (mapping.filter((value) => value === 'title').length !== 1)
            throw new Error('페이지 이름 열을 하나 지정하세요.');
        const assigned = mapping.filter(Boolean);
        if (new Set(assigned).size !== assigned.length)
            throw new Error('하나의 속성을 여러 CSV 열에 지정할 수 없습니다.');
        return rows.slice(1).map((row, index) => {
            const title = row[mapping.indexOf('title')].trim();
            if (!title || title.length > 200) throw new Error(`${index + 2}행: 페이지 이름은 1~200자로 입력하세요.`);
            const values: Record<string, PropertyValue> = {};
            mapping.forEach((propertyId, column) => {
                if (!propertyId || propertyId === 'title') return;
                const property = editable.find((item) => item.id === propertyId);
                if (!property) throw new Error('속성이 변경되었습니다. 파일을 다시 선택하세요.');
                try {
                    values[propertyId] = csvCell(row[column], property);
                } catch (error) {
                    throw new Error(`${index + 2}행 ${property.name}: ${(error as Error).message}`);
                }
            });
            return { id: newId(), title, values };
        });
    };
    const start = async () => {
        if (active.current) return;
        setError('');
        try {
            if (!jobs.current.length) jobs.current = preview();
        } catch (error) {
            setError((error as Error).message);
            return;
        }
        active.current = true;
        setBusy(true);
        try {
            for (let index = completed.current; index < jobs.current.length; index++) {
                const job = jobs.current[index];
                await databaseApi.createRowPage(teamId, database.id, job.title, job.id, job.values);
                completed.current = index + 1;
                setDone(index + 1);
            }
        } catch (error) {
            setError(
                `${completed.current + 2}행에서 중단했습니다. 완료된 행은 유지됩니다. ${(error as Error).message}`,
            );
        } finally {
            try {
                await onImported();
            } catch (error) {
                setError(`목록 새로고침 실패: ${(error as Error).message}`);
            }
            active.current = false;
            setBusy(false);
        }
    };
    return (
        <div className="text-xs" data-manages-draft-navigation="true">
            <button
                type="button"
                className="rounded-control border border-border-primary px-3 py-2"
                onClick={() => setOpen((value) => !value)}
                disabled={busy}
            >
                CSV 가져오기
            </button>
            {open && (
                <section
                    aria-label="CSV 가져오기"
                    className="my-2 space-y-3 rounded-panel border border-border-primary bg-bg-primary p-4"
                >
                    <p>
                        CSV 열을 기존 속성에 연결해 페이지를 추가합니다. 담당자·관계·계산 속성은 가져온 뒤 지정하세요.
                        최대 1MB, 1,000행입니다.
                    </p>
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        aria-label="가져올 CSV 파일"
                        disabled={busy}
                        onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            setError('');
                            setRows([]);
                            jobs.current = [];
                            completed.current = 0;
                            setDone(0);
                            try {
                                if (file.size > 1_000_000) throw new Error('CSV는 1MB 이하로 선택하세요.');
                                const data = parseDatabaseCsv(await file.text());
                                setRows(data);
                                setMapping(
                                    data[0].map((header, index) =>
                                        ['이름', 'Name', 'Title'].includes(header)
                                            ? 'title'
                                            : (editable.find((property) => property.name === header)?.id ??
                                              (index === 0 ? 'title' : '')),
                                    ),
                                );
                            } catch (error) {
                                setError((error as Error).message);
                            }
                        }}
                    />
                    {rows.length > 0 && (
                        <>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {rows[0].map((header, index) => (
                                    <label key={index} className="flex items-center justify-between gap-2">
                                        {header || `열 ${index + 1}`}
                                        <select
                                            aria-label={`${header || index + 1} CSV 열 연결`}
                                            value={mapping[index]}
                                            disabled={busy || jobs.current.length > 0}
                                            className="rounded border border-border-primary bg-bg-secondary p-2"
                                            onChange={(event) =>
                                                setMapping((current) =>
                                                    current.map((value, column) =>
                                                        column === index ? event.target.value : value,
                                                    ),
                                                )
                                            }
                                        >
                                            <option value="">가져오지 않음</option>
                                            <option value="title">페이지 이름</option>
                                            {editable.map((property) => (
                                                <option key={property.id} value={property.id}>
                                                    {property.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                ))}
                            </div>
                            <p>{rows.length - 1}개 페이지 · 미리보기</p>
                            <div className="max-h-40 overflow-auto">
                                <table className="w-full border-collapse text-left">
                                    <thead>
                                        <tr>
                                            {rows[0].map((cell, index) => (
                                                <th key={index} className="border border-border-primary p-2">
                                                    {cell}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.slice(1, 6).map((row, index) => (
                                            <tr key={index}>
                                                {row.map((cell, column) => (
                                                    <td
                                                        key={column}
                                                        className="max-w-64 whitespace-pre-wrap break-words border border-border-primary p-2"
                                                    >
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button
                                type="button"
                                disabled={busy || done === rows.length - 1}
                                onClick={() => void start()}
                                className="rounded-control border border-border-primary px-3 py-2 disabled:opacity-50"
                            >
                                {jobs.current.length && done < rows.length - 1 ? '이어서 가져오기' : '가져오기 시작'}
                            </button>
                            <p role="status">
                                {done} / {rows.length - 1}개 완료{busy ? ' · 가져오는 중…' : ''}
                            </p>
                        </>
                    )}
                    {error && (
                        <p role="alert" className="text-danger">
                            {error}
                        </p>
                    )}
                </section>
            )}
        </div>
    );
}
