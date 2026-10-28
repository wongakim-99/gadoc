'use client';
import { NUMBER_FORMATS, type NumberFormat } from '@slacord/document-core';
import { AGGREGATION_LABELS, NUMERIC_AGGREGATIONS, DATE_AGGREGATIONS } from '@slacord/document-core';
import { useLayoutEffect, useRef, useState } from 'react';
import { AlignLeft, Hash, Users, CircleDot, CalendarDays, SquareCheck, Link, ListFilter, ListChecks, ArrowUpRight, Sigma, Mail, Phone, Clock, User, FunctionSquare, Fingerprint, Search, Plus, X, type LucideIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useDialogFocusTrap } from '@/src/shared/ui/useDialogFocusTrap';
import { PROPERTY_LABELS, type DatabaseProperty, type KnowledgeDatabase, type PropertyType } from '../model/types';

const PROPERTY_ICONS: Record<PropertyType, LucideIcon> = {
    text: AlignLeft, number: Hash, person: Users, status: CircleDot, date: CalendarDays,
    checkbox: SquareCheck, url: Link, select: ListFilter, multi_select: ListChecks,
    relation: ArrowUpRight, rollup: Sigma, email: Mail, phone: Phone,
    created_time: Clock, created_by: User, last_edited_time: Clock, last_edited_by: User,
    formula: FunctionSquare, unique_id: Fingerprint,
};

function nextPropertyName(database: KnowledgeDatabase, type: PropertyType) {
    const base = PROPERTY_LABELS[type];
    const names = new Set(database.properties.map((property) => property.name));
    let name = base;
    for (let suffix = 2; names.has(name); suffix += 1) name = `${base} ${suffix}`;
    return name;
}

