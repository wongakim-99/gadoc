'use client';
import { AGGREGATION_LABELS, NUMERIC_AGGREGATIONS, DATE_AGGREGATIONS } from '@slacord/document-core';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';
import { PROPERTY_LABELS, type DatabaseProperty, type KnowledgeDatabase, type PropertyType } from '../model/types';

export function PropertyEditor({
    database,
    editing,
    databases,
    busy,
    error,
    onClose,
    onArchive,
    onSave,
}: {
    database: KnowledgeDatabase;
    editing?: DatabaseProperty;
    databases: KnowledgeDatabase[];
    busy: boolean;
    error: string;
    onClose: () => void;
    onArchive?: () => void;
    onSave: (property: Omit<DatabaseProperty, 'id'>) => void;
}) {
    const [bidirectional, setBidirectional] = useState(!!editing?.inverse);
    const [inverseName, setInverseName] = useState(editing?.inverse?.name ?? '연결된 항목');
    const [prefix, setPrefix] = useState(editing?.prefix ?? 'ID');
    const [name, setName] = useState(editing?.name ?? '');
    const [type, setType] = useState<PropertyType>(editing?.type ?? 'text');
    const [options, setOptions] = useState(editing?.options?.join(', ') ?? '');
    const [formula, setFormula] = useState(editing?.formula ?? '');
    const [cardinality, setCardinality] = useState<'one' | 'many'>(editing?.cardinality ?? 'many');
    const [target, setTarget] = useState(editing?.targetDatabaseId ?? '');
    const [relation, setRelation] = useState(editing?.relationPropertyId ?? '');
    const [aggregation, setAggregation] = useState<DatabaseProperty['aggregation']>(editing?.aggregation ?? 'count');
    const [targetProperty, setTargetProperty] = useState(editing?.targetPropertyId ?? '');
    const surface = useRef<HTMLFormElement>(null);
    useDialogFocusTrap({
        open: true,
        surfaceRef: surface,
        onEscape: () => {
            if (!busy) onClose();
        },
    });
    const relationProperty = database.properties.find((prop) => prop.id === relation);
    const targetDb = databases.find((db) => db.id === relationProperty?.targetDatabaseId);
    const inputClass = 'mt-1 w-full rounded-control border border-border-primary bg-bg-primary p-2 text-sm';
    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-overlay p-4">
            <form
                ref={surface}
                role="dialog"
                aria-modal="true"
                aria-label={editing ? '속성 설정' : '속성 추가'}
                className="w-full max-w-md space-y-4 rounded-panel border border-border-primary bg-bg-secondary p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    onSave({
                        name,
                        type,
                        ...(type === 'unique_id' ? { prefix } : {}),
                        ...(['select', 'multi_select', 'status'].includes(type)
                            ? {
                                  options: options
                                      .split(',')
                                      .map((value) => value.trim())
                                      .filter(Boolean),
                              }
                            : {}),
                        ...(type === 'formula' ? { formula } : {}),
                        ...(type === 'relation'
                            ? { targetDatabaseId: target, cardinality, bidirectional, inverseName }
                            : {}),
                        ...(type === 'rollup'
                            ? {
                                  relationPropertyId: relation,
                                  aggregation,
                                  ...(aggregation !== 'count' ? { targetPropertyId: targetProperty } : {}),
                              }
                            : {}),
                    });
                }}
            >
                <h3 className="font-semibold">{editing ? '속성 설정' : '속성 추가'}</h3>
                <label className="block text-xs">
                    속성 이름
                    <input
                        required
                        maxLength={80}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputClass}
                    />
                </label>
                {type === 'unique_id' && (
                    <label className="block text-xs">
                        ID 접두사
                        <input
                            aria-label="ID 접두사"
                            maxLength={20}
                            value={prefix}
                            onChange={(event) => setPrefix(event.target.value)}
                            className={inputClass}
                        />
                    </label>
                )}
                <label className="block text-xs">
                    유형
                    <select
                        aria-label="유형"
                        disabled={!!editing}
                        value={type}
                        onChange={(e) => setType(e.target.value as PropertyType)}
                        className={inputClass}
                    >
                        {Object.entries(PROPERTY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                {type === 'formula' && (
                    <label className="block text-xs">
                        수식
                        <textarea
                            aria-label="수식"
                            required
                            maxLength={4000}
                            className={inputClass}
                            value={formula}
                            onChange={(e) => setFormula(e.target.value)}
                            placeholder={'if(prop("상태") == "게시됨", "완료", "진행 중")'}
                        />
                        <span className="mt-2 block text-text-secondary">
                            prop("속성 이름")으로 참조합니다. 산술·조건·텍스트·목록·날짜 함수를 사용할 수 있습니다.
                        </span>
                    </label>
                )}
                {['select', 'multi_select', 'status'].includes(type) && (
                    <label className="block text-xs">
                        선택 항목 (쉼표로 구분)
                        <input
                            required
                            value={options}
                            onChange={(e) => setOptions(e.target.value)}
                            className={inputClass}
                        />
                    </label>
                )}
                {type === 'relation' && (
                    <label className="block text-xs">
                        연결할 데이터베이스
                        <select
                            aria-label="연결할 데이터베이스"
                            required
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                            className={inputClass}
                        >
                            <option value="">선택하세요</option>
                            {databases.map((db) => (
                                <option key={db.id} value={db.id}>
                                    {db.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {type === 'relation' && (
                    <label className="block text-xs">
                        연결 제한
                        <select
                            aria-label="연결 제한"
                            className={inputClass}
                            value={cardinality}
                            onChange={(e) => setCardinality(e.target.value as 'one' | 'many')}
                        >
                            <option value="many">여러 페이지</option>
                            <option value="one">한 페이지</option>
                        </select>
                    </label>
                )}
                {type === 'relation' && (
                    <div className="space-y-2 text-xs">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={bidirectional}
                                onChange={(event) => setBidirectional(event.target.checked)}
                            />
                            대상 데이터베이스에도 관계 표시
                        </label>
                        {bidirectional && (
                            <label className="block">
                                대상 관계 이름
                                <input
                                    aria-label="대상 관계 이름"
                                    required
                                    maxLength={80}
                                    value={inverseName}
                                    onChange={(event) => setInverseName(event.target.value)}
                                    className={inputClass}
                                />
                            </label>
                        )}
                    </div>
                )}
                {type === 'rollup' && (
                    <>
                        <label className="block text-xs">
                            관계형 속성
                            <select
                                aria-label="관계형 속성"
                                required
                                value={relation}
                                onChange={(e) => {
                                    setRelation(e.target.value);
                                    setTargetProperty('');
                                }}
                                className={inputClass}
                            >
                                <option value="">선택하세요</option>
                                {database.properties
                                    .filter((prop) => prop.type === 'relation')
                                    .map((prop) => (
                                        <option key={prop.id} value={prop.id}>
                                            {prop.name}
                                        </option>
                                    ))}
                            </select>
                        </label>
                        <label className="block text-xs">
                            계산
                            <select
                                aria-label="계산"
                                value={aggregation}
                                onChange={(e) => setAggregation(e.target.value as DatabaseProperty['aggregation'])}
                                className={inputClass}
                            >
                                {Object.entries(AGGREGATION_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {aggregation !== 'count' && (
                            <label className="block text-xs">
                                {NUMERIC_AGGREGATIONS.includes(aggregation!) ? '집계할 숫자 속성' : '집계할 속성'}
                                <select
                                    aria-label={
                                        NUMERIC_AGGREGATIONS.includes(aggregation!) ? '집계할 숫자 속성' : '집계할 속성'
                                    }
                                    required
                                    value={targetProperty}
                                    onChange={(e) => setTargetProperty(e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">선택하세요</option>
                                    {targetDb?.properties
                                        .filter((prop) =>
                                            NUMERIC_AGGREGATIONS.includes(aggregation!)
                                                ? prop.type === 'number'
                                                : DATE_AGGREGATIONS.includes(aggregation!)
                                                  ? ['date', 'created_time', 'last_edited_time'].includes(prop.type)
                                                  : !['formula', 'rollup'].includes(prop.type) && !prop.reverseOf,
                                        )
                                        .map((prop) => (
                                            <option key={prop.id} value={prop.id}>
                                                {prop.name}
                                            </option>
                                        ))}
                                </select>
                            </label>
                        )}
                        <p className="text-xs text-text-secondary">열람 가능한 연결 문서의 값만 계산합니다.</p>
                    </>
                )}
                {error && (
                    <p role="alert" className="text-xs text-error">
                        {error}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    {editing && onArchive && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={onArchive}
                            className="mr-auto rounded-control px-3 py-2 text-sm text-error hover:bg-bg-hover"
                        >
                            속성 삭제
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onClose}
                        className="rounded-control border border-border-primary px-3 py-2 text-sm"
                    >
                        취소
                    </button>
                    <button disabled={busy} className="rounded-control bg-action px-3 py-2 text-sm text-white">
                        {editing ? '변경 적용' : '속성 만들기'}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
}
