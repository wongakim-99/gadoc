export const SETTINGS_SECTIONS = [
    {
        key: 'account',
        group: '개인 설정',
        label: '내 계정',
        description: '로그인한 계정과 워크스페이스 역할을 확인합니다.',
    },
    {
        key: 'appearance',
        group: '개인 설정',
        label: '화면과 테마',
        description: '편안하게 작업할 수 있는 화면을 선택하세요.',
    },
    {
        key: 'notifications',
        group: '개인 설정',
        label: '알림',
        description: '이 워크스페이스와 각 채팅방의 내 알림을 따로 설정합니다.',
    },
    { key: 'access', group: '워크스페이스', label: '초대와 권한', description: '멤버, 역할과 초대 링크를 관리합니다.' },
    {
        key: 'delivery',
        group: '워크스페이스',
        label: '전달과 연동',
        description: 'GitHub, Slack, Discord를 워크스페이스에 연결합니다.',
    },
    { key: 'ai', group: '워크스페이스', label: 'AI 연결', description: 'AI 도구 연결과 접근 권한을 관리합니다.' },
    {
        key: 'imports',
        group: '워크스페이스',
        label: '가져오기와 마이그레이션',
        description: '기존 문서와 대화 기록을 가져옵니다.',
    },
    {
        key: 'operations',
        group: '워크스페이스',
        label: '운영 이력',
        description: '워크스페이스의 변경 기록을 확인합니다.',
    },
] as const;

export function activeSettingsSection(value: string | null) {
    return SETTINGS_SECTIONS.find((section) => section.key === value) ?? SETTINGS_SECTIONS[4];
}
