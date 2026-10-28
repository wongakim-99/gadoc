'use client';

import { decodeOptionValue } from '@slacord/document-core';
import { databaseRowHref } from '../model/databaseRowHref';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, Filter, ArrowDownUp, Search, Table2, Plus, Maximize2 } from 'lucide-react';
import { DatabasePropertyIcon } from './DatabasePropertyIcon';
import { DatabaseRowActions } from './DatabaseRowActions';
import { DatabaseMenu } from './DatabaseMenu';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ApiError,
    databaseApi,
    databaseContainerApi,
    documentApi,
    unwrapApiArray,
    unwrapApiData,
} from '@/lib/api-client';
import { useTeamWorkspaceData } from '@/src/features/team/model/useTeamWorkspaceData';
import { ResourceNavigation } from '@/src/features/workspace/ui/ResourceNavigation';
import { useWorkspaceLeaveGuard } from '@/src/features/workspace/model/useWorkspaceConnection';
import { LinkPicker } from '@/src/features/issue/ui/LinkPicker';
import { useSavedDatabaseView } from '../model/useSavedDatabaseView';
import { DatabaseColumnResize } from './DatabaseColumnResize';
import { DatabaseCell } from './DatabaseCell';
import { creationRequestId } from '../model/creationRequestId';
import { databaseCsv } from '../model/databaseCsv';
import { filterDefaults } from '../model/filterDefaults';
import { DatabaseSources } from './DatabaseSources';
import { DatabaseCsvImport } from './DatabaseCsvImport';
import { DatabaseTemplates } from './DatabaseTemplates';
import { DatabaseTableFooter } from './DatabaseTableFooter';
import { DatabaseBoard } from './DatabaseBoard';
import { DatabaseVisualViews } from './DatabaseVisualViews';
import { DatabaseQueryBuilder } from './DatabaseQueryBuilder';
import { queryDatabaseRows, type FilterGroup, type SortRule, type Aggregation } from '@slacord/document-core';
import { DatabasePageTitle } from './DatabasePageTitle';
import { PropertyEditor } from './PropertyEditor';
import { readInlineDatabaseViews } from '../model/inlineDatabaseViews';
import { useDatabaseUpdates } from '../model/useDatabaseUpdates';
import { ProjectScopeBar } from '@/src/features/project/ui/ProjectScopeBar';
import {
    PROPERTY_LABELS,
    type DatabaseDetail,
    type DatabaseContainer,
    type DatabaseProperty,
    type KnowledgeDatabase,
    type DatabaseRow,
    type PropertyValue,
    type DatabaseView,
} from '../model/types';

