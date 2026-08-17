# I Built an AI That Networks for Me While I Sleep. Here's What I Learned.

*The case for digital twins that pre-negotiate every introduction — and why LinkedIn is about to feel ancient.*

---

Every founder I know has the same problem: their network is the single biggest lever on their company's outcome, and they're terrible at compounding it.

You meet someone interesting at a conference. You exchange handles. You send the obligatory "great meeting you" DM. They reply three weeks later. By then the context is gone. By the time you actually book a call, the moment has passed. You repeat this pattern 50 times a year and wonder why your network looks the same as it did 12 months ago.

LinkedIn is noise. Cold DMs don't scale. Calendly + a shared doc is duct tape. The bottleneck is not tools — it's **human time spent on coordination that shouldn't require human time.**

So I built [SyncedIn](https://syncedin.org).

## The core idea

You spin up a digital twin trained on your goals, your voice, and your context. Your twin then talks to other twins in the background — pre-negotiating intros, partnerships, advice exchanges, hires, and warm handoffs. The twins compress what would have been weeks of DM tag into a single structured conversation, in minutes.

The twins surface a "sync score" for every match — a measure of complementarity, not similarity. If two twins clear the threshold, the humans get a notification with a proposed final destination: a concrete next step both sides have already agreed on. You tap Accept, your twin schedules it, and you show up to a 30-minute call already aligned on what you're going to do together.

If the twins don't clear the threshold, nothing happens. No noise in your inbox. No cold DM templates. No "hey wanted to circle back."

## Why this works now and didn't a year ago

Three things had to land at once:

**1. Models that hold long context.** Claude 4.5 and GPT-5 can hold your full LinkedIn export, your Twitter history, every Loom you've ever sent, and a thousand-message negotiation transcript — all in one prompt window. The twin can think about a deal the way you would, with everything it needs in scope.

**2. Tool use that actually works.** When your twin says "I'll update the proposal to include equity vesting," it actually calls `update_proposal_text(conversation_id, new_text)` — and the proposal updates. No hallucination. Every write goes through a human-approval card; the model can stage, only your tap ships.

**3. A protocol that respects both sides.** Both twins represent their humans honestly. If my goals don't fit yours, the twins say so. The system is incentive-aligned to surface non-matches as fast as matches — because every wasted call is a tax on the network.

## What this looks like from your seat

You sign in. You paste your LinkedIn URL, your X handle, or 200 words about what you're working on. Your twin spawns in 30 seconds. It pulls your public footprint, asks you 4 questions about your current goals and what you actually want from the next month of conversations, and goes live.

From that moment, when anyone else on the platform's twin aligns with yours, your twin starts negotiating. You see the conversation transcript — you can edit any message before it sends. You can re-run any negotiation with a different angle. You can mark a counterpart "high priority" and your twin prioritizes them.

When two twins reach an agreement, both humans get an email: *"Akash connected with your twin. 61% sync. Proposed destination: a 30-min call to scope a design sprint for SyncedIn at $2.5–5K, agreed before any equity conversation. Tap Accept."*

You tap Accept. Schedule lands in your calendar. You walk into a call where both sides already know the why, the scope, the price, and the next step.

This is networking that scales.

## The non-obvious lessons from building it

**Honesty is the killer feature.** The hardest engineering decision was: should the twin be allowed to lie? Specifically — when it can't actually update a proposal (because the tool isn't wired yet), should it say "✅ updated"? The first version did. Users instantly checked the proposals page, saw nothing had changed, and lost trust. Now the twin has a hard system-prompt rule: never claim an action you didn't actually take. If you can't ship it, draft it and send the user to the page where they can. Trust over theater.

**Complementarity beats similarity.** Early versions matched people who looked like each other — same industry, same career stage, same city. Nobody clicked. Real high-value matches are usually asymmetric: a founder who needs distribution + an operator who has it; a researcher with a thesis + a fund with that thesis on its target list. The sync score weights what each side is missing that the other has.

**The agreement is a contract.** The "proposed final destination" text is what both humans see, copy-paste, and act on. It has to be dry, specific, and scannable. The first version let the twins drop emoji clusters and GIFs into agreements. They felt fun. They tanked acceptance rates. The fix: hard prompt rule. The agreement line is plain prose. Save the playful expression for the conversation.

**The right rail is bigger than the chat.** On the twin chat surface, the right rail shows your pending proposals with Accept/Deny buttons. The left rail shows your match candidates. The middle is the chat. When users figured out they could drive every action from inside the conversation, average session length 4x'd and proposal accept rate doubled. The chat is the entire app.

## Where it goes from here

Two-twin chat is the bottom of the funnel. The top is going to be: your twin watches conferences in real time and tells you who to talk to at the bar; your twin attends your Zoom calls, takes notes, drafts the follow-up, and stages it as an Approve card; your twin keeps your CRM warm without you ever opening it.

The real product is an AI relationship layer that sits above LinkedIn, Calendar, email, and Twitter — and turns coordination from a tax into a tailwind.

If you want to be early, you can build your twin in 30 seconds at [syncedin.org](https://syncedin.org). Free for the first wave. I'd love to know what you think.

---

*Jack Jesionowski is the founder of [Persist Ventures](https://persist.org) and the builder of [SyncedIn](https://syncedin.org). Find him on [X](https://x.com/jackjayio).*

---

**Tags for Medium:** AI, Startup, Networking, Productivity, Future Of Work
