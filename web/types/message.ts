/**
 * 留言模块类型定义（对应后端 schemas/message.py）。
 */

/** 五类留言 tag（与后端 TAG_CHOICES 一致） */
export type MessageTag =
  | "presale"
  | "rescue"
  | "service"
  | "incident"
  | "feedback";

/** 数据源类型 */
export type MessageDataSource = "real" | "simulation";

/** 提交留言的 payload（对应后端 MessageCreate） */
export interface ContactSubmitPayload {
  tag: MessageTag;
  content: string;
  project_id?: string | null;
  data_source?: MessageDataSource | null;
  contact?: string | null;
  entry_point?: string | null;
}

/** 留言详情（对应后端 MessageResponse） */
export interface MessageData {
  id: string;
  user_id: string;
  project_id?: string | null;
  tag: MessageTag;
  tag_label: string;
  data_source?: MessageDataSource | null;
  data_source_label?: string | null;
  entry_point?: string | null;
  contact?: string | null;
  content: string;
  status: "pending" | "processing" | "done";
  status_label: string;
  created_at: string;
  updated_at: string;
}