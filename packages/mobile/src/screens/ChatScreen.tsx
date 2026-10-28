import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Channel, Message, Team, User } from "../api/contracts";
import { AppError } from "../api/errors";
import type { Outgoing } from "../chat/model";
import {
  Button,
  Confirm,
  Empty,
  ErrorState,
  formatDate,
  Header,
  Loading,
} from "../ui/components";
import { useActive, useRemote, useServices } from "../ui/hooks";
import { color, ui } from "../ui/theme";
import { channelLabel } from "./WorkspaceScreen";

const connectionCopy = {
  connecting: "대화에 연결 중…",
  syncing: "최신 대화 확인 중…",
  online: "실시간 연결됨",
  offline: "연결이 끊겼어요",
  denied: "대화 권한을 확인해 주세요",
};
type ChatRow =
  | { kind: "message"; message: Message }
  | { kind: "outgoing"; outgoing: Outgoing };

export function ChatScreen({
  team,
  channel,
  user,
  onBack,
}: {
  team: Team;
  channel: Channel;
  user: User;
  onBack: () => void;
}) {
  const services = useServices();
  const model = services.chat(team.id, channel.id, user.id);
  const state = useSyncExternalStore(model.subscribe, model.snapshot);
  const active = useActive();
  const { state: access, reload: reloadAccess } = useRemote(
    useCallback(
      async (signal) => {
        const [channels, members] = await Promise.all([
          services.api.channels(team.id, signal),
          services.api.members(team.id, signal),
        ]);
        const current = channels.find(
          (item) => item.id === channel.id && item.teamId === team.id,
        );
        const member = members.find((item) => item.userId === user.id);
        if (!current || !member) throw new AppError("forbidden");
        return {
          current,
          members,
          writable: member.role !== "guest" && !current.isArchived,
        };
      },
      [services.api, team.id, channel.id, user.id],
    ),
  );
  const writable = access.kind === "ready" && access.data.writable;
  const [draft, setDraft] = useState("");
  const [retryId, setRetryId] = useState<string>();
  useEffect(() => {
    model.setWritable(writable);
    if (active && access.kind === "ready") {
      model.start();
      return () => model.stop();
    }
    if (access.kind === "error") {
      model.clear();
      setDraft("");
    }
  }, [model, active, access.kind, writable]);
  const name =
    access.kind === "ready"
      ? channelLabel(access.data.current, access.data.members, user.id)
      : "대화";
  const rows: ChatRow[] = [
    ...state.messages.map((message): ChatRow => ({ kind: "message", message })),
    ...state.outbox.map((outgoing): ChatRow => ({
      kind: "outgoing",
      outgoing,
    })),
  ].reverse();
  const sending = state.outbox.some((item) => item.delivery === "sending");
  return (
    <KeyboardAvoidingView
      style={ui.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title={name} subtitle={team.name} onBack={onBack} />
      {access.kind === "loading" ? (
        <Loading label="대화 권한 확인 중…" />
      ) : access.kind === "error" ? (
        <ErrorState error={access.error} retry={reloadAccess} />
      ) : (
        <>
          <View style={styles.connection} accessibilityLiveRegion="polite">
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    state.connection === "online"
                      ? color.success
                      : color.warning,
                },
              ]}
            />
            <Text style={[ui.muted, ui.fill]}>
              {connectionCopy[state.connection]}
            </Text>
            <Button
              kind="quiet"
              title={state.connection === "online" ? "새로고침" : "재연결"}
              disabled={state.loading}
              onPress={() =>
                state.connection === "online"
                  ? void model.reload()
                  : reloadAccess()
              }
            />
          </View>
          {state.error && (
            <ErrorState compact error={state.error} retry={reloadAccess} />
          )}
          <FlatList
            inverted
            style={ui.fill}
            data={rows}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingVertical: 16,
              gap: 18,
            }}
            keyExtractor={(item) =>
              item.kind === "message" ? item.message.id : item.outgoing.id
            }
            renderItem={({ item }) =>
              item.kind === "message" ? (
                <MessageRow
                  message={item.message}
                  own={item.message.authorId === user.id}
                />
              ) : (
                <View
                  style={[
                    ui.card,
                    {
                      borderColor:
                        item.outgoing.delivery === "sending"
                          ? color.border
                          : color.warning,
                    },
                  ]}
                >
                  <Text selectable style={ui.body}>
                    {item.outgoing.content}
                  </Text>
                  <Text style={[ui.muted, { color: color.warning }]}>
                    {item.outgoing.delivery === "sending"
                      ? "전송 중…"
                      : item.outgoing.delivery === "uncertain"
                        ? "전송 확인 필요 · 대화에서 먼저 확인해 주세요"
                        : "전송하지 못했어요 · 연결 후 다시 시도해 주세요"}
                  </Text>
                  {item.outgoing.delivery !== "sending" && (
                    <View style={ui.row}>
                      <Button
                        title="재시도"
                        kind="quiet"
                        disabled={
                          sending ||
                          !writable ||
                          state.connection !== "online" ||
                          state.loading
                        }
                        onPress={() =>
                          item.outgoing.delivery === "uncertain"
                            ? setRetryId(item.outgoing.id)
                            : model.retry(item.outgoing.id)
                        }
                      />
                      <Button
                        title="초안 버리기"
                        kind="quiet"
                        onPress={() => model.discard(item.outgoing.id)}
                      />
                    </View>
                  )}
                </View>
              )
            }
            ListEmptyComponent={
              state.loading ? (
                <Loading label="대화 불러오는 중…" />
              ) : (
                <Empty
                  title="대화를 시작해 보세요"
                  body="아직 표시할 메시지가 없어요."
                />
              )
            }
            ListFooterComponent={
              <View style={{ gap: 8 }}>
                {state.hasMore && (
                  <Button
                    title={
                      state.loadingOlder
                        ? "이전 대화 불러오는 중…"
                        : "이전 대화 보기"
                    }
                    kind="quiet"
                    disabled={state.loadingOlder || state.loading}
                    onPress={() => void model.loadOlder()}
                  />
                )}
                {state.loading && rows.length > 0 && (
                  <Loading label="최신 대화 확인 중…" />
                )}
              </View>
            }
          />
          {writable && state.connection !== "denied" ? (
            <View style={styles.composer}>
              <TextInput
                accessibilityLabel="메시지 입력"
                accessibilityHint="최대 8천 자. 전송 버튼을 눌러 보냅니다."
                placeholder={`${name}에 메시지 보내기`}
                placeholderTextColor={color.muted}
                style={[ui.input, styles.messageInput]}
                multiline
                maxLength={8000}
                value={draft}
                onChangeText={setDraft}
                keyboardAppearance="dark"
                textAlignVertical="top"
              />
              <Button
                title="전송"
                disabled={!draft.trim() || sending || state.outbox.length >= 20}
                onPress={() => {
                  if (model.send(draft)) setDraft("");
                }}
              />
            </View>
          ) : (
            <Text style={[ui.muted, { padding: 20 }]}>
              읽기 전용 대화입니다.
            </Text>
          )}
          <Confirm
            visible={!!retryId}
            title="메시지를 다시 보낼까요?"
            body="서버에 이미 저장되었을 수 있습니다. 최신 대화에서 확인한 뒤 다시 보내면 중복 메시지가 생길 수 있습니다."
            confirmLabel="확인 후 다시 전송"
            onCancel={() => setRetryId(undefined)}
            onConfirm={() => {
              const id = retryId;
              setRetryId(undefined);
              if (id)
                void model.reload().then(() => {
                  if (
                    model.snapshot().connection === "online" &&
                    !model.snapshot().error
                  )
                    model.retry(id, true);
                });
            }}
          />
        </>
      )}
    </KeyboardAvoidingView>
  );
}
function MessageRow({ message, own }: { message: Message; own: boolean }) {
  return (
    <View style={[styles.message, own && { borderLeftColor: color.blue }]}>
      <View style={[ui.row, { alignItems: "flex-start", gap: 8 }]}>
        <Text style={[ui.secondary, { fontWeight: "700", flexShrink: 1 }]}>
          {message.authorName || "팀원"}
          {own ? " · 나" : ""}
        </Text>
        <Text style={ui.muted}>{formatDate(message.createdAt)}</Text>
      </View>
      {message.replyToId && <Text style={ui.muted}>↳ 스레드 답글</Text>}
      <Text selectable style={ui.body}>
        {message.content}
      </Text>
      {message.attachments.map((attachment, index) => (
        <Text key={index} style={ui.muted}>
          첨부 · {attachment.name}
        </Text>
      ))}
      {message.isEdited && <Text style={ui.muted}>수정됨</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  connection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 8,
    minHeight: 48,
    backgroundColor: color.surface,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  composer: {
    borderTopWidth: 1,
    borderColor: color.border,
    padding: 12,
    gap: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: color.canvas,
  },
  messageInput: { flex: 1, maxHeight: 160, minHeight: 50 },
  message: {
    gap: 5,
    borderLeftWidth: 2,
    borderLeftColor: color.border,
    paddingLeft: 12,
  },
});
