import { FileText, MessageSquare, ListTodo, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

const features = [
    {
        number: '01',
        icon: MessageSquare,
        title: '채널과 허들',
        description: '주제별 채널과 DM에서 이야기하세요. 통화가 필요하면 대화하던 채널에서 허들을 열 수 있습니다.',
        detail: '채널 · DM · 음성 통화',
    },
    {
        number: '02',
        icon: FileText,
        title: '문서와 참조',
        description:
            '채팅 옆에 문서를 열고 결정한 내용을 적어보세요. 근거가 된 메시지를 문서에 연결하면 나중에도 찾아볼 수 있습니다.',
        detail: '문서 트리 · 자동 저장 · 분할 화면',
    },
    {
        number: '03',
        icon: ListTodo,
        title: '이슈와 공지',
        description:
            '할 일에 담당자를 정하고 칸반 보드에서 진행 상태를 바꾸세요. 팀에 알려야 할 내용은 공지로 남깁니다.',
        detail: '이슈 · 칸반 보드 · 공지',
    },
];

export function FeatureGrid() {
    return (
        <>
            <section id="workflow" className="gadoc-flow gadoc-container" aria-labelledby="flow-heading">
                <div className="gadoc-section-intro">
                    <p className="gadoc-eyebrow">함께 일하는 방식</p>
                    <h2 id="flow-heading">
                        대화를 보면서,
                        <br />
                        문서에 정리하세요.
                    </h2>
                    <p>
                        창을 오가지 않아도 필요한 내용을 함께 볼 수 있습니다.
                        <br />
                        메시지, 문서, 할 일을 참조로 연결해보세요.
                    </p>
                </div>
                <div className="gadoc-flow-grid">
                    {features.map(({ number, icon: Icon, title, description, detail }) => (
                        <article key={number} className="gadoc-flow-item">
                            <div className="gadoc-flow-index">
                                <Icon size={23} aria-hidden="true" />
                                <span>{number}</span>
                            </div>
                            <h3>{title}</h3>
                            <p>{description}</p>
                            <span className="gadoc-flow-detail">{detail}</span>
                        </article>
                    ))}
                </div>
            </section>
            <section className="gadoc-story gadoc-container" aria-labelledby="story-heading">
                <div>
                    <p className="gadoc-eyebrow">가독이라는 이름</p>
                    <h2 id="story-heading">“이제 가닥이 잡히네요.”</h2>
                    <p>
                        GaDoc은 ‘일의 가닥을 잡다’에서 출발한 이름입니다.
                        <br />
                        문서를 뜻하는 Doc을 더해, 팀의 대화가 정리되고
                        <br className="gadoc-desktop-break" /> 실행으로 이어지는 공간을 표현했습니다.
                    </p>
                </div>
                <div className="gadoc-story-wordmark" aria-hidden="true">
                    gadoc
                    <small>가독</small>
                </div>
            </section>
            <section className="gadoc-closing gadoc-container" aria-labelledby="closing-heading">
                <p className="gadoc-eyebrow">하나의 대화부터 시작해보세요</p>
                <h2 id="closing-heading">
                    우리 팀의 다음 일,
                    <br />
                    여기서 가닥을 잡아보세요.
                </h2>
                <Link href="/auth/register" className="gadoc-button gadoc-button-primary">
                    GaDoc 시작하기 <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
            </section>
        </>
    );
}
