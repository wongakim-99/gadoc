'use client';

import { useState, type KeyboardEvent } from 'react';
import {
    ArrowRight,
    ArrowUpRight,
    Check,
    FileText,
    Hash,
    ListTodo,
    MessageSquare,
    PanelLeft,
    PanelRight,
    Link2,
} from 'lucide-react';
import { Brand } from '@/src/shared/ui/Brand';

const steps = [
    {
        name: '대화에서',
        title: '이야기의 맥락을 놓치지 않게',
        note: '채널에서 나눈 이야기를 문서 옆에 두고 이어갑니다.',
    },
    {
        name: '문서로',
        title: '생각이 팀의 방향이 되도록',
        note: '정리한 내용은 자동으로 저장하고, 원래 대화는 참조로 남깁니다.',
    },
    {
        name: '실행까지',
        title: '다음에 할 일이 선명해지도록',
        note: '결정한 일을 이슈로 정리하고, 칸반 보드에서 진행 상황을 확인합니다.',
    },
];

export function WorkspacePreview() {
    const [active, setActive] = useState(0);

    function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        const next =
            event.key === 'ArrowRight'
                ? (index + 1) % steps.length
                : event.key === 'ArrowLeft'
                  ? (index + steps.length - 1) % steps.length
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? steps.length - 1
                      : undefined;
        if (next === undefined) return;
        event.preventDefault();
        setActive(next);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }

    return (
        <div className="gadoc-preview-wrap">
            <div className="gadoc-preview-heading">
                <div role="tablist" aria-label="협업 흐름 미리보기" className="gadoc-preview-tabs">
                    {steps.map((step, index) => (
                        <button
                            key={step.name}
                            id={`flow-tab-${index}`}
                            type="button"
                            role="tab"
                            aria-selected={active === index}
                            aria-controls={`flow-panel-${index}`}
                            tabIndex={active === index ? 0 : -1}
                            onClick={() => setActive(index)}
                            onKeyDown={(event) => navigateTabs(event, index)}
                        >
                            <span>0{index + 1}</span>
                            {step.name}
                            <ArrowRight size={14} aria-hidden="true" />
                        </button>
                    ))}
                </div>
                <span className="gadoc-example-label">제품 흐름 예시</span>
            </div>
            <div
                role="tabpanel"
                id={`flow-panel-${active}`}
                aria-labelledby={`flow-tab-${active}`}
                tabIndex={0}
                className="gadoc-preview-panel"
            >
                <div className="gadoc-preview-topbar">
                    <Brand size={24} />
                    <span>
                        스튜디오 가독 <span className="gadoc-preview-slash">/</span> 웹사이트 리뉴얼
                    </span>
                    <PanelLeft size={15} aria-hidden="true" />
                </div>
                <div className={`gadoc-preview-body gadoc-preview-step-${active}`}>
                    <aside className="gadoc-preview-sidebar" aria-label="예시 워크스페이스">
                        <span className="gadoc-preview-team">우리 팀의 작업 공간</span>
                        <span className={active === 0 ? 'is-active' : ''}>
                            <MessageSquare size={15} />
                            대화
                        </span>
                        <span className={active === 1 ? 'is-active' : ''}>
                            <FileText size={15} />
                            문서
                        </span>
                        <span className={active === 2 ? 'is-active' : ''}>
                            <ListTodo size={15} />할 일
                        </span>
                        <span className="gadoc-preview-sidebar-caption">함께 보는 문서</span>
                        <span>
                            <FileText size={14} />
                            리뉴얼 방향 정리
                        </span>
                    </aside>
                    <div className="gadoc-preview-chat">
                        <div className="gadoc-preview-section-heading">
                            <Hash size={16} />
                            프로젝트-리뉴얼 <span>대화</span>
                        </div>
                        <div className="gadoc-sample-message">
                            <span className="gadoc-avatar">민</span>
                            <div>
                                <strong>
                                    민서 <time>오전 10:24</time>
                                </strong>
                                <p>
                                    이번 첫 화면에는 우리 팀이 하는 일이
                                    <br />
                                    바로 보이면 좋겠어요.
                                </p>
                            </div>
                        </div>
                        <div className="gadoc-sample-message">
                            <span className="gadoc-avatar gadoc-avatar-blue">지</span>
                            <div>
                                <strong>
                                    지우 <time>오전 10:26</time>
                                </strong>
                                <p>
                                    좋아요. 이야기한 방향을 문서로
                                    <br />
                                    정리해두었어요. 같이 볼까요?
                                </p>
                                <span className="gadoc-sample-reference">
                                    <FileText size={14} />
                                    리뉴얼 방향 정리 <ArrowRight size={13} />
                                </span>
                            </div>
                        </div>
                        <div className="gadoc-sample-composer">
                            <span>대화가 시작되는 곳</span>
                            <ArrowUpRight size={16} aria-hidden="true" />
                        </div>
                    </div>
                    <div className="gadoc-preview-document">
                        <div className="gadoc-preview-section-heading">
                            <PanelRight size={16} />
                            {active === 2 ? '이어지는 할 일' : '옆에 열린 문서'}
                            <span>
                                <Check size={12} /> 저장됨
                            </span>
                        </div>
                        {active === 2 ? (
                            <div className="gadoc-sample-board">
                                <h3>리뉴얼, 다음 단계</h3>
                                <div className="gadoc-sample-task">
                                    <span className="gadoc-task-status">진행 중</span>
                                    <strong>첫 화면 구성안 만들기</strong>
                                    <span>지우 · 디자인</span>
                                </div>
                                <div className="gadoc-sample-task">
                                    <span className="gadoc-task-status gadoc-task-todo">할 일</span>
                                    <strong>소개 문구 함께 다듬기</strong>
                                    <span>민서 · 콘텐츠</span>
                                </div>
                                <p>
                                    <Link2 size={13} />
                                    리뉴얼 방향 정리
                                </p>
                            </div>
                        ) : (
                            <div className="gadoc-sample-doc">
                                <span className="gadoc-doc-eyebrow">PROJECT NOTES</span>
                                <h3>리뉴얼 방향 정리</h3>
                                <p>우리 팀의 일을, 한눈에 이해할 수 있도록.</p>
                                <h4>함께 정한 방향</h4>
                                <p className="gadoc-doc-callout">
                                    첫 화면은 단순하게.
                                    <br />
                                    무엇을 하는 팀인지 먼저 이야기합니다.
                                </p>
                                <div className="gadoc-sample-check">
                                    <Check size={14} />
                                    대화에서 나온 의견 모으기
                                </div>
                                <div className="gadoc-sample-check">
                                    <span className="gadoc-checkbox" />첫 화면 구성안 만들기
                                </div>
                                <span className="gadoc-sample-reference">
                                    <Link2 size={13} />
                                    방향을 정한 대화
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="gadoc-preview-caption">
                    <strong>{steps[active].title}</strong>
                    <p>{steps[active].note}</p>
                </div>
            </div>
            <p className="gadoc-preview-disclaimer">
                이해를 돕기 위한 예시 화면입니다. 실제 팀 데이터는 사용하지 않았습니다.
            </p>
        </div>
    );
}
