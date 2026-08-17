export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  is_test_persona: boolean;
  created_at: string;
};

export type TwinProfile = {
  user_id: string;
  goals: string | null;
  deal_preferences: string | null;
  communication_style: string | null;
  deal_breakers: string | null;
  ai_export_blob: string | null;
  updated_at: string;
};

export type Conversation = {
  id: string;
  participant_a: string;
  participant_b: string;
  status: "active" | "paused" | "closed";
  created_at: string;
  summary: string | null;
  counterpart_summary: string | null;
  excitement_score: number | null;
  excitement_locked: boolean;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  original_draft: string;
  final_text: string;
  edited: boolean;
  sent_at: string;
};

export type EditDelta = {
  id: string;
  message_id: string;
  user_id: string;
  original_draft: string;
  edited_text: string;
  conversation_snapshot: unknown;
  created_at: string;
};

export type AgreementResponse = {
  id: string;
  conversation_id: string;
  user_id: string;
  response: "accepted" | "rejected";
  reason: string | null;
  created_at: string;
};
