import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type {
  Channel,
  DocumentNode,
  Issue,
  Member,
  Team,
  User,
} from "../api/contracts";
import { statusLabels } from "../api/contracts";
import { documentTree } from "../content/tree";
import { Empty, ErrorState, Header, Loading, RowCard } from "../ui/components";
import { useRemote, useServices } from "../ui/hooks";
import { color, ui } from "../ui/theme";

export type Tab = "chat" | "documents" | "issues";
export function channelLabel(
  channel: Channel,
  members: Member[],
  userId: string,
) {
  if (channel.type === "dm")
    return (
      members.find(
        (member) =>
          member.userId !== userId &&
          channel.memberIds?.includes(member.userId),
      )?.user?.username || "다이렉트 메시지"
    );
  return channel.name || (channel.type === "group" ? "그룹 대화" : "채널");
}

export function WorkspaceScreen({
  team,
  tab,
  user,
  setTab,
  onBack,
  openChannel,
  openDocument,
  openIssue,
}: {
  team: Team;
  tab: Tab;
  user: User;
  setTab: (tab: Tab) => void;
  onBack: () => void;
  openChannel: (channel: Channel) => void;
  openDocument: (doc: DocumentNode) => void;
  openIssue: (issue: Issue) => void;
}) {
  return (
    <View style={ui.fill}>
      <Header title={team.name} subtitle="WORKSPACE" onBack={onBack} />
      {tab === "chat" ? (
        <ChannelList team={team} user={user} open={openChannel} />
      ) : tab === "documents" ? (
        <DocumentList team={team} open={openDocument} />
      ) : (
        <IssueList team={team} open={openIssue} />
      )}
      <View style={styles.tabs} accessibilityRole="tablist">
        {(
          [
            ["chat", "대화"],
            ["documents", "문서"],
            ["issues", "이슈"],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={[
              styles.tab,
              tab === value && {
                backgroundColor: color.selected,
                borderTopColor: color.link,
              },
            ]}
          >
            <Text
              style={{
                color: tab === value ? color.link : color.secondary,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ChannelList({
  team,
  user,
  open,
}: {
  team: Team;
  user: User;
  open: (channel: Channel) => void;
}) {
  const { api } = useServices();
  const { state, reload } = useRemote(
    useCallback(
      async (signal) => {
        const [channels, members] = await Promise.all([
          api.channels(team.id, signal),
          api.members(team.id, signal),
        ]);
        return {
          channels: channels.filter((channel) => channel.teamId === team.id),
          members,
        };
      },
      [api, team.id],
    ),
  );
  return (
    <FlatList
      data={state.kind === "ready" ? state.data.channels : []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={ui.content}
      refreshControl={
        <RefreshControl
          refreshing={state.kind === "loading"}
          onRefresh={reload}
          tintColor={color.link}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 8, marginBottom: 4 }}>
          <Text accessibilityRole="header" style={ui.subtitle}>
            팀의 대화
          </Text>
          <Text style={ui.muted}>참여할 수 있는 채널과 다이렉트 메시지</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      renderItem={({ item }) => (
        <RowCard
          title={channelLabel(
            item,
            state.kind === "ready" ? state.data.members : [],
            user.id,
          )}
          leading={
            item.type === "private" ? "·" : item.type === "dm" ? "@" : "#"
          }
          detail={
            item.isArchived
              ? "보관된 채널 · 읽기 전용"
              : item.description ||
                (item.type === "private"
                  ? "비공개 채널"
                  : item.type === "voice"
                    ? "음성 채널의 대화"
                    : "대화 이어가기")
          }
          badge={item.unreadCount ? String(item.unreadCount) : undefined}
          onPress={() => open(item)}
        />
      )}
      ListEmptyComponent={
        state.kind === "loading" ? (
          <Loading />
        ) : state.kind === "error" ? (
          <ErrorState error={state.error} retry={reload} />
        ) : (
          <Empty
            title="표시할 채널이 없어요"
            body="참여한 채널이 생기면 이곳에 표시됩니다."
          />
        )
      }
    />
  );
}

function DocumentList({
  team,
  open,
}: {
  team: Team;
  open: (doc: DocumentNode) => void;
}) {
  const { api } = useServices();
  const { state, reload } = useRemote(
    useCallback((signal) => api.documents(team.id, signal), [api, team.id]),
  );
  const [query, setQuery] = useState("");
  const nodes = useMemo(
    () =>
      state.kind === "ready"
        ? documentTree(state.data.filter((doc) => doc.teamId === team.id))
        : [],
    [state, team.id],
  );
  const matches = nodes.filter(({ node }) =>
    node.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <FlatList
      data={matches}
      keyExtractor={({ node }) => node.id}
      contentContainerStyle={ui.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl
          refreshing={state.kind === "loading"}
          onRefresh={reload}
          tintColor={color.link}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 14, marginBottom: 6 }}>
          <Text accessibilityRole="header" style={ui.subtitle}>
            문서함
          </Text>
          <TextInput
            accessibilityLabel="문서 제목 검색"
            placeholder="제목으로 찾기"
            placeholderTextColor={color.muted}
            value={query}
            onChangeText={setQuery}
            style={ui.input}
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => (
        <View style={{ paddingLeft: query ? 0 : item.depth * 12 }}>
          <RowCard
            title={item.node.title || "제목 없음"}
            detail={
              item.node.isDatabasePage
                ? "데이터베이스 문서 · 읽기"
                : "문서 읽기"
            }
            leading="≡"
            onPress={() => open(item.node)}
          />
        </View>
      )}
      ListEmptyComponent={
        state.kind === "loading" ? (
          <Loading />
        ) : state.kind === "error" ? (
          <ErrorState error={state.error} retry={reload} />
        ) : (
          <Empty
            title={query ? "일치하는 문서가 없어요" : "표시할 문서가 없어요"}
            body="열람 권한이 있는 문서만 표시됩니다."
          />
        )
      }
    />
  );
}

function IssueList({
  team,
  open,
}: {
  team: Team;
  open: (issue: Issue) => void;
}) {
  const { api } = useServices();
  const { state, reload } = useRemote(
    useCallback((signal) => api.issues(team.id, signal), [api, team.id]),
  );
  const [filter, setFilter] = useState<Issue["status"] | "all">("all");
  const issues =
    state.kind === "ready"
      ? state.data.filter(
          (item) =>
            item.teamId === team.id &&
            (filter === "all" || item.status === filter),
        )
      : [];
  return (
    <FlatList
      data={issues}
      keyExtractor={(item) => item.id}
      contentContainerStyle={ui.content}
      refreshControl={
        <RefreshControl
          refreshing={state.kind === "loading"}
          onRefresh={reload}
          tintColor={color.link}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 14, marginBottom: 4 }}>
          <Text accessibilityRole="header" style={ui.subtitle}>
            다음에 할 일
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {(["all", "todo", "in_progress", "in_review", "done"] as const).map(
              (status) => (
                <Pressable
                  key={status}
                  accessibilityRole="button"
                  accessibilityState={{ selected: status === filter }}
                  onPress={() => setFilter(status)}
                  style={[
                    styles.filter,
                    {
                      backgroundColor:
                        status === filter ? color.selected : color.surface,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: status === filter ? color.link : color.secondary,
                      fontSize: 14,
                    }}
                  >
                    {status === "all" ? "전체" : statusLabels[status]}
                  </Text>
                </Pressable>
              ),
            )}
          </ScrollView>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      renderItem={({ item }) => (
        <RowCard
          title={item.title}
          detail={
            item.labels.length ? item.labels.join(" · ") : "이슈 상세 읽기"
          }
          badge={statusLabels[item.status]}
          onPress={() => open(item)}
        />
      )}
      ListEmptyComponent={
        state.kind === "loading" ? (
          <Loading />
        ) : state.kind === "error" ? (
          <ErrorState error={state.error} retry={reload} />
        ) : (
          <Empty
            title="표시할 이슈가 없어요"
            body="팀의 할 일이 생기면 이곳에서 확인할 수 있어요."
          />
        )
      }
    />
  );
}
const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.surface,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderTopWidth: 2,
    borderTopColor: "transparent",
  },
  filter: {
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: color.border,
  },
});
