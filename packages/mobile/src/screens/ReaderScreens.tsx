import { useCallback } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import type { Team } from "../api/contracts";
import { priorityLabels, statusLabels } from "../api/contracts";
import { AppError } from "../api/errors";
import { ReadContent } from "../content/ReadContent";
import {
  Button,
  Empty,
  ErrorState,
  formatDate,
  Header,
  Loading,
} from "../ui/components";
import { useRemote, useServices } from "../ui/hooks";
import { color, ui } from "../ui/theme";

export function DocumentScreen({
  team,
  documentId,
  onBack,
  openDocument,
}: {
  team: Team;
  documentId: string;
  onBack: () => void;
  openDocument: (id: string) => void;
}) {
  const { api } = useServices();
  const { state, reload } = useRemote(
    useCallback(
      async (signal) => {
        const [doc, nodes] = await Promise.all([
          api.document(team.id, documentId, signal),
          api.documents(team.id, signal),
        ]);
        if (doc.teamId !== team.id || doc.id !== documentId)
          throw new AppError("forbidden");
        return { doc, nodes: nodes.filter((node) => node.teamId === team.id) };
      },
      [api, team.id, documentId],
    ),
  );
  const data = state.kind === "ready" ? state.data : undefined;
  const parent = data?.nodes.find((node) => node.id === data.doc.parentId);
  const children =
    data?.nodes.filter((node) => node.parentId === documentId) ?? [];
  return (
    <View style={ui.fill}>
      <Header title="문서 읽기" subtitle={team.name} onBack={onBack} />
      <ScrollView
        accessibilityLabel="문서 본문"
        contentContainerStyle={ui.content}
        refreshControl={
          <RefreshControl
            refreshing={state.kind === "loading"}
            onRefresh={reload}
            tintColor={color.link}
          />
        }
      >
        {state.kind === "loading" ? (
          <Loading />
        ) : state.kind === "error" ? (
          <ErrorState error={state.error} retry={reload} />
        ) : (
          <>
            {parent && (
              <Button
                title={`상위 문서 · ${parent.title || "제목 없음"}`}
                kind="quiet"
                onPress={() => openDocument(parent.id)}
              />
            )}
            <Text style={ui.eyebrow}>DOCUMENT / 읽기</Text>
            <Text accessibilityRole="header" selectable style={ui.title}>
              {state.data.doc.title || "제목 없음"}
            </Text>
            <Text style={ui.muted}>
              수정 {formatDate(state.data.doc.updatedAt)} · 모바일 읽기 화면
            </Text>
            <View style={[ui.divider, { marginVertical: 6 }]} />
            <ReadContent
              content={state.data.doc.content}
              format={state.data.doc.contentFormat}
            />
            {children.length > 0 && (
              <View style={{ gap: 8, marginTop: 20 }}>
                <Text accessibilityRole="header" style={ui.subtitle}>
                  하위 문서
                </Text>
                {children.map((node) => (
                  <Button
                    key={node.id}
                    kind="quiet"
                    title={node.title || "제목 없음"}
                    onPress={() => openDocument(node.id)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

export function IssueScreen({
  team,
  issueId,
  onBack,
}: {
  team: Team;
  issueId: string;
  onBack: () => void;
}) {
  const { api } = useServices();
  const { state, reload } = useRemote(
    useCallback(
      async (signal) => {
        const [issues, members] = await Promise.all([
          api.issues(team.id, signal),
          api.members(team.id, signal),
        ]);
        return {
          issue: issues.find(
            (issue) => issue.teamId === team.id && issue.id === issueId,
          ),
          members,
        };
      },
      [api, team.id, issueId],
    ),
  );
  const issue = state.kind === "ready" ? state.data.issue : undefined;
  const assignees =
    state.kind === "ready" && issue
      ? issue.assigneeIds.map(
          (id) =>
            state.data.members.find((member) => member.userId === id)?.user
              ?.username || "팀원",
        )
      : [];
  return (
    <View style={ui.fill}>
      <Header title="이슈 읽기" subtitle={team.name} onBack={onBack} />
      <ScrollView
        contentContainerStyle={ui.content}
        refreshControl={
          <RefreshControl
            refreshing={state.kind === "loading"}
            onRefresh={reload}
            tintColor={color.link}
          />
        }
      >
        {state.kind === "loading" ? (
          <Loading />
        ) : state.kind === "error" ? (
          <ErrorState error={state.error} retry={reload} />
        ) : !issue ? (
          <Empty
            title="이슈를 찾을 수 없어요"
            body="삭제되었거나 현재 워크스페이스에서 볼 수 없는 이슈입니다."
          />
        ) : (
          <>
            <Text style={ui.eyebrow}>ISSUE / 읽기</Text>
            <Text accessibilityRole="header" selectable style={ui.title}>
              {issue.title}
            </Text>
            <View style={ui.card}>
              <Meta label="상태" value={statusLabels[issue.status]} />
              <Meta label="우선순위" value={priorityLabels[issue.priority]} />
              <Meta label="담당자" value={assignees.join(", ") || "미지정"} />
              <Meta label="라벨" value={issue.labels.join(" · ") || "없음"} />
              <Meta label="수정" value={formatDate(issue.updatedAt)} />
            </View>
            <ReadContent content={issue.description ?? ""} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={[ui.row, { alignItems: "flex-start" }]}>
      <Text style={[ui.muted, { width: 65 }]}>{label}</Text>
      <Text selectable style={[ui.secondary, ui.fill]}>
        {value}
      </Text>
    </View>
  );
}