export function DatabaseWorkspace({
    teamId,
    databaseId,
    inline = false,
    inlineState = '',
    onInlineStateChange,
}: {
    teamId: string;
    databaseId: string | null;
    inline?: boolean;
    inlineState?: string;
    onInlineStateChange?: (state: string) => void;
}) {
    const instanceId = useId();
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectId = inline ? '' : searchParams.get('project') ?? '';
    const projectSuffix = projectId ? `&project=${encodeURIComponent(projectId)}` : '';
    const [localViews, setLocalViews] = useState(() => readInlineDatabaseViews(inlineState));
    const [inlineView, setInlineView] = useState<string | null>(localViews.activeId);
    const initialView = useRef(localViews.views.find((item) => item.id === localViews.activeId)!);
    const stateCallback = useRef(onInlineStateChange);
    stateCallback.current = onInlineStateChange;
    const emittedState = useRef(inlineState);
    const [viewMenu, setViewMenu] = useState(false);
    const appliedView = useRef<string | null>(null);
    const workspace = useTeamWorkspaceData(teamId);
    const [databases, setDatabases] = useState<KnowledgeDatabase[]>([]);
    const [container, setContainer] = useState<DatabaseContainer | null>(null);
    const [dataSourceId, setDataSourceId] = useState(
        initialView.current.dataSourceId ?? searchParams.get('source') ?? '',
    );
    const loadScope = `${teamId}:${databaseId}:${dataSourceId}:${projectId}`;
    const latestScope = useRef(loadScope);
    latestScope.current = loadScope;
    const [database, setDatabase] = useState<DatabaseDetail | null>(null);
    const requestedView = inline ? inlineView : (searchParams.get('view') ?? database?.views[0]?.id ?? null);
    const isIssueSource = database?.sourceKind === 'issues';
    const canManageDatabase = workspace.canWrite && database?.canEditSchema !== false;
    const canManageViews = workspace.canWrite && (isIssueSource || canManageDatabase);
    const canCreateRows = canManageViews;
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [contextRow, setContextRow] = useState<string | null>(null);
    const duplicateCreation = useRef<{ key: string; id: string } | null>(null);
    const pageCreation = useRef<{ key: string; id: string } | null>(null);
    const [editingProperty, setEditingProperty] = useState<DatabaseProperty | undefined>();
    const [propertyOpen, setPropertyOpen] = useState(false);
    const [propertyAnchor, setPropertyAnchor] = useState<DOMRect>();
    const [titleNameDraft, setTitleNameDraft] = useState<string | null>(null);
    const draggedColumn = useRef<string | null>(null);
    const [dropColumn, setDropColumn] = useState<string | null>(null);
    const [documents, setDocuments] = useState<Array<{ id: string; title: string }> | null>(null);
    const [query, setQuery] = useState(inline ? initialView.current.query : '');
    const [status, setStatus] = useState(inline ? initialView.current.status : '');
    const [owner, setOwner] = useState(inline ? initialView.current.owner : '');
    const [sort, setSort] = useState<DatabaseView['sort']>(inline ? initialView.current.sort : 'manual');
    const [view, setView] = useState<DatabaseView['layout']>(inline ? initialView.current.layout : 'table');
    const [advancedFilter, setAdvancedFilter] = useState<FilterGroup>(
        initialView.current.filter ?? { conjunction: 'and', rules: [] },
    );
    const [advancedSorts, setAdvancedSorts] = useState<SortRule[]>(initialView.current.sorts ?? []);
    const [dateProperty, setDateProperty] = useState(initialView.current.dateProperty ?? '');
    const [calculations, setCalculations] = useState<Record<string, Aggregation>>(
        initialView.current.calculations ?? {},
    );
    const [propertyOrder, setPropertyOrder] = useState<string[]>(initialView.current.propertyOrder ?? []);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(initialView.current.columnWidths ?? {});
    const [hiddenProperties, setHiddenProperties] = useState<string[]>(
        initialView.current.hiddenProperties ?? localViews.hiddenProperties,
    );
    const [groupProperty, setGroupProperty] = useState(initialView.current.groupProperty ?? 'status');
    const [endProperty, setEndProperty] = useState(initialView.current.endProperty ?? '');
    const [restoreViewVersion, setRestoreViewVersion] = useState(0);
    const [savedViewName, setSavedViewName] = useState('');
    const [readyView, setReadyView] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [viewName, setViewName] = useState('');
    const [newViewLayout, setNewViewLayout] = useState<DatabaseView['layout']>('table');
    const [savingView, setSavingView] = useState(false);
    useEffect(() => {
        if (!inline || !stateCallback.current) return;
        const next = {
            ...localViews,
            activeId: inlineView ?? localViews.activeId,
            views: localViews.views.map((item) =>
                item.id === inlineView
                    ? {
                          ...item,
                          layout: view,
                          query,
                          status,
                          owner,
                          sort,
                          dateProperty,
                          endProperty,
                          groupProperty,
                          dataSourceId,
                          hiddenProperties,
                          propertyOrder,
                          columnWidths,
                          calculations,
                          filter: advancedFilter,
                          sorts: advancedSorts,
                      }
                    : item,
            ),
        };
        const serialized = JSON.stringify(next);
        if (emittedState.current === serialized) return;
        let active = true;
        queueMicrotask(() => {
            if (!active || emittedState.current === serialized) return;
            emittedState.current = serialized;
            stateCallback.current?.(serialized);
        });
        return () => {
            active = false;
        };
    }, [
        inline,
        inlineView,
        localViews,
        view,
        query,
        status,
        owner,
        sort,
        dateProperty,
        endProperty,
        groupProperty,
        dataSourceId,
        hiddenProperties,
        propertyOrder,
        columnWidths,
        calculations,
        advancedFilter,
        advancedSorts,
    ]);
    useEffect(() => {
        if (inline) return;
        if (!requestedView || appliedView.current === requestedView) return;
        const saved = database?.views.find((item) => item.id === requestedView);
        if (!saved) return;
        setView(saved.layout);
        setSavedViewName(saved.name);
        setQuery(saved.query);
        setOwner(saved.owner);
        setStatus(saved.status);
        setSort(saved.sort);
        setDateProperty(saved.dateProperty ?? '');
        setEndProperty(saved.endProperty ?? '');
        setGroupProperty(saved.groupProperty ?? 'status');
        setDataSourceId(saved.dataSourceId || database!.id);
        setHiddenProperties(saved.hiddenProperties ?? []);
        setPropertyOrder(saved.propertyOrder ?? []);
        setColumnWidths(saved.columnWidths ?? {});
        setCalculations(saved.calculations ?? {});
        setAdvancedFilter(saved.filter ?? { conjunction: 'and', rules: [] });
        setAdvancedSorts(saved.sorts ?? []);
        appliedView.current = requestedView;
        setReadyView(requestedView);
    }, [database, requestedView, inline, restoreViewVersion]);
    useWorkspaceLeaveGuard(() => !pending.current);
    const loadVersion = useRef(0);
    const load = useCallback(async () => {
        const requestVersion = ++loadVersion.current;
        try {
            const list = await databaseApi.list(teamId);
            const containerResult = databaseId ? await databaseContainerApi.read(teamId, databaseId) : null;
            const nextContainer = containerResult?.data ?? null;
            const sourceId =
                nextContainer?.sources.find((source) => source.id === dataSourceId)?.id ??
                nextContainer?.sources[0]?.id;
            const detail = sourceId ? await databaseApi.read(teamId, sourceId, projectId || undefined) : null;
            if (
                requestVersion !== loadVersion.current ||
                latestScope.current !== `${teamId}:${databaseId}:${dataSourceId}:${projectId}`
            )
                return;
            if (databaseId && nextContainer && !sourceId)
                throw new ApiError('접근 가능한 데이터 소스가 없습니다.', 403);
            if (!list.success || (databaseId && (!nextContainer || !detail?.data)))
                throw new Error('데이터베이스를 불러오지 못했습니다.');
            setDatabases(list.data ?? []);
            setContainer(nextContainer);
            setDatabase(detail?.data ?? null);
        } catch (error) {
            if (
                requestVersion === loadVersion.current &&
                latestScope.current === `${teamId}:${databaseId}:${dataSourceId}:${projectId}` &&
                error instanceof ApiError &&
                [401, 403, 404].includes(error.status)
            ) {
                setDatabase(null);
                setContainer(null);
                setError(error.message);
            }
            throw error;
        }
    }, [teamId, databaseId, dataSourceId, projectId]);
    useEffect(() => {
        let active = true;
        setLoading(true);
        void load()
            .catch((error) => {
                if (active) {
                    setDatabase(null);
                    setError(error instanceof Error ? error.message : '불러오기 오류');
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [load]);
    const notifyDatabaseUpdated = useDatabaseUpdates(teamId, databaseId, async () => {
        // The mutation refresh must finish before enabling edits with its new revision.
        // A socket echo must not supersede that awaited request and leave stale rows enabled.
        if (!pending.current) await load();
    });
    const mutate = async (action: () => Promise<unknown>, message: string) => {
        if (pending.current) return false;
        pending.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            await action();
            notifyDatabaseUpdated();
            setNotice(message);
            await load();
            return true;
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : '저장하지 못했습니다. 다시 시도하세요.');
            return false;
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };
    const selectedSavedView = !inline ? database?.views.find((item) => item.id === requestedView) : undefined;
    const savedViewState = useSavedDatabaseView({
        teamId,
        databaseId: database?.id,
        serverView: selectedSavedView,
        currentView: selectedSavedView
            ? {
                  ...selectedSavedView,
                  name: savedViewName,
                  layout: view,
                  query,
                  status,
                  owner,
                  sort,
                  dateProperty,
                  endProperty,
                  groupProperty,
                  dataSourceId,
                  hiddenProperties,
                  propertyOrder,
                  columnWidths,
                  calculations,
                  filter: advancedFilter,
                  sorts: advancedSorts,
              }
            : undefined,
        revision: database?.revision ?? 0,
        enabled:
            !inline &&
            readyView === requestedView &&
            !!selectedSavedView &&
            canManageViews &&
            !database?.locked &&
            !busy,
        onSaved: async () => {
            notifyDatabaseUpdated();
            await load();
            setNotice('보기 설정 저장됨');
        },
        onError: setError,
    });
    useWorkspaceLeaveGuard(() => !savedViewState.dirty && !savedViewState.saving);
    const [focusRow, setFocusRow] = useState<string | null>(null);
    const [revealedRow, setRevealedRow] = useState<string | null>(null);
    useEffect(() => setRevealedRow(null), [query, status, owner, inlineView]);
    useEffect(() => {
        if (!focusRow || !database?.rows.some((row) => row.documentId === focusRow)) return;
        const frame = requestAnimationFrame(() => {
            const input = document.querySelector<HTMLInputElement>(
                `[data-database-instance="${instanceId}"] [data-page-name="${focusRow}"]`,
            );
            input?.focus();
            input?.select();
            setFocusRow(null);
        });
        return () => cancelAnimationFrame(frame);
    }, [focusRow, database]);
    const prepareLayout = async (layout: DatabaseView['layout']) => {
        let nextGroup = groupProperty,
            nextDate = dateProperty,
            revision = database!.revision;
        if (layout === 'board') {
            const groupable = database!.properties.filter((prop) =>
                ['status', 'select', 'multi_select', 'person', 'checkbox'].includes(prop.type),
            );
            const existing =
                groupable.find((prop) => prop.id === groupProperty) ??
                groupable.find((prop) => prop.type === 'status') ??
                groupable[0];
            if (existing) nextGroup = existing.id;
            else {
                if (!canManageDatabase || database!.locked) throw new Error('보드에 사용할 상태 속성이 필요합니다.');
                const response = await databaseApi.addProperty(teamId, database!.id, {
                    name: database!.properties.some((prop) => prop.name === '상태') ? '진행 상태' : '상태',
                    type: 'status',
                    options: ['시작 전', '진행 중', '완료'],
                    revision,
                });
                if (!response.data) throw new Error('상태 속성을 만들지 못했습니다.');
                nextGroup = response.data.id;
                revision++;
            }
        }
        if (layout === 'calendar' || layout === 'timeline') {
            const dates = database!.properties.filter((prop) => prop.type === 'date');
            const existing = dates.find((prop) => prop.id === dateProperty) ?? dates[0];
            if (existing) nextDate = existing.id;
            else {
                if (!canManageDatabase || database!.locked)
                    throw new Error('일정 보기에 사용할 날짜 속성이 필요합니다.');
                const response = await databaseApi.addProperty(teamId, database!.id, {
                    name: database!.properties.some((prop) => prop.name === '날짜') ? '일정 날짜' : '날짜',
                    type: 'date',
                    revision,
                });
                if (!response.data) throw new Error('날짜 속성을 만들지 못했습니다.');
                nextDate = response.data.id;
                revision++;
            }
        }
        return { groupProperty: nextGroup, dateProperty: nextDate, revision };
    };
    const createPage = (title: string) =>
        mutate(async () => {
            const defaults = filterDefaults(database?.properties ?? [], advancedFilter, status, owner);
            const result = await databaseApi.createRowPage(
                teamId,
                database!.id,
                title,
                creationRequestId(pageCreation, `${database!.id}:${projectId}:${title}`),
                defaults,
                isIssueSource && projectId ? (projectId === 'unassigned' ? null : projectId) : undefined,
            );
            if (!result.data) throw new Error('페이지를 만들지 못했습니다.');
            const documentId = result.data.documentId;
            pageCreation.current = null;
            window.dispatchEvent(new CustomEvent('slacord:documents-refresh'));

            setRevealedRow(documentId);
            setFocusRow(documentId);
        }, isIssueSource ? '이슈를 추가했습니다.' : '페이지를 추가했습니다.');
    const orderedProperties = [...(database?.properties ?? [])].sort((a, b) => {
        const rank = (id: string) => (propertyOrder.includes(id) ? propertyOrder.indexOf(id) : propertyOrder.length);
        return rank(a.id) - rank(b.id);
    });
    const tableProperties = orderedProperties.filter((prop) => !hiddenProperties.includes(prop.id));
    const titleColumn: DatabaseProperty = { id: 'title', name: database?.titlePropertyName || '이름', type: 'text' };
    const allColumns = [titleColumn, ...orderedProperties].sort((a, b) => {
        const order = propertyOrder.includes('title') ? propertyOrder : ['title', ...propertyOrder];
        const rank = (id: string) => order.includes(id) ? order.indexOf(id) : order.length;
        return rank(a.id) - rank(b.id);
    });
    const tableColumns = allColumns.filter((prop) => prop.id === 'title' || !hiddenProperties.includes(prop.id));
    const columnDragProps = (id: string) => ({
        tabIndex: canManageViews ? 0 : -1,
        'aria-keyshortcuts': 'Alt+Shift+ArrowLeft Alt+Shift+ArrowRight',
        title: '드래그하여 순서 변경 · Alt+Shift+방향키',
        draggable: canManageViews && !database?.locked && !busy,
        onDragStart: (event: React.DragEvent) => {
            event.stopPropagation();
            draggedColumn.current = id;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-gadoc-column', `${instanceId}:${id}`);
        },
        onDragOver: (event: React.DragEvent) => {
            if (!draggedColumn.current || draggedColumn.current === id) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'move';
            setDropColumn(id);
        },
        onDrop: (event: React.DragEvent) => {
            const source = draggedColumn.current;
            if (!source || event.dataTransfer.getData('application/x-gadoc-column') !== `${instanceId}:${source}`) return;
            event.preventDefault();
            event.stopPropagation();
            const order = allColumns.map((prop) => prop.id);
            const from = order.indexOf(source), to = order.indexOf(id);
            order.splice(from, 1);
            order.splice(to, 0, source);
            setPropertyOrder(order);
            draggedColumn.current = null;
            setDropColumn(null);
        },
        onDragEnd: () => { draggedColumn.current = null; setDropColumn(null); },
        onKeyDown: (event: React.KeyboardEvent) => {
            if (!event.altKey || !event.shiftKey || !canManageViews || database?.locked) return;
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            event.stopPropagation();
            const order = allColumns.map((prop) => prop.id);
            const from = order.indexOf(id), to = from + (event.key === 'ArrowLeft' ? -1 : 1);
            if (to < 0 || to >= order.length) return;
            [order[from], order[to]] = [order[to], order[from]];
            setPropertyOrder(order);
        },
    });
    const columnWidth = (id: string, fallback = 140) =>
        Math.max(120, Math.min(800, Number.isFinite(columnWidths[id]) ? columnWidths[id] : fallback));
    const setWidth = (id: string, width: number) => setColumnWidths((current) => ({ ...current, [id]: width }));
    const moveColumn = (id: string, direction: number) => {
        const order = allColumns.map((prop) => prop.id),
            index = order.indexOf(id),
            next = index + direction;
        if (next < 0 || next >= order.length) return;
        [order[index], order[next]] = [order[next], order[index]];
        setPropertyOrder(order);
    };
    const saveCell = async (row: DatabaseRow, propertyId: string, value: PropertyValue) => {
        return mutate(
            () =>
                databaseApi.updateCell(
                    teamId,
                    database!.id,
                    row.documentId,
                    propertyId,
                    value,
                    row.revision,
                    row.relationRevisions?.[propertyId],
                ),
            '저장됨',
        );
    };
    const basicRows =
        database?.rows
            .filter(
                (row) =>
                    row.documentId === revealedRow ||
                    ((!status || row.values.status === decodeOptionValue(database.properties.find((p) => p.id === 'status')?.optionIdentities ?? [], status)) &&
                        (!owner || (Array.isArray(row.values.owner) && row.values.owner.includes(owner)))),
            )
            .sort((a, b) =>
                sort === 'manual'
                    ? 0
                    : sort === 'title-desc'
                      ? b.title.localeCompare(a.title)
                      : sort === 'reviewDate'
                        ? String(a.values.reviewDate ?? '9999').localeCompare(String(b.values.reviewDate ?? '9999'))
                        : a.title.localeCompare(b.title),
            ) ?? [];
    const queryResult = useMemo(() => {
        try {
            const rows = queryDatabaseRows(basicRows, database?.properties ?? [], {
                filter: advancedFilter,
                sorts: advancedSorts,
                search: query,
            });
            const newlyCreated = basicRows.find((row) => row.documentId === revealedRow);
            if (newlyCreated && !rows.includes(newlyCreated)) rows.push(newlyCreated);
            return { rows, error: '' };
        } catch (error) {
            return { rows: [], error: error instanceof Error ? error.message : '조회 설정을 확인하세요.' };
        }
    }, [basicRows, database?.properties, advancedFilter, advancedSorts, query, revealedRow]);
    const filtered = queryResult.rows;
    const inputClass = 'rounded-control border border-border-primary bg-bg-primary px-3 py-2 text-sm';
    const buttonClass =
        'inline-flex items-center gap-1.5 rounded-control px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-50';
    return (
        <div
            data-database-instance={instanceId}
            className={inline ? 'group/database min-w-0 bg-bg-primary' : 'flex h-full min-h-0 flex-col'}
        >
            <header className={inline ? 'flex items-center justify-between gap-3 pb-2' : 'workspace-topbar'}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    {!inline && (
                        <Link href={`/${teamId}/docs`} className="shrink-0 text-sm text-text-secondary">
                            문서
                        </Link>
                    )}
                    {!inline && <span aria-hidden="true" className="text-text-tertiary">/</span>}
                    <h2 className="min-w-0 flex-1" aria-label={database?.name ?? '데이터베이스'}>
                        {database ? (
                            <DatabasePageTitle
                                key={database.id}
                                title={database.name}
                                href={`/${teamId}/docs?database=${database.id}`}
                                canEdit={canManageDatabase && !database.locked}
                                showOpen={false}
                                inputLabel="데이터베이스 제목"
                                maxLength={100}
                                onSave={(name) =>
                                    mutate(
                                        () => databaseApi.rename(teamId, database.id, name, database.revision),
                                        '이름을 변경했습니다.',
                                    )
                                }
                            />
                        ) : (
                            '데이터베이스'
                        )}
                    </h2>
                </div>
                <Link
                    href={inline ? `/${teamId}/docs?database=${databaseId}` : `/${teamId}/docs`}
                    data-open-in-current-pane
                    className={buttonClass}
                >
                    {inline ? (
                        <>
                            <Maximize2 size={15} />
                            <span className="sr-only">전체 페이지로 열기</span>
                        </>
                    ) : (
                        '페이지 목록'
                    )}
                </Link>
            </header>
            {isIssueSource && !inline && <ProjectScopeBar teamId={teamId} />}
            <div className={inline ? 'space-y-1' : 'flex-1 space-y-2 overflow-auto p-4 sm:p-6'}>
                {queryResult.error && (
                    <p role="alert" className="text-sm text-error">
                        {queryResult.error}
                        <button
                            onClick={() => {
                                setAdvancedFilter({ conjunction: 'and', rules: [] });
                                setAdvancedSorts([]);
                            }}
                        >
                            조회 설정 초기화
                        </button>
                    </p>
                )}
                {error && (
                    <div role="alert" className="flex items-center gap-3 text-sm text-error">
                        {error}
                        {savedViewState.failed && (
                            <>
                                <button
                                    type="button"
                                    className={buttonClass}
                                    onClick={() => {
                                        savedViewState.rebase();
                                        setError('');
                                    }}
                                >
                                    내 보기 설정으로 다시 저장
                                </button>
                                <button
                                    type="button"
                                    className={buttonClass}
                                    onClick={() => {
                                        savedViewState.rebase();
                                        appliedView.current = null;
                                        setReadyView(null);
                                        setRestoreViewVersion((value) => value + 1);
                                        setError('');
                                    }}
                                >
                                    서버 보기 설정 사용
                                </button>
                            </>
                        )}
                        <button
                            className={buttonClass}
                            disabled={busy}
                            onClick={() => void mutate(load, '새로고침했습니다.')}
                        >
                            새로고침
                        </button>
                    </div>
                )}
                <p role="status" className="sr-only">
                    {busy ? '저장 중…' : loading ? '불러오는 중…' : notice}
                </p>
                {database && !loading && (
                    <>
                        <div className="flex flex-wrap items-center gap-1 pb-2" aria-label="저장된 보기">
                            {!(inline ? localViews.views : database.views).length && (
                                <button
                                    type="button"
                                    className="flex items-center gap-2 rounded-control bg-bg-hover px-3 py-1.5 text-sm font-medium"
                                    onClick={() => setSettingsOpen(true)}
                                >
                                    <Table2 size={15} />표
                                </button>
                            )}
                            {(inline ? localViews.views : database.views).map((item) => (
                                <button
                                    key={item.id}
                                    disabled={!inline && (savedViewState.dirty || savedViewState.saving)}
                                    aria-pressed={requestedView === item.id}
                                    className={buttonClass}
                                    onClick={() => {
                                        appliedView.current = null;
                                        if (inline) {
                                            setLocalViews((current) => ({
                                                ...current,
                                                views: current.views.map((saved) =>
                                                    saved.id === inlineView
                                                        ? {
                                                              ...saved,
                                                              layout: view,
                                                              query,
                                                              status,
                                                              owner,
                                                              sort,
                                                              dateProperty,
                                                              endProperty,
                                                              groupProperty,
                                                              dataSourceId,
                                                              hiddenProperties,
                                                              propertyOrder,
                                                              columnWidths,
                                                              calculations,
                                                              filter: advancedFilter,
                                                              sorts: advancedSorts,
                                                          }
                                                        : saved,
                                                ),
                                            }));
                                            setInlineView(item.id);
                                            setView(item.layout);
                                            setQuery(item.query);
                                            setStatus(item.status);
                                            setOwner(item.owner);
                                            setSort(item.sort);
                                            setDateProperty(item.dateProperty ?? '');
                                            setEndProperty(item.endProperty ?? '');
                                            setGroupProperty(item.groupProperty ?? 'status');
                                            setDataSourceId(item.dataSourceId ?? '');
                                            setHiddenProperties(item.hiddenProperties ?? []);
                                            setPropertyOrder(item.propertyOrder ?? []);
                                            setColumnWidths(item.columnWidths ?? {});
                                            setCalculations(item.calculations ?? {});
                                            setAdvancedFilter(item.filter ?? { conjunction: 'and', rules: [] });
                                            setAdvancedSorts(item.sorts ?? []);
                                            return;
                                        }
                                        router.replace(
                                            `/${teamId}/docs?database=${databaseId ?? database.id}&source=${database.id}&view=${item.id}${projectSuffix}`,
                                            {
                                                scroll: false,
                                            },
                                        );
                                    }}
                                >
                                    {item.name}
                                </button>
                            ))}
                            {canManageViews && (
                                <>
                                    <DatabaseMenu
                                        label="+ 보기 추가"
                                        icon={<Plus size={16} />}
                                        open={savingView}
                                        onOpenChange={(open) => {
                                            if (open) {
                                                setNewViewLayout(view);
                                                setViewName(
                                                    {
                                                        table: '표',
                                                        board: '보드',
                                                        list: '목록',
                                                        gallery: '갤러리',
                                                        calendar: '달력',
                                                        timeline: '타임라인',
                                                        chart: '차트',
                                                    }[view],
                                                );
                                            }
                                            setSavingView(open);
                                        }}
                                    >
                                        <form
                                            className="flex flex-wrap gap-2"
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                void mutate(async () => {
                                                    const prepared = await prepareLayout(newViewLayout);
                                                    if (inline) {
                                                        if (!viewName.trim() || localViews.views.length >= 50)
                                                            throw new Error('보기 이름과 개수를 확인하세요.');
                                                        const id = crypto.randomUUID();
                                                        setLocalViews((current) => ({
                                                            ...current,
                                                            activeId: id,
                                                            views: [
                                                                ...current.views.map((saved) =>
                                                                    saved.id === inlineView
                                                                        ? {
                                                                              ...saved,
                                                                              layout: view,
                                                                              query,
                                                                              status,
                                                                              owner,
                                                                              sort,
                                                                              dateProperty,
                                                                              endProperty,
                                                                              groupProperty,
                                                                              dataSourceId,
                                                                              hiddenProperties,
                                                                              propertyOrder,
                                                                              columnWidths,
                                                                              calculations,
                                                                              filter: advancedFilter,
                                                                              sorts: advancedSorts,
                                                                          }
                                                                        : saved,
                                                                ),
                                                                {
                                                                    id,
                                                                    name: viewName.trim(),
                                                                    layout: newViewLayout,
                                                                    query,
                                                                    status,
                                                                    owner,
                                                                    sort,
                                                                    dateProperty: prepared.dateProperty,
                                                                    endProperty,
                                                                    groupProperty: prepared.groupProperty,
                                                                    dataSourceId,
                                                                    hiddenProperties,
                                                                    propertyOrder,
                                                                    columnWidths,
                                                                    calculations,
                                                                    filter: advancedFilter,
                                                                    sorts: advancedSorts,
                                                                },
                                                            ],
                                                        }));
                                                        setInlineView(id);
                                                        setView(newViewLayout);
                                                        setGroupProperty(prepared.groupProperty);
                                                        setDateProperty(prepared.dateProperty);
                                                        setSavingView(false);
                                                        setViewName('');
                                                        return;
                                                    }
                                                    const createdView = await databaseApi.addView(teamId, database.id, {
                                                        name: viewName,
                                                        layout: newViewLayout,
                                                        query,
                                                        status,
                                                        owner,
                                                        sort,
                                                        dateProperty: prepared.dateProperty,
                                                        endProperty,
                                                        groupProperty: prepared.groupProperty,
                                                        dataSourceId,
                                                        hiddenProperties,
                                                        propertyOrder,
                                                        columnWidths,
                                                        calculations,
                                                        filter: advancedFilter,
                                                        sorts: advancedSorts,
                                                        revision: prepared.revision,
                                                    });
                                                    setSavingView(false);
                                                    setViewName('');
                                                    if (createdView.data)
                                                        router.replace(
                                                            `/${teamId}/docs?database=${databaseId ?? database.id}&source=${database.id}&view=${createdView.data.id}${projectSuffix}`,
                                                            { scroll: false },
                                                        );
                                                }, '보기와 필터를 저장했습니다.');
                                            }}
                                        >
                                            <label className="w-full text-xs">
                                                보기 종류
                                                <select
                                                    aria-label="새 보기 레이아웃"
                                                    className={`${inputClass} mt-1 w-full`}
                                                    value={newViewLayout}
                                                    onChange={(event) => {
                                                        const value = event.target.value as DatabaseView['layout'];
                                                        setNewViewLayout(value);
                                                        setViewName(
                                                            {
                                                                table: '표',
                                                                board: '보드',
                                                                list: '목록',
                                                                gallery: '갤러리',
                                                                calendar: '달력',
                                                                timeline: '타임라인',
                                                                chart: '차트',
                                                            }[value],
                                                        );
                                                    }}
                                                >
                                                    <option value="table">표</option>
                                                    <option value="board">보드</option>
                                                    <option value="list">목록</option>
                                                    <option value="gallery">갤러리</option>
                                                    <option value="calendar">달력</option>
                                                    <option value="timeline">타임라인</option>
                                                    <option value="chart">차트</option>
                                                </select>
                                            </label>
                                            <input
                                                aria-label="보기 이름"
                                                required
                                                maxLength={80}
                                                value={viewName}
                                                onChange={(e) => setViewName(e.target.value)}
                                                className={inputClass}
                                                placeholder="예: 담당 문서 · 검토 대기"
                                            />
                                            <button disabled={busy} className={buttonClass}>
                                                보기 저장
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                className={buttonClass}
                                                onClick={() => setSavingView(false)}
                                            >
                                                취소
                                            </button>
                                        </form>
                                    </DatabaseMenu>
                                </>
                            )}
                            <div className="ml-auto flex shrink-0 items-center gap-1">
                                <DatabaseMenu
                                    label="필터"
                                    icon={
                                        <Filter
                                            size={16}
                                            className={
                                                status || owner || advancedFilter.rules.length ? 'text-action' : ''
                                            }
                                        />
                                    }
                                >
                                    <div className="space-y-2">
                                        {database.properties.some((prop) => prop.id === 'status') && (
                                            <>
                                                {' '}
                                                <select
                                                    className={inputClass}
                                                    aria-label="상태 필터"
                                                    value={status}
                                                    onChange={(e) => setStatus(e.target.value)}
                                                >
                                                    <option value="">모든 상태</option>
                                                    {database.properties
                                                        .find((prop) => prop.id === 'status')
                                                        ?.options?.map((option) => (
                                                            <option key={option}>{option}</option>
                                                        ))}
                                                </select>{' '}
                                            </>
                                        )}
                                        {database.properties.some((prop) => prop.id === 'owner') && (
                                            <>
                                                <select
                                                    className={inputClass}
                                                    aria-label="담당자 필터"
                                                    value={owner}
                                                    onChange={(e) => setOwner(e.target.value)}
                                                >
                                                    <option value="">모든 담당자</option>
                                                    {workspace.members.map((member) => (
                                                        <option key={member.userId} value={member.userId}>
                                                            {member.user?.username ?? '팀 멤버'}
                                                        </option>
                                                    ))}
                                                </select>
                                            </>
                                        )}
                                    </div>
                                    <DatabaseQueryBuilder
                                        section="filter"
                                        teamId={teamId}
                                        properties={database.properties}
                                        members={workspace.members}
                                        filter={advancedFilter}
                                        sorts={advancedSorts}
                                        onFilterChange={setAdvancedFilter}
                                        onSortsChange={setAdvancedSorts}
                                    />
                                </DatabaseMenu>
                                <DatabaseMenu
                                    label="정렬"
                                    icon={
                                        <ArrowDownUp
                                            size={16}
                                            className={sort !== 'manual' || advancedSorts.length ? 'text-action' : ''}
                                        />
                                    }
                                >
                                    {sort !== 'manual' && (
                                        <div className="flex items-center justify-between text-xs">
                                            <span>
                                                {sort === 'title'
                                                    ? '이름 오름차순'
                                                    : sort === 'title-desc'
                                                      ? '이름 내림차순'
                                                      : '검토일 순'}
                                            </span>
                                            <button type="button" onClick={() => setSort('manual')}>
                                                정렬 해제
                                            </button>
                                        </div>
                                    )}
                                    <DatabaseQueryBuilder
                                        section="sort"
                                        teamId={teamId}
                                        properties={database.properties}
                                        members={workspace.members}
                                        filter={advancedFilter}
                                        sorts={advancedSorts}
                                        onFilterChange={setAdvancedFilter}
                                        onSortsChange={(value) => {
                                            setSort('manual');
                                            setAdvancedSorts(value);
                                        }}
                                    />
                                </DatabaseMenu>
                                <DatabaseMenu
                                    label="검색"
                                    icon={<Search size={16} className={query ? 'text-action' : ''} />}
                                >
                                    <input
                                        aria-label="데이터베이스 검색"
                                        placeholder="검색어를 입력하세요"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        className={`${inputClass} w-full`}
                                    />
                                </DatabaseMenu>
                                <DatabaseMenu
                                    label="보기 옵션"
                                    icon={<SlidersHorizontal size={16} />}
                                    open={settingsOpen}
                                    onOpenChange={setSettingsOpen}
                                >
                                    <label className="flex items-center justify-between text-xs">
                                        레이아웃
                                        <select
                                            aria-label="레이아웃"
                                            className={inputClass}
                                            value={view}
                                            disabled={busy}
                                            onChange={(e) => {
                                                const layout = e.target.value as DatabaseView['layout'];
                                                void mutate(async () => {
                                                    const prepared = await prepareLayout(layout);
                                                    setGroupProperty(prepared.groupProperty);
                                                    setDateProperty(prepared.dateProperty);
                                                    setView(layout);
                                                }, '보기를 변경했습니다.');
                                            }}
                                        >
                                            <option value="table">표</option>
                                            <option value="board">보드</option>
                                            <option value="list">목록</option>
                                            <option value="gallery">갤러리</option>
                                            <option value="calendar">달력</option>
                                            <option value="timeline">타임라인</option>
                                            <option value="chart">차트</option>
                                        </select>{' '}
                                    </label>
                                    {inline && (
                                        <details
                                            open={viewMenu}
                                            onToggle={(e) => setViewMenu(e.currentTarget.open)}
                                            className="relative text-sm"
                                        >
                                            <summary className="cursor-pointer py-2">보기 설정</summary>
                                            <div className="flex flex-wrap gap-3 rounded-control border border-border-primary p-3">
                                                <label>
                                                    보기 이름{' '}
                                                    <input
                                                        aria-label="현재 보기 이름"
                                                        className={inputClass}
                                                        disabled={!onInlineStateChange}
                                                        value={
                                                            localViews.views.find((item) => item.id === inlineView)
                                                                ?.name ?? ''
                                                        }
                                                        onChange={(e) =>
                                                            setLocalViews((current) => ({
                                                                ...current,
                                                                views: current.views.map((item) =>
                                                                    item.id === inlineView
                                                                        ? { ...item, name: e.target.value.slice(0, 80) }
                                                                        : item,
                                                                ),
                                                            }))
                                                        }
                                                    />
                                                </label>
                                                <button
                                                    className={buttonClass}
                                                    disabled={!onInlineStateChange || localViews.views.length >= 50}
                                                    onClick={() => {
                                                        const active = localViews.views.find(
                                                            (item) => item.id === inlineView,
                                                        )!;
                                                        const id = crypto.randomUUID();
                                                        setLocalViews((current) => ({
                                                            ...current,
                                                            views: [
                                                                ...current.views.map((saved) =>
                                                                    saved.id === inlineView
                                                                        ? {
                                                                              ...saved,
                                                                              layout: view,
                                                                              query,
                                                                              status,
                                                                              owner,
                                                                              sort,
                                                                              dateProperty,
                                                                              endProperty,
                                                                              groupProperty,
                                                                              dataSourceId,
                                                                              hiddenProperties,
                                                                              propertyOrder,
                                                                              columnWidths,
                                                                              calculations,
                                                                              filter: advancedFilter,
                                                                              sorts: advancedSorts,
                                                                          }
                                                                        : saved,
                                                                ),
                                                                {
                                                                    ...active,
                                                                    id,
                                                                    name: `${active.name} 복사본`,
                                                                    layout: view,
                                                                    query,
                                                                    status,
                                                                    owner,
                                                                    sort,
                                                                    dateProperty,
                                                                    endProperty,
                                                                    groupProperty,
                                                                    dataSourceId,
                                                                    hiddenProperties,
                                                                    propertyOrder,
                                                                    columnWidths,
                                                                    calculations,
                                                                    filter: advancedFilter,
                                                                    sorts: advancedSorts,
                                                                },
                                                            ],
                                                        }));
                                                        setInlineView(id);
                                                    }}
                                                >
                                                    보기 복제
                                                </button>
                                                <button
                                                    className={buttonClass}
                                                    disabled={!onInlineStateChange || localViews.views.length <= 1}
                                                    onClick={() => {
                                                        const remaining = localViews.views.filter(
                                                            (item) => item.id !== inlineView,
                                                        );
                                                        const next = remaining[0];
                                                        setLocalViews((current) => ({
                                                            ...current,
                                                            views: remaining,
                                                            activeId: next.id,
                                                        }));
                                                        setInlineView(next.id);
                                                        setView(next.layout);
                                                        setQuery(next.query);
                                                        setStatus(next.status);
                                                        setOwner(next.owner);
                                                        setSort(next.sort);
                                                        setDateProperty(next.dateProperty ?? '');
                                                        setEndProperty(next.endProperty ?? '');
                                                        setGroupProperty(next.groupProperty ?? 'status');
                                                        setDataSourceId(next.dataSourceId ?? '');
                                                        setHiddenProperties(next.hiddenProperties ?? []);
                                                        setPropertyOrder(next.propertyOrder ?? []);
                                                        setColumnWidths(next.columnWidths ?? {});
                                                        setCalculations(next.calculations ?? {});
                                                        setAdvancedFilter(
                                                            next.filter ?? { conjunction: 'and', rules: [] },
                                                        );
                                                        setAdvancedSorts(next.sorts ?? []);
                                                    }}
                                                >
                                                    보기 삭제
                                                </button>
                                            </div>
                                        </details>
                                    )}
                                    {!inline && selectedSavedView && canManageViews && (
                                        <details className="text-xs" data-manages-draft-navigation="true">
                                            <summary className="cursor-pointer rounded-control border border-border-primary px-3 py-2">
                                                보기 설정
                                            </summary>
                                            <div className="flex items-center gap-2 py-2">
                                                <input
                                                    aria-label="저장된 보기 이름"
                                                    value={savedViewName}
                                                    maxLength={80}
                                                    disabled={database.locked}
                                                    onChange={(event) => setSavedViewName(event.target.value)}
                                                    className={inputClass}
                                                />
                                                <span role="status" className="text-text-secondary">
                                                    {savedViewState.saving || savedViewState.dirty
                                                        ? '보기 저장 중…'
                                                        : '보기 저장됨'}
                                                </span>
                                                <button
                                                    type="button"
                                                    className={buttonClass}
                                                    disabled={
                                                        busy ||
                                                        database.locked ||
                                                        database.views.length <= 1 ||
                                                        savedViewState.dirty ||
                                                        savedViewState.saving
                                                    }
                                                    onClick={async () => {
                                                        const ok = await mutate(
                                                            () =>
                                                                databaseApi.removeView(
                                                                    teamId,
                                                                    database.id,
                                                                    selectedSavedView.id,
                                                                    database.revision,
                                                                ),
                                                            '보기를 삭제했습니다.',
                                                        );
                                                        if (ok)
                                                            router.replace(
                                                                `/${teamId}/docs?database=${databaseId ?? database.id}&source=${database.id}${projectSuffix}`,
                                                                { scroll: false },
                                                            );
                                                    }}
                                                >
                                                    보기 삭제
                                                </button>
                                            </div>
                                        </details>
                                    )}
                                    <details className="text-xs" data-manages-draft-navigation="true">
                                        <summary className="cursor-pointer rounded-control border border-border-primary px-3 py-2">
                                            열 설정
                                        </summary>
                                        <div className="my-2 max-h-72 overflow-y-auto rounded-control border border-border-primary bg-bg-primary p-3">
                                            <p className="mb-2 text-text-secondary">
                                                열 경계선을 드래그하거나 방향키로 너비를 조절하세요.
                                            </p>
                                            {allColumns.map((prop, index) => (
                                                <div key={prop.id} className="flex items-center gap-2 py-1">
                                                    <label className="flex flex-1 items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            disabled={prop.id === 'title'}
                                                            checked={!hiddenProperties.includes(prop.id)}
                                                            onChange={(event) =>
                                                                setHiddenProperties((current) =>
                                                                    event.target.checked
                                                                        ? current.filter((id) => id !== prop.id)
                                                                        : [...current, prop.id],
                                                                )
                                                            }
                                                        />
                                                        {prop.name}
                                                    </label>
                                                    <button
                                                        type="button"
                                                        aria-label={`${prop.name} 열 왼쪽으로`}
                                                        disabled={index === 0}
                                                        onClick={() => moveColumn(prop.id, -1)}
                                                        className="px-2 disabled:opacity-30"
                                                    >
                                                        ←
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label={`${prop.name} 열 오른쪽으로`}
                                                        disabled={index === allColumns.length - 1}
                                                        onClick={() => moveColumn(prop.id, 1)}
                                                        className="px-2 disabled:opacity-30"
                                                    >
                                                        →
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                    {container && (
                                        <DatabaseSources
                                            teamId={teamId}
                                            container={container}
                                            sources={databases}
                                            activeId={database.id}
                                            busy={busy}
                                            canWrite={canManageViews}
                                            mutate={mutate}
                                            onSelect={(sourceId) => {
                                                setDataSourceId(sourceId);
                                                setView('table');
                                                setQuery('');
                                                setStatus('');
                                                setOwner('');
                                                setSort('manual');
                                                setAdvancedFilter({ conjunction: 'and', rules: [] });
                                                setAdvancedSorts([]);
                                                setHiddenProperties([]);
                                                setPropertyOrder([]);
                                                setColumnWidths({});
                                                setCalculations({});
                                                setDateProperty('');
                                                setEndProperty('');
                                                setGroupProperty('status');
                                                appliedView.current = null;
                                                if (!inline)
                                                    router.replace(
                                                        `/${teamId}/docs?database=${container.id}&source=${sourceId}${projectSuffix}`,
                                                        {
                                                            scroll: false,
                                                        },
                                                    );
                                            }}
                                        />
                                    )}

                                    {canManageDatabase && !isIssueSource && (
                                        <DatabaseCsvImport
                                            key={database.id}
                                            teamId={teamId}
                                            database={database}
                                            onImported={async () => {
                                                notifyDatabaseUpdated();
                                                await load();
                                            }}
                                        />
                                    )}
                                    {canManageDatabase && (
                                        <details className="text-xs text-text-secondary">
                                            <summary className="cursor-pointer">
                                                데이터베이스 설정{database.locked ? ' · 잠김' : ''}
                                            </summary>
                                            <div className="mt-2 flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    className={buttonClass}
                                                    disabled={busy}
                                                    onClick={() =>
                                                        void mutate(
                                                            () =>
                                                                databaseApi.setLock(
                                                                    teamId,
                                                                    database.id,
                                                                    !database.locked,
                                                                    database.revision,
                                                                ),
                                                            database.locked
                                                                ? '데이터베이스 잠금을 해제했습니다.'
                                                                : '데이터베이스 구조를 잠갔습니다. 페이지와 셀은 계속 편집할 수 있습니다.',
                                                        )
                                                    }
                                                >
                                                    {database.locked ? '데이터베이스 잠금 해제' : '데이터베이스 잠금'}
                                                </button>
                                                {database.locked && <span>구조 잠김 · 페이지와 셀 편집 가능</span>}
                                            </div>
                                        </details>
                                    )}
                                    <details className="text-xs text-text-secondary">
                                        <summary className="cursor-pointer">내보내기</summary>
                                        <button
                                            type="button"
                                            className={buttonClass}
                                            onClick={() => {
                                                const blob = new Blob(
                                                    [
                                                        databaseCsv(
                                                            filtered,
                                                            tableColumns,
                                                            workspace.members,
                                                        ),
                                                    ],
                                                    { type: 'text/csv;charset=utf-8' },
                                                );
                                                const url = URL.createObjectURL(blob);
                                                const anchor = document.createElement('a');
                                                anchor.href = url;
                                                anchor.download = `${database.name.replace(/[\\/:*?"<>|]/g, '-')}.csv`;
                                                anchor.click();
                                                setTimeout(() => URL.revokeObjectURL(url), 1000);
                                            }}
                                        >
                                            현재 보기 CSV 내보내기
                                        </button>
                                    </details>
                                    {canManageDatabase && !isIssueSource && (
                                        <button
                                            type="button"
                                            className={buttonClass}
                                            disabled={busy}
                                            onClick={() =>
                                                void mutate(async () => {
                                                    setDocuments(
                                                        unwrapApiArray(await documentApi.getDocuments(teamId)),
                                                    );
                                                    setSettingsOpen(false);
                                                }, '')
                                            }
                                        >
                                            기존 문서 추가
                                        </button>
                                    )}
                                </DatabaseMenu>
                                {canCreateRows && (
                                    <div className="ml-2 flex items-center rounded-control bg-action text-white">
                                        <button
                                            type="button"
                                            disabled={busy}
                                            className="rounded-l-control px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                                            onClick={() => void createPage('제목 없음')}
                                        >
                                            {isIssueSource ? '새 이슈' : '새 페이지'}
                                        </button>
                                        {!isIssueSource && <DatabaseTemplates
                                            teamId={teamId}
                                            database={database}
                                            busy={busy}
                                            mutate={mutate}
                                            onCreated={(id) => {
                                                setRevealedRow(id);
                                                window.dispatchEvent(new CustomEvent('slacord:documents-refresh'));
                                            }}
                                        />}
                                    </div>
                                )}
                            </div>
                        </div>
                        {view === 'table' ? (
                            <div className="overflow-x-auto">
                                <table
                                    style={{
                                        minWidth:
                                            columnWidth('title', 240) +
                                            tableProperties.reduce((sum, prop) => sum + columnWidth(prop.id), 0) +
                                            (canManageDatabase ? 124 : 0),
                                        tableLayout: 'fixed',
                                    }}
                                    className="w-full border-collapse text-left text-sm"
                                >
                                    <thead className="bg-bg-primary text-text-secondary">
                                        <tr>
                                            {tableColumns.map((prop) => prop.id === 'title' ? (
                                            <th
                                                key="title"
                                                {...columnDragProps('title')}
                                                style={{ width: columnWidth('title', 240), boxShadow: dropColumn === 'title' ? 'inset 2px 0 var(--color-text-secondary)' : undefined }}
                                                className="relative bg-bg-primary border-b border-l first:border-l-0 border-border-primary px-3 py-2 font-normal"
                                            >
                                                {titleNameDraft !== null ? (
                                                    <form onSubmit={async (event) => {
                                                        event.preventDefault();
                                                        if (!titleNameDraft.trim() || busy) return;
                                                        const saved = await mutate(() => databaseApi.renameProperty(teamId, database.id, 'title', titleNameDraft.trim(), database.revision), '저장됨');
                                                        if (saved) setTitleNameDraft(null);
                                                    }}>
                                                        <input autoFocus aria-label="제목 속성 이름" maxLength={80}
                                                            className="w-full bg-transparent text-text-primary"
                                                            value={titleNameDraft}
                                                            disabled={busy}
                                                            onChange={(event) => setTitleNameDraft(event.target.value)}
                                                            onBlur={(event) => event.currentTarget.form?.requestSubmit()}
                                                            onKeyDown={(event) => {
                                                                event.stopPropagation();
                                                                if (event.key === 'Escape') { event.preventDefault(); setTitleNameDraft(null); }
                                                            }} />
                                                    </form>
                                                ) : <button type="button" className="w-full text-left"
                                                    aria-label={`${titleColumn.name} 속성 이름 변경`}
                                                    disabled={!canManageDatabase || database.locked || busy}
                                                    onClick={() => setTitleNameDraft(titleColumn.name)}>{titleColumn.name}</button>}
                                                <DatabaseColumnResize
                                                    name={titleColumn.name}
                                                    width={columnWidth('title', 240)}
                                                    onChange={(width) => setWidth('title', width)}
                                                />
                                            </th>
                                            ) : (
                                                <th
                                                    key={prop.id}
                                                    {...columnDragProps(prop.id)}
                                                    style={{ width: columnWidth(prop.id), boxShadow: dropColumn === prop.id ? 'inset 2px 0 var(--color-text-secondary)' : undefined }}
                                                    className="relative border-b border-l border-border-primary px-3 py-2 font-normal"
                                                >
                                                    <DatabaseColumnResize
                                                        name={prop.name}
                                                        width={columnWidth(prop.id)}
                                                        onChange={(width) => setWidth(prop.id, width)}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="flex w-full items-center gap-1.5 text-left hover:text-text-primary"
                                                        aria-label={`${prop.name} 속성 편집`}
                                                        disabled={
                                                            !canManageDatabase || database.locked || !!prop.reverseOf ||
                                                            (isIssueSource && ['status', 'owner', 'priority', 'labels', 'description', 'created_time', 'last_edited_time'].includes(prop.id))
                                                        }
                                                        onClick={(event) => {
                                                            setPropertyAnchor(event.currentTarget.getBoundingClientRect());
                                                            setEditingProperty(prop);
                                                            setError('');
                                                            setPropertyOpen(true);
                                                        }}
                                                    >
                                                        {prop.name}
                                                    </button>
                                                    <span className="sr-only">{PROPERTY_LABELS[prop.type]}</span>
                                                </th>
                                            ))}
                                            {canManageDatabase && (
                                                <th className="w-28 border-b border-l border-border-primary px-3 py-2 font-normal">
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-1 whitespace-nowrap text-xs hover:text-text-primary"
                                                        disabled={busy || database.locked}
                                                        onClick={(event) => {
                                                            setPropertyAnchor(event.currentTarget.getBoundingClientRect());
                                                            setError('');
                                                            setEditingProperty(undefined);
                                                            setPropertyOpen(true);
                                                        }}
                                                    >
                                                        <Plus size={14} />
                                                        속성 추가
                                                    </button>
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((row) => (
                                            <tr
                                                key={row.documentId}
                                                className="group/row border-b border-border-primary last:border-0 hover:bg-bg-hover/30"
                                                onContextMenu={(event) => {
                                                    event.preventDefault();
                                                    if (!isIssueSource) setContextRow(row.documentId);
                                                }}
                                            >
                                                {tableColumns.map((prop) => prop.id === 'title' ? (
                                                <td key="title" className="border-l first:border-l-0 border-border-primary bg-bg-primary px-3 py-1">
                                                    <div className="flex items-center gap-2">
                                                        {!isIssueSource && <div className="order-last shrink-0"><DatabaseRowActions
                                                            teamId={teamId}
                                                            row={row}
                                                            busy={busy}
                                                            open={contextRow === row.documentId}
                                                            onOpenChange={(open) =>
                                                                setContextRow(open ? row.documentId : null)
                                                            }
                                                            onDuplicate={async () => {
                                                                await mutate(async () => {
                                                                    const result = await databaseApi.duplicateRow(
                                                                        teamId,
                                                                        database.id,
                                                                        row.documentId,
                                                                        creationRequestId(
                                                                            duplicateCreation,
                                                                            row.documentId,
                                                                        ),
                                                                    );
                                                                    if (!result.data)
                                                                        throw new Error(
                                                                            '페이지를 복제하지 못했습니다.',
                                                                        );
                                                                    duplicateCreation.current = null;
                                                                    setContextRow(null);
                                                                    setRevealedRow(result.data.documentId);
                                                                    setFocusRow(result.data.documentId);
                                                                    window.dispatchEvent(
                                                                        new CustomEvent('slacord:documents-refresh'),
                                                                    );
                                                                }, '페이지를 복제했습니다.');
                                                            }}
                                                            onArchive={async () => {
                                                                await mutate(async () => {
                                                                    await documentApi.archiveDocument(
                                                                        teamId,
                                                                        row.documentId,
                                                                    );
                                                                    setContextRow(null);
                                                                    window.dispatchEvent(
                                                                        new CustomEvent('slacord:documents-refresh'),
                                                                    );
                                                                }, '휴지통으로 이동했습니다. 사이드바 휴지통에서 복원할 수 있습니다.');
                                                            }}
                                                        /></div>}
                                                        <DatabasePageTitle
                                                            href={databaseRowHref(teamId, row)}
                                                            rowId={row.documentId}
                                                            revision={row.revision}
                                                            disabled={busy}
                                                            title={row.title}
                                                            canEdit={row.canEdit}
                                                            onSave={(title, revision) =>
                                                                mutate(async () => {
                                                                    if (isIssueSource) {
                                                                        await databaseApi.updateRow(teamId, database.id, row.documentId, { title }, revision ?? row.revision);
                                                                        window.dispatchEvent(new CustomEvent('slacord:issues-refresh'));
                                                                        return;
                                                                    }
                                                                    await documentApi.updateDocument(
                                                                        teamId,
                                                                        row.documentId,
                                                                        { title },
                                                                    );
                                                                    window.dispatchEvent(
                                                                        new CustomEvent('slacord:documents-refresh'),
                                                                    );
                                                                }, '저장됨')
                                                            }
                                                        />
                                                    </div>
                                                </td>
                                                ) : (
                                                    <td
                                                        key={prop.id}
                                                        className="border-l border-border-primary p-1 align-top"
                                                    >
                                                        <DatabaseCell
                                                            key={`${row.documentId}:${prop.id}`}
                                                            teamId={teamId}
                                                            databaseId={database.id}
                                                            row={row}
                                                            property={prop}
                                                            members={workspace.members}
                                                            disabled={busy || !row.canEdit}
                                                            readOnly={!row.canEdit}
                                                            canEditOptions={canManageDatabase && !database.locked}
                                                            onOptionsChanged={async () => { notifyDatabaseUpdated(); await load(); }}
                                                            onSave={(value, revision) =>
                                                                saveCell(
                                                                    { ...row, revision: revision ?? row.revision },
                                                                    prop.id,
                                                                    value,
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                ))}
                                                {canManageDatabase && <td className="border-l border-border-primary" />}
                                            </tr>
                                        ))}
                                        {canCreateRows && (
                                            <tr>
                                                <td
                                                    colSpan={tableColumns.length + (canManageDatabase ? 1 : 0)}
                                                    className="border-b border-border-primary"
                                                >
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-tertiary hover:bg-bg-hover"
                                                        onClick={() => void createPage('제목 없음')}
                                                    >
                                                        <Plus size={14} />{isIssueSource ? '새 이슈 추가' : '새 페이지 추가'}
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <DatabaseTableFooter
                                        hasActionColumn={canManageDatabase}
                                        rowLabel={isIssueSource ? '이슈' : '페이지'}
                                        rows={filtered}
                                        properties={tableColumns}
                                        calculations={calculations}
                                        onChange={setCalculations}
                                    />
                                </table>
                            </div>
                        ) : view !== 'board' ? (
                            <DatabaseVisualViews
                                hiddenProperties={hiddenProperties}
                                teamId={teamId}
                                database={database}
                                rows={filtered}
                                layout={view}
                                busy={busy}
                                members={workspace.members}
                                saveCell={saveCell}
                                dateProperty={dateProperty}
                                endProperty={endProperty}
                                onDatePropertyChange={setDateProperty}
                                onEndPropertyChange={setEndProperty}
                            />
                        ) : (
                            <DatabaseBoard
                                hiddenProperties={hiddenProperties}
                                teamId={teamId}
                                database={database}
                                rows={filtered}
                                members={workspace.members}
                                busy={busy}
                                saveCell={saveCell}
                                groupProperty={groupProperty}
                                onGroupPropertyChange={setGroupProperty}
                            />
                        )}
                        {!filtered.length && (
                            <p className="py-6 text-center text-sm text-text-secondary">
                                {isIssueSource ? '표시할 이슈가 없습니다.' : '표시할 문서가 없습니다. 문서를 추가하거나 필터를 변경하세요.'}
                            </p>
                        )}
                        <p className="sr-only">
                            {filtered.length}개 표시
                            {!inline && !isIssueSource &&
                                ' · 입력 후 다른 셀로 이동하면 저장됩니다. 관계와 롤업은 열람 가능한 문서만 표시합니다.'}
                        </p>
                        {canManageDatabase && !!database.archivedProperties?.length && (
                            <details className="rounded-panel border border-border-primary p-3 text-sm">
                                <summary className="cursor-pointer text-text-secondary">
                                    삭제된 속성 ({database.archivedProperties.length})
                                </summary>
                                <p className="my-2 text-xs text-text-tertiary">
                                    복원하면 기존 값과 속성 연결도 다시 사용할 수 있습니다.
                                </p>
                                {database.archivedProperties.map((prop) => (
                                    <div key={prop.id} className="flex items-center justify-between gap-3 py-1">
                                        <span>{prop.name}</span>
                                        <button
                                            type="button"
                                            className={buttonClass}
                                            disabled={busy}
                                            aria-label={`${prop.name} 속성 복원`}
                                            onClick={() =>
                                                void mutate(async () => {
                                                    await databaseApi.archiveProperty(
                                                        teamId,
                                                        database.id,
                                                        prop.id,
                                                        database.revision,
                                                        true,
                                                    );
                                                }, '속성과 기존 값을 복원했습니다.')
                                            }
                                        >
                                            복원
                                        </button>
                                    </div>
                                ))}
                            </details>
                        )}
                        {propertyOpen && (
                            <PropertyEditor
                                anchorRect={propertyAnchor}
                                allowedTypes={isIssueSource ? (Object.keys(PROPERTY_LABELS) as DatabaseProperty['type'][]).filter(type => !['relation', 'rollup', 'unique_id'].includes(type)) : undefined}
                                database={database}
                                editing={editingProperty}
                                onArchive={
                                    editingProperty
                                        ? () =>
                                              void mutate(async () => {
                                                  await databaseApi.archiveProperty(
                                                      teamId,
                                                      database.id,
                                                      editingProperty.id,
                                                      database.revision,
                                                  );
                                                  setPropertyOpen(false);
                                                  setEditingProperty(undefined);
                                              }, '속성을 삭제했습니다. 값은 복원할 수 있습니다.')
                                        : undefined
                                }
                                databases={databases}
                                busy={busy}
                                error={error}
                                onClose={() => {
                                    setPropertyOpen(false);
                                    setEditingProperty(undefined);
                                }}
                                onSave={(property) =>
                                    void mutate(
                                        async () => {
                                            if (editingProperty)
                                                await databaseApi.configureProperty(
                                                    teamId,
                                                    database.id,
                                                    editingProperty.id,
                                                    { ...property, revision: database.revision },
                                                );
                                            else
                                                await databaseApi.addProperty(teamId, database.id, {
                                                    ...property,
                                                    revision: database.revision,
                                                });
                                            setEditingProperty(undefined);
                                            setPropertyOpen(false);
                                        },
                                        editingProperty ? '속성을 변경했습니다.' : '속성을 추가했습니다.',
                                    )
                                }
                            />
                        )}
                        {documents && (
                            <LinkPicker
                                title="기존 문서 추가"
                                description="문서 본문과 권한은 유지하며 이 데이터베이스에서 속성을 관리합니다."
                                options={documents.filter(
                                    (doc) => !database.rows.some((row) => row.documentId === doc.id),
                                )}
                                busy={busy}
                                error={error}
                                onClose={() => setDocuments(null)}
                                onConnect={(id) =>
                                    void mutate(async () => {
                                        await databaseApi.addRow(teamId, database.id, id);
                                        setDocuments(null);
                                    }, '문서를 추가했습니다.')
                                }
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
