import { ResolvedActionItem } from "../lib/schemas";

export interface RunSummary {
  meeting_title: string;
  total_extracted: number;
  created: number;
  updated: number;
  flagged: number;
  skipped: number;
  summary_text: string;
  slack_sent: boolean;
}

export async function generateAndSendReport(
  meetingTitle: string,
  resolvedItems: ResolvedActionItem[]
): Promise<RunSummary> {
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const createdItems = resolvedItems.filter(item => item.action_taken === "CREATE");
  const updatedItems = resolvedItems.filter(item => item.action_taken === "UPDATE");
  const flaggedItems = resolvedItems.filter(item => item.action_taken === "FLAG_FOR_HUMAN");
  const skippedItems = resolvedItems.filter(item => item.action_taken === "SKIP");

  // Format Slack Summary Text
  const summary_text = `🗂 *MeetingMind Summary — ${meetingTitle || "Q3 Launch Sync"} — ${dateStr}*

✅ *${resolvedItems.length}* action items extracted
➕ *${createdItems.length}* new tasks added to tracker
🔄 *${updatedItems.length}* existing task(s) updated (deadline bumped)
⚠️ *${flaggedItems.length}* conflict(s) flagged for review → <http://localhost:3000/review|Review Panel>
🔁 *${skippedItems.length}* duplicate(s) skipped

*Summary:* Review of deliverables, launch timelines, API integrations, and tracking metrics.`;

  console.info("Reporter Agent compiled summary:");
  console.log(summary_text);

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  let slack_sent = false;

  if (webhookUrl) {
    try {
      console.info("Sending Slack report notification...");
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: summary_text,
        }),
      });

      if (response.ok) {
        console.info("Slack report dispatched successfully.");
        slack_sent = true;
      } else {
        console.error("Slack webhook returned error status:", response.status);
      }
    } catch (error) {
      console.error("Failed to send Slack report webhook:", error);
    }
  } else {
    console.warn("Slack Webhook URL not set. Visual summary will render locally in the dashboard.");
  }

  return {
    meeting_title: meetingTitle,
    total_extracted: resolvedItems.length,
    created: createdItems.length,
    updated: updatedItems.length,
    flagged: flaggedItems.length,
    skipped: skippedItems.length,
    summary_text,
    slack_sent,
  };
}
