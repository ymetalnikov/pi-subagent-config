/**
 * Context Usage Icon
 *
 * Adds a colored indicator to the footer based on total context tokens used:
 *   < 100k  → 🟢 green   (plenty of room)
 *   < 200k  → 🟡 yellow  (getting full)
 *   ≥ 200k  → 🔴 red     (consider /compact or /clear)
 *
 * Updates on session start, every turn end, and after compaction.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const STATUS_ID = "context-usage-icon";

const GREEN_MAX = 100_000;
const YELLOW_MAX = 200_000;

function formatTokens(n: number): string {
	if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
	if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
	return String(n);
}

function render(ctx: ExtensionContext): void {
	const theme = ctx.ui.theme;
	const usage = ctx.getContextUsage();
	const tokens = usage?.tokens ?? 0;

	let icon: string;
	let color: "success" | "warning" | "error";
	if (tokens < GREEN_MAX) {
		icon = "🟢";
		color = "success";
	} else if (tokens < YELLOW_MAX) {
		icon = "🟡";
		color = "warning";
	} else {
		icon = "🔴";
		color = "error";
	}

	const label = theme.fg(color, ` ctx ${formatTokens(tokens)}`);
	ctx.ui.setStatus(STATUS_ID, icon + label);
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => render(ctx));
	pi.on("turn_end", async (_event, ctx) => render(ctx));
	pi.on("session_compact", async (_event, ctx) => render(ctx));
}