export function PropertyEditor({
    database,
    editing,
    databases,
    busy,
    error,
    onClose,
    onArchive,
    onSave,
    anchorRect,
    allowedTypes,
}: {
    database: KnowledgeDatabase;
    editing?: DatabaseProperty;
    databases: KnowledgeDatabase[];
    busy: boolean;
    error: string;
    onClose: () => void;
    onArchive?: () => void;
    onSave: (property: Omit<DatabaseProperty, 'id'>) => void;
    anchorRect?: { left: number; right: number; top: number; bottom: number };
    allowedTypes?: PropertyType[];
}) {
    const [bidirectional, setBidirectional] = useState(!!editing?.inverse);
    const [inverseName, setInverseName] = useState(editing?.inverse?.name ?? '연결된 항목');
    const [numberFormat, setNumberFormat] = useState<NumberFormat>(editing?.numberFormat ?? 'number');
    const [prefix, setPrefix] = useState(editing?.prefix ?? 'ID');
    const [name, setName] = useState(editing?.name ?? '');
    const [typeSearch, setTypeSearch] = useState('');
    const [choosingType, setChoosingType] = useState(!editing);
    const [type, setType] = useState<PropertyType>(editing?.type ?? 'text');
    const [options, setOptions] = useState<string[]>(editing?.options ?? []);
    const [newOption, setNewOption] = useState('');
    const [formula, setFormula] = useState(editing?.formula ?? '');
    const [cardinality, setCardinality] = useState<'one' | 'many'>(editing?.cardinality ?? 'many');
    const [target, setTarget] = useState(editing?.targetDatabaseId ?? '');
    const [relation, setRelation] = useState(editing?.relationPropertyId ?? '');
    const [aggregation, setAggregation] = useState<DatabaseProperty['aggregation']>(editing?.aggregation ?? 'count');
    const [targetProperty, setTargetProperty] = useState(editing?.targetPropertyId ?? '');
    const surface = useRef<HTMLFormElement>(null);
    const [position, setPosition] = useState({ left: 8, top: 8 });
    useLayoutEffect(() => {
        const place = () => {
            const element = surface.current;
            if (!element) return;
            const bounds = element.getBoundingClientRect();
            const left = anchorRect?.left ?? (window.innerWidth - bounds.width) / 2;
            let top = anchorRect ? anchorRect.bottom + 6 : Math.min(120, window.innerHeight / 5);
            if (anchorRect && top + bounds.height > window.innerHeight - 8 && anchorRect.top - bounds.height - 6 >= 8) {
                top = anchorRect.top - bounds.height - 6;
            }
            setPosition({
                left: Math.max(8, Math.min(left, window.innerWidth - bounds.width - 8)),
                top: Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8)),
            });
        };
        place();
        const observer = new ResizeObserver(place);
        if (surface.current) observer.observe(surface.current);
        window.addEventListener('resize', place);
        return () => { observer.disconnect(); window.removeEventListener('resize', place); };
    }, [anchorRect]);
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
    const visibleTypes = Object.entries(PROPERTY_LABELS).filter(([value, label]) =>
        (!allowedTypes || allowedTypes.includes(value as PropertyType)) &&
        `${label} ${value}`.toLowerCase().includes(typeSearch.trim().toLowerCase()),
    );
    const addOption = () => {
        const value = newOption.trim();
        if (value) setOptions((current) => current.includes(value) ? current : [...current, value]);
        setNewOption('');
    };
    const saveType = (nextType: PropertyType) => {
        setType(nextType);
        setChoosingType(false);
        setTypeSearch('');
        if (nextType === 'status') setOptions(['할 일', '진행 중', '완료']);
        if (['relation', 'rollup', 'formula'].includes(nextType)) return;
        onSave({
            name: name.trim() || nextPropertyName(database, nextType),
            type: nextType,
            ...(nextType === 'unique_id' ? { prefix } : {}),
            ...(nextType === 'status' ? { options: ['할 일', '진행 중', '완료'] } : {}),
            ...(['select', 'multi_select'].includes(nextType) ? { options: [] } : {}),
        });
    };
    return createPortal(
        <div className="fixed inset-0 z-[80]" onPointerDown={(event) => {
            if (event.target === event.currentTarget && !busy) onClose();
        }}>
            <form
                ref={surface}
                role="dialog"
                aria-modal="true"
                aria-label={editing ? '속성 설정' : '속성 추가'}
                style={position}
                className="fixed max-h-[calc(100dvh-16px)] w-[320px] max-w-[calc(100vw-16px)] space-y-3 overflow-y-auto rounded-panel border border-border-primary bg-bg-secondary p-3 shadow-xl"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (busy) return;
                    onSave({
                        name: name.trim() || nextPropertyName(database, type),
                        type,
                        ...(['number', 'formula', 'rollup'].includes(type) ? { numberFormat } : {}),
                        ...(type === 'unique_id' ? { prefix } : {}),
                        ...(['select', 'multi_select', 'status'].includes(type)
                            ? {
                                  options: [...new Set([...options, newOption.trim()].filter(Boolean))],
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
                <h3 className="text-sm font-medium">{editing ? '속성 설정' : '속성 추가'}</h3>
                <label className="block text-xs">
                    속성 이름
                    <input
                        maxLength={80}
                        value={name}
                        placeholder={nextPropertyName(database, type)}
                        disabled={busy}
                        onChange={(e) => setName(e.target.value)}
                        className={inputClass}
                    />
                </label>
                {['number', 'formula', 'rollup'].includes(type) && !choosingType && (
                    <label className="block text-xs">숫자 표시 형식
                        <select aria-label="숫자 표시 형식" value={numberFormat} disabled={busy}
                            onChange={(event) => setNumberFormat(event.target.value as NumberFormat)} className={inputClass}>
                            {NUMBER_FORMATS.map((format) => <option key={format} value={format}>
                                {{ number: '숫자', comma: '천 단위 구분', percent: '퍼센트', KRW: '원 (₩)', USD: '달러 ($)', EUR: '유로 (€)', JPY: '엔 (¥)', GBP: '파운드 (£)', CNY: '위안 (CN¥)' }[format]}
                            </option>)}
                        </select>
                    </label>
                )}
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
                {choosingType ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded-control border border-border-primary px-2">
                            <Search size={14} aria-hidden="true" className="shrink-0 text-text-secondary" />
                            <input aria-label="속성 유형 검색" placeholder="유형 검색…" value={typeSearch}
                                disabled={busy} onChange={(event) => setTypeSearch(event.target.value)}
                                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" />
                        </div>
                        <div aria-label="속성 유형" className="max-h-72 overflow-y-auto">
                            {visibleTypes.map(([value, label]) => {
                                const Icon = PROPERTY_ICONS[value as PropertyType];
                                return <button key={value} type="button" disabled={busy}
                                    onClick={() => saveType(value as PropertyType)}
                                    className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm hover:bg-bg-hover focus-visible:bg-bg-hover">
                                    <Icon size={16} aria-hidden="true" className="shrink-0 text-text-secondary" />{label}
                                </button>;
                            })}
                            {visibleTypes.length === 0 && (
                                <p className="px-2 py-3 text-xs text-text-secondary">일치하는 유형이 없습니다.</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-text-secondary">유형</span>
                        <button type="button" aria-label="유형" disabled={!!editing || busy}
                            onClick={() => setChoosingType(true)} className="rounded-control px-2 py-1 text-sm hover:bg-bg-hover disabled:cursor-default">
                            {PROPERTY_LABELS[type]}
                        </button>
                    </div>
                )}
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
                    <div className="space-y-2 text-xs">
                        <span className="text-text-secondary">선택 항목</span>
                        <ul className="space-y-1">
                            {options.map((option) => <li key={option} className="flex items-center gap-2 rounded-control bg-bg-primary px-2 py-1">
                                <span className="min-w-0 flex-1 break-words">{option}</span>
                                <button type="button" disabled={busy} aria-label={`${option} 삭제`}
                                    onClick={() => setOptions((current) => current.filter((value) => value !== option))}
                                    className="rounded-control p-1 text-text-secondary hover:bg-bg-hover"><X size={14} aria-hidden="true" /></button>
                            </li>)}
                        </ul>
                        <div className="flex items-center gap-1">
                            <input aria-label="선택 항목 추가" placeholder="새 옵션" maxLength={80} value={newOption} disabled={busy}
                                onChange={(event) => setNewOption(event.target.value)}
                                onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); addOption(); } }}
                                className="min-w-0 flex-1 rounded-control border border-border-primary bg-bg-primary p-2 text-sm" />
                            <button type="button" aria-label="옵션 추가" disabled={busy || !newOption.trim()} onClick={addOption}
                                className="rounded-control p-2 hover:bg-bg-hover disabled:opacity-40"><Plus size={16} aria-hidden="true" /></button>
                        </div>
                    </div>
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
                            {databases.filter((db) => db.sourceKind !== 'issues').map((db) => (
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
                <div className="flex flex-wrap justify-end gap-2 border-t border-border-primary pt-3">
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
                    {!choosingType && <button disabled={busy} className="rounded-control bg-action px-3 py-2 text-sm text-white">
                        {editing ? '변경 적용' : '속성 만들기'}
                    </button>}
                </div>
            </form>
        </div>,
        document.body,
    );
}
