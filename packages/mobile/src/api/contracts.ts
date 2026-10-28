import { z } from "zod";

const id = z.string().min(1);
const date = z.string().datetime({ offset: true });
export const userSchema = z.object({
  id,
  email: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
});
export const loginSchema = z.object({
  accessToken: z.string().min(1).max(8192),
  user: userSchema,
});
export const teamSchema = z.object({
  id,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  memberCount: z.number(),
});
export const memberSchema = z.object({
  userId: id,
  role: z.enum(["owner", "admin", "member", "guest"]),
  user: userSchema.nullable(),
});
export const channelSchema = z.object({
  id,
  teamId: id,
  name: z.string(),
  description: z.string().nullish(),
  type: z.enum(["public", "private", "dm", "group", "voice"]),
  memberIds: z.array(id).optional(),
  isArchived: z.boolean().optional(),
  unreadCount: z.number().optional(),
});
export const messageSchema = z.object({
  id,
  teamId: id,
  channelId: id,
  authorId: id,
  authorName: z.string().nullable(),
  content: z.string(),
  replyToId: id.nullable(),
  isEdited: z.boolean(),
  createdAt: date,
  updatedAt: date,
  attachments: z.array(
    z.object({ name: z.string(), mimeType: z.string(), size: z.number() }),
  ),
});
export const documentNodeSchema = z.object({
  id,
  teamId: id,
  title: z.string(),
  parentId: id.nullable(),
  contentFormat: z.enum(["plain", "html", "json"]).optional(),
  updatedAt: date,
  isDatabasePage: z.boolean().optional(),
});
export const documentSchema = documentNodeSchema.extend({
  content: z.string(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});
export const issueSchema = z.object({
  id,
  teamId: id,
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "in_review", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assigneeIds: z.array(id),
  labels: z.array(z.string()),
  updatedAt: date,
});
export type User = z.infer<typeof userSchema>;
export type Team = z.infer<typeof teamSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Channel = z.infer<typeof channelSchema>;
export type Message = z.infer<typeof messageSchema>;
export type DocumentNode = z.infer<typeof documentNodeSchema>;
export type Document = z.infer<typeof documentSchema>;
export type Issue = z.infer<typeof issueSchema>;
export const statusLabels: Record<Issue["status"], string> = {
  todo: "할 일",
  in_progress: "진행 중",
  in_review: "리뷰 중",
  done: "완료",
};
export const priorityLabels: Record<Issue["priority"], string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  urgent: "긴급",
};
