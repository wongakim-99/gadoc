import { useCallback, useState } from "react";
import { FlatList, Image, RefreshControl, Text, View } from "react-native";
import type { Team, User } from "../api/contracts";
import {
  Button,
  Confirm,
  Empty,
  ErrorState,
  Header,
  Loading,
  RowCard,
} from "../ui/components";
import { useRemote, useServices } from "../ui/hooks";
import { color, ui } from "../ui/theme";

export function TeamsScreen({
  user,
  onSelect,
}: {
  user: User;
  onSelect: (team: Team) => void;
}) {
  const { api, session } = useServices();
  const { state, reload } = useRemote(
    useCallback((signal) => api.teams(signal), [api]),
  );
  const [logout, setLogout] = useState(false);
  return (
    <View style={ui.fill}>
      <Header
        title="워크스페이스"
        subtitle="GADOC / 가독"
        right={
          <Button
            title="로그아웃"
            kind="quiet"
            onPress={() => setLogout(true)}
          />
        }
      />
      <FlatList
        data={state.kind === "ready" ? state.data : []}
        keyExtractor={(team) => team.id}
        contentContainerStyle={ui.content}
        refreshControl={
          <RefreshControl
            refreshing={state.kind === "loading"}
            onRefresh={reload}
            tintColor={color.link}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 16 }}>
            <View style={ui.row}>
              <Image
                source={require("../../assets/brand.png")}
                style={{ width: 44, height: 44 }}
              />
              <Text style={ui.subtitle}>{user.username}님, 반가워요.</Text>
            </View>
            <Text style={ui.secondary}>함께할 워크스페이스를 선택하세요.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <RowCard
            title={item.name}
            detail={item.description || "팀의 대화, 문서, 할 일"}
            badge={`${item.memberCount}명`}
            leading={item.name.slice(0, 1)}
            onPress={() => onSelect(item)}
          />
        )}
        ListEmptyComponent={
          state.kind === "loading" ? (
            <Loading />
          ) : state.kind === "error" ? (
            <ErrorState error={state.error} retry={reload} />
          ) : (
            <Empty
              title="아직 참여한 워크스페이스가 없어요"
              body="관리자에게 초대를 요청한 뒤 웹에서 참여해 주세요. 참여 후 아래로 당겨 새로고침할 수 있어요."
            />
          )
        }
      />
      <Confirm
        visible={logout}
        title="로그아웃할까요?"
        body="이 기기에 보관된 로그인 정보와 메모리의 대화·초안을 지웁니다."
        confirmLabel="로그아웃"
        onCancel={() => setLogout(false)}
        onConfirm={() => {
          setLogout(false);
          void session.logout();
        }}
      />
    </View>
  );
}
