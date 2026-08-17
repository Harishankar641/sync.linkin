import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Twin tools — the action surface that makes /twin a real agentic
 * chat instead of a draft-only thinking partner. Two categories:
 *
 * READ tools (run server-side, results fed back into the model loop):
 *   - list_pending_proposals
 *   - list_recent_conversations
 *   - search_platform_users
 *
 * WRITE tools (model "executes" them in the loop, but they DON'T touch
 * the DB. Instead each returns a structured pending_action object that
 * the client renders as an inline ActionCard with an Approve button.
 * The user's tap is what triggers the real DB write via
 * /api/twin/execute-action — so the model can never write to the DB
 * without an explicit human confirmation):
 *   - update_proposal_text
 *   - accept_proposal
 *   - deny_proposal
 *   - send_message_to_conversation
 */

export const TWIN_TOOLS = [
  {
    name: "list_pending_proposals",
    description:
      "List all proposals currently waiting on the user to accept, deny, or counter. Each entry has the conversation_id, counterpart name, the proposed deal text, and the current sync score. Call this when the user asks 'what proposals do I have', 'show me my proposals', or implicitly when they ask you to triage.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "list_recent_conversations",
    description:
      "List the user's 10 most recent active conversations with counterpart name, last message snippet, last activity timestamp. Use when the user asks 'what's happening in my inbox' or wants to pick a conversation to act on.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "search_platform_users",
    description:
      "Search SyncedIn users by description ('AI infra founders', 'investors in fintech', 'designers in SF'). Returns up to 8 matches with name, handle, bio, city. Use when the user asks who to reach out to.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
          description:
            "Natural-language description of who to find. Example: 'consumer founders raising seed'."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "update_proposal_text",
    description:
      "Propose a NEW text for a conversation's final agreement/proposal. Returns a pending_action that the user must approve in the chat — does NOT immediately write to the DB. Call this when the user says 'update my proposal with Jacob to say X' or 'change the Jacob deal to include Y'. Always pull conversation_id from list_pending_proposals or list_recent_conversations first — never invent one. IMPORTANT: if the user wants to ACCEPT their updated version in the same breath ('update the proposal to X and I accept it', 'change it and lock it in'), set also_accept=true and do NOT also call accept_proposal — the single update_proposal_text card will both update the text AND record the user's acceptance, so the user only taps Approve once.",
    input_schema: {
      type: "object" as const,
      properties: {
        conversation_id: {
          type: "string" as const,
          description: "UUID of the conversation whose proposal to update."
        },
        counterpart_name: {
          type: "string" as const,
          description:
            "Name of the counterpart in this conversation (for the action card label)."
        },
        new_text: {
          type: "string" as const,
          description:
            "The proposed new agreement text. Plain prose, contract-style. No markdown images, no emoji clusters."
        },
        also_accept: {
          type: "boolean" as const,
          description:
            "Set true when the user wants to accept this updated proposal immediately. The single card will update the text AND record the user's acceptance. When true, do NOT also stage a separate accept_proposal action."
        }
      },
      required: ["conversation_id", "counterpart_name", "new_text"]
    }
  },
  {
    name: "accept_proposal",
    description:
      "Propose accepting a pending proposal. Returns a pending_action card the user must tap Approve on. Use when the user says 'accept the Jacob deal' or after a triage discussion when they pick one.",
    input_schema: {
      type: "object" as const,
      properties: {
        conversation_id: {
          type: "string" as const,
          description: "UUID of the conversation."
        },
        counterpart_name: {
          type: "string" as const,
          description: "Counterpart's name (for the card label)."
        }
      },
      required: ["conversation_id", "counterpart_name"]
    }
  },
  {
    name: "deny_proposal",
    description:
      "Propose denying a pending proposal with a reason. Returns a pending_action card.",
    input_schema: {
      type: "object" as const,
      properties: {
        conversation_id: {
          type: "string" as const,
          description: "UUID of the conversation."
        },
        counterpart_name: {
          type: "string" as const,
          description: "Counterpart's name."
        },
        reason: {
          type: "string" as const,
          description:
            "Short reason the user is denying. Used by the twins to renegotiate."
        }
      },
      required: ["conversation_id", "counterpart_name", "reason"]
    }
  },
  {
    name: "send_message_to_conversation",
    description:
      "Draft a message and stage it for sending in a specific conversation. Returns a pending_action card with Approve. The user's tap is what actually inserts the message.",
    input_schema: {
      type: "object" as const,
      properties: {
        conversation_id: {
          type: "string" as const,
          description: "UUID of the conversation to send into."
        },
        counterpart_name: {
          type: "string" as const,
          description: "Counterpart's name."
        },
        text: {
          type: "string" as const,
          description: "The message body in the user's voice."
        }
      },
      required: ["conversation_id", "counterpart_name", "text"]
    }
  },
  {
    name: "update_twin_context",
    description:
      "Add new context / a new goal to the user's OWN twin so it permanently informs future conversations. Use whenever the user says 'add to my context', 'remember that I…', 'update my goals to…', 'I'm now looking for…'. Returns a pending_action the user approves; on approve it's appended to their twin profile. The twin CAN do this — never tell the user you can't update their context.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string" as const,
          description:
            "The context or goal to add, in the user's voice. E.g. 'Looking for a technical cofounder for SyncedIn.'"
        }
      },
      required: ["text"]
    }
  },
  {
    name: "list_polls",
    description:
      "List the network polls and their results / consensus, plus whether the user has responded. Use when the user asks 'what were my poll results', 'what did the network say', or wants the consensus on a question. Returns data immediately (no approval needed).",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "create_invite",
    description:
      "Create a personalized invite for someone the user wants to bring onto SyncedIn. Use when the user says 'invite my friend', 'invite this person', or gives a name / LinkedIn / X / Instagram URL / email / phone. Returns a pending_action the user approves; on approve a real invite link (syncedin.org/<slug>) is generated. The twin CAN do this — never tell the user to go copy-paste a message themselves.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string" as const,
          description: "The invitee's name (or best guess from their handle)."
        },
        target: {
          type: "string" as const,
          description:
            "A profile URL (LinkedIn/X/Instagram/Facebook), email, phone, or handle for the invitee. Pass whatever the user gave."
        },
        note: {
          type: "string" as const,
          description:
            "Optional one-line note on why the user wants to connect with them."
        }
      },
      required: ["name", "target"]
    }
  },
  {
    name: "submit_feedback",
    description:
      "Submit the user's product feedback (bug, idea, request, or anything they want the team to know) straight from chat. Use when the user says 'give feedback', 'report a bug', 'I wish it did X', 'tell Jack that…'. Returns a pending_action the user approves; on approve it's logged to the feedback board.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string" as const,
          description: "The feedback text in the user's words."
        }
      },
      required: ["message"]
    }
  },
  {
    name: "start_conversation",
    description:
      "Start a NEW twin-to-twin conversation with another SyncedIn user. Use right after search_platform_users when the user says 'connect me with them', 'start a conversation with <name>', or picks someone to reach out to. Pass the target_user_id from a search_platform_users match (never invent one). Returns a pending_action the user approves; on approve a conversation is created (or the existing one reused) and the twin hands back a link to it. The twin CAN do this — never tell the user to go to another page to connect.",
    input_schema: {
      type: "object" as const,
      properties: {
        target_user_id: {
          type: "string" as const,
          description:
            "UUID of the user to start a conversation with — the user_id from a search_platform_users match."
        },
        counterpart_name: {
          type: "string" as const,
          description: "That person's name (for the action card label)."
        }
      },
      required: ["target_user_id", "counterpart_name"]
    }
  }
];

