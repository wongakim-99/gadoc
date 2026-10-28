import { useMemo, useState } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Confirm } from "../ui/components";
import { color, ui } from "../ui/theme";
import { parseContent, safeLink, type ReadBlock, type Span } from "./parse";

export function ReadContent({
  content,
  format = "plain",
}: {
  content: string;
  format?: "plain" | "html" | "json";
}) {
  const result = useMemo(
    () => parseContent(content, format),
    [content, format],
  );
  const [link, setLink] = useState<string>();
  const [error, setError] = useState(false);
  const spans = (values: Span[], keyPrefix: string) =>
    values.map((span, index) => (
      <Text
        key={`${keyPrefix}-${index}`}
        style={[
          span.bold && styles.bold,
          span.italic && styles.italic,
          span.strike && styles.strike,
          span.code && styles.inlineCode,
          span.href && styles.link,
        ]}
        accessibilityRole={span.href ? "link" : undefined}
        accessibilityHint={
          span.href ? "외부 앱에서 열기 전 주소를 확인합니다." : undefined
        }
        onPress={
          span.href
            ? () => {
                setError(false);
                setLink(span.href);
              }
            : undefined
        }
      >
        {span.text}
      </Text>
    ));
  const render = (block: ReadBlock, index: number) => {
    if (block.kind === "divider")
      return <View key={index} style={[ui.divider, { marginVertical: 8 }]} />;
    if (block.kind === "table")
      return (
        <ScrollView
          key={index}
          horizontal
          accessibilityLabel="표, 좌우로 스크롤"
          style={styles.table}
        >
          <View>
            {block.rows?.map((row, rowIndex) => (
              <View key={rowIndex} style={{ flexDirection: "row" }}>
                {row.map((cell, cellIndex) => (
                  <Text
                    key={cellIndex}
                    selectable
                    style={[
                      ui.body,
                      styles.cell,
                      rowIndex === 0 && {
                        backgroundColor: color.raised,
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {spans(cell, `${index}-${rowIndex}-${cellIndex}`)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    const headingSize = block.level === 1 ? 25 : block.level === 2 ? 21 : 18;
    return (
      <View
        key={index}
        style={[
          block.kind === "quote" && styles.quote,
          block.kind === "code" && styles.code,
          block.kind === "notice" && ui.card,
          block.kind === "list" && {
            paddingLeft: Math.min(block.depth ?? 0, 5) * 12,
          },
        ]}
      >
        <Text
          selectable
          accessibilityRole={block.kind === "heading" ? "header" : undefined}
          style={[
            ui.body,
            block.kind === "heading" && {
              fontSize: headingSize,
              lineHeight: headingSize + 12,
              fontWeight: "700",
            },
            block.kind === "code" && {
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
              fontSize: 14,
            },
            block.kind === "notice" && ui.secondary,
          ]}
        >
          {block.kind === "list" && block.prefix ? `${block.prefix}  ` : ""}
          {spans(block.spans, String(index))}
        </Text>
      </View>
    );
  };
  return (
    <View style={{ gap: 16 }}>
      {!result.blocks.length ? (
        <Text style={ui.muted}>내용이 없습니다.</Text>
      ) : (
        result.blocks.map(render)
      )}
      {result.truncated && (
        <Text style={ui.muted}>
          긴 본문의 일부를 표시했습니다. 전체 내용은 웹에서 확인해 주세요.
        </Text>
      )}
      {error && (
        <Text accessibilityRole="alert" style={ui.error}>
          링크를 열지 못했습니다. 주소를 확인해 주세요.
        </Text>
      )}
      <Confirm
        visible={!!link}
        title="링크 열기"
        body="외부 브라우저 또는 앱에서 다음 주소를 엽니다."
        confirmLabel="주소 열기"
        onCancel={() => setLink(undefined)}
        onConfirm={() => {
          const safe = safeLink(link ?? "");
          setLink(undefined);
          if (safe) void Linking.openURL(safe).catch(() => setError(true));
        }}
      >
        <Text selectable style={ui.secondary}>
          {link}
        </Text>
      </Confirm>
    </View>
  );
}
const styles = StyleSheet.create({
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  strike: { textDecorationLine: "line-through" },
  inlineCode: { backgroundColor: color.raised, fontFamily: "monospace" },
  link: { color: color.link, textDecorationLine: "underline" },
  code: { padding: 16, backgroundColor: "#101318", borderRadius: 8 },
  quote: { paddingLeft: 16, borderLeftWidth: 3, borderLeftColor: color.blue },
  table: { borderWidth: 1, borderColor: color.border, borderRadius: 8 },
  cell: {
    width: 180,
    padding: 12,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.border,
  },
});
