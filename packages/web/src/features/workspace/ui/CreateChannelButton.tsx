'use client';
import { Plus, X } from 'lucide-react';

interface Props {
    open: boolean;
    onToggle: () => void;
}

/** 채널 섹션 헤더 우측의 "+" 토글 버튼 — 폼 자체는 TeamSidebar 인라인으로 렌더링됨 */
export function CreateChannelButton({ open, onToggle }: Props) {
    return (
        <button
            onClick={onToggle}
            aria-label={open ? '채널 만들기 취소' : '채널 만들기'}
            title={open ? '취소' : '채널 만들기'}
            className={`flex h-8 w-8 items-center justify-center rounded-control hover:bg-bg-hover ${open ? 'text-white' : 'text-text-tertiary hover:text-white'}`}
        >
            {open ? <X size={16} /> : <Plus size={16} />}
        </button>
    );
}