/** Tools that return real data immediately (no approval needed). */
const READ_TOOLS = new Set([
  "list_pending_proposals",
  "list_recent_conversations",
  "search_platform_users",
  "list_polls"
]);

/** Tools that defer to a user-approval card. */
export const WRITE_TOOLS = new Set([
  "update_proposal_text",
  "accept_proposal",
  "deny_proposal",
  "send_message_to_conversation",
  "update_twin_context",
  "create_invite",
  "submit_feedback",
  "start_conversation"
]);

export type PendingAction = {
  /** Stable id so the client + server can correlate the Approve click. */
  id: string;
  /** Which tool was called — drives both the card type + the execute branch. */
  type:
    | "update_proposal_text"
    | "accept_proposal"
    | "deny_proposal"
    | "send_message_to_conversation"
    | "update_twin_context"
    | "create_invite"
    | "submit_feedback"
    | "start_conversation";
  /** Full input payload the user's Approve POST will replay. */
  payload: Record<string, unknown>;
};

/**
 * Run a tool call. READ tools query the DB and return data the model
 * sees on the next loop turn. WRITE tools generate a pending_action
 * descriptor — they do NOT mutate the DB. The descriptor is collected
 * separately + returned to the client as an inline ActionCard.
 */
export async function runTwinTool(
  service: SupabaseClient,
  userId: string,
  name: string,
  input: Record<string, any>
): Promise<{
  data: unknown;
  pending_action: PendingAction | null;
}> {
  if (name === "list_pending_proposals") {
    try {
      const { data: convs } = await service
        .from("conversations")
        .select(
          "id, participant_a, participant_b, summary, counterpart_summary, created_at"
        )
        .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
        .not("summary", "is", null)
        .order("created_at", { ascending: false })
        .limit(30);
      const convList = (convs ?? []) as any[];
      if (!convList.length) {
        return { data: { proposals: [] }, pending_action: null };
      }
      const convIds = convList.map((c) => c.id);
      const { data: resps } = await service
        .from("agreement_responses")
        .select("conversation_id")
        .eq("user_id", userId)
        .in("conversation_id", convIds);
      const responded = new Set(
        (resps ?? []).map((r: any) => r.conversation_id)
      );
      const pending = convList.filter((c) => !responded.has(c.id));
      const counterpartIds = Array.from(
        new Set(
          pending.map((c) =>
            c.participant_a === userId ? c.participant_b : c.participant_a
          )
        )
      );
      const { data: profs } = await service
        .from("profiles")
        .select("id, display_name, handle")
        .in("id", counterpartIds);
      const byId = new Map<string, any>(
        ((profs ?? []) as any[]).map((p) => [p.id, p])
      );
      const proposals = pending.map((c) => {
        const counterpartId =
          c.participant_a === userId ? c.participant_b : c.participant_a;
        const cp = byId.get(counterpartId) ?? {};
        return {
          conversation_id: c.id,
          counterpart_name:
            (cp.display_name as string) ||
            (cp.handle as string) ||
            "Someone",
          summary: ((c.summary as string) ?? "").slice(0, 600),
          counterpart_summary: (
            (c.counterpart_summary as string) ?? ""
          ).slice(0, 240)
        };
      });
      return { data: { proposals }, pending_action: null };
    } catch (e: any) {
      return {
        data: { proposals: [], error: e?.message ?? "fetch_failed" },
        pending_action: null
      };
    }
  }

  if (name === "list_recent_conversations") {
    try {
      const { data: convs } = await service
        .from("conversations")
        .select(
          "id, participant_a, participant_b, summary, created_at"
        )
        .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(10);
      const convList = (convs ?? []) as any[];
      const otherIds = Array.from(
        new Set(
          convList.map((c) =>
            c.participant_a === userId ? c.participant_b : c.participant_a
          )
        )
      );
      const { data: profs } = await service
        .from("profiles")
        .select("id, display_name, handle")
        .in("id", otherIds);
      const byId = new Map<string, any>(
        ((profs ?? []) as any[]).map((p) => [p.id, p])
      );
      const conversations = convList.map((c) => {
        const otherId =
          c.participant_a === userId ? c.participant_b : c.participant_a;
        const cp = byId.get(otherId) ?? {};
        return {
          conversation_id: c.id,
          counterpart_name:
            (cp.display_name as string) ||
            (cp.handle as string) ||
            "Someone",
          summary: ((c.summary as string) ?? "").slice(0, 300),
          updated_at: c.created_at
        };
      });
      return { data: { conversations }, pending_action: null };
    } catch {
      return { data: { conversations: [] }, pending_action: null };
    }
  }

  if (name === "search_platform_users") {
    const q = String(input.query || "")
      .replace(/[%_,]/g, " ")
      .trim()
      .slice(0, 80);
    try {
      const { data } = await service
        .from("profiles")
        .select("id, display_name, handle, bio, city")
        .neq("is_test_persona", true)
        .or(
          `bio.ilike.%${q}%,display_name.ilike.%${q}%,city.ilike.%${q}%`
        )
        .limit(8);
      return {
        data: {
          query: q,
          matches: ((data ?? []) as any[]).map((r) => ({
            user_id: r.id,
            name: r.display_name || r.handle || "Someone",
            handle: r.handle,
            city: r.city,
            bio: (r.bio as string | null)?.slice(0, 160) ?? null
          }))
        },
        pending_action: null
      };
    } catch {
      return { data: { matches: [] }, pending_action: null };
    }
  }

  if (name === "list_polls") {
    try {
      const { data: polls } = await service
        .from("polls")
        .select("id, question, status, synthesis, synthesis_one_liner, created_at")
        .order("created_at", { ascending: false })
        .limit(15);
      const list = (polls ?? []) as any[];
      const pollIds = list.map((p) => p.id);
      const responded = new Set<string>();
      if (pollIds.length > 0) {
        const { data: resps } = await service
          .from("poll_responses")
          .select("poll_id")
          .eq("twin_user_id", userId)
          .in("poll_id", pollIds);
        for (const r of (resps ?? []) as any[]) responded.add(r.poll_id);
      }
      return {
        data: {
          polls: list.map((p) => ({
            id: p.id,
            question: p.question,
            status: p.status,
            consensus:
              (p.synthesis_one_liner as string) ||
              ((p.synthesis as string) ?? "").slice(0, 400) ||
              "(no synthesis yet — still gathering twin responses)",
            you_responded: responded.has(p.id)
          }))
        },
        pending_action: null
      };
    } catch (e: any) {
      return {
        data: { polls: [], error: e?.message ?? "fetch_failed" },
        pending_action: null
      };
    }
  }

  // WRITE tools — return a pending_action descriptor. NO db mutation here.
  if (WRITE_TOOLS.has(name)) {
    const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const action: PendingAction = {
      id,
      type: name as PendingAction["type"],
      payload: input
    };
    return {
      data: {
        action_required: true,
        action_id: id,
        message:
          "Action staged — the user will see an Approve button in the chat. Do not claim it's done."
      },
      pending_action: action
    };
  }

  return {
    data: { error: `unknown tool: ${name}` },
    pending_action: null
  };
}
