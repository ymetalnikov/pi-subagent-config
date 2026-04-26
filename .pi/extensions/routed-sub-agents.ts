import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

type Mode =
  | "other"
  | "pre_review"
  | "task"
  | "design"
  | "code"
  | "alt_code"
  | "review"
  | "critical_review"
  | "long_context"
  | "gemini_review"
  | "critical_design"
  | "final_arbitration";

const MODES: Mode[] = [
  "other",
  "pre_review",
  "task",
  "design",
  "code",
  "alt_code",
  "review",
  "critical_review",
  "long_context",
  "gemini_review",
  "critical_design",
  "final_arbitration",
];

const DEFAULT_MODEL_CANDIDATES: Record<Mode, string[]> = {
  other: ["openai-codex/gpt-5.3-codex", "anthropic/claude-sonnet-4-5"],
  pre_review: ["openai-codex/gpt-5.3-codex", "anthropic/claude-sonnet-4-5"],

  task: ["anthropic/claude-opus-4-5", "anthropic/claude-sonnet-4-5"],
  design: ["anthropic/claude-opus-4-5", "anthropic/claude-sonnet-4-5"],

  code: ["anthropic/claude-sonnet-4-5", "anthropic/claude-opus-4-5"],
  alt_code: ["openai-codex/gpt-5.3-codex", "anthropic/claude-sonnet-4-5"],

  review: ["openai-codex/gpt-5.3-codex", "anthropic/claude-sonnet-4-5"],
  critical_review: ["openai-codex/gpt-5.3-codex", "anthropic/claude-sonnet-4-5"],

  long_context: ["google/gemini-3.1-pro-preview", "anthropic/claude-sonnet-4-5"],
  gemini_review: ["google/gemini-3.1-pro-preview", "anthropic/claude-sonnet-4-5"],

  critical_design: ["anthropic/claude-opus-4-5", "anthropic/claude-sonnet-4-5"],
  final_arbitration: ["anthropic/claude-opus-4-5", "anthropic/claude-sonnet-4-5"],
};

const CLAUDE_ONLY_MODEL_CANDIDATES: Record<Mode, string[]> = {
  other: ["anthropic/claude-sonnet-4-5"],
  pre_review: ["anthropic/claude-sonnet-4-5"],

  task: ["anthropic/claude-opus-4-5", "anthropic/claude-sonnet-4-5"],
  design: ["anthropic/claude-opus-4-5", "anthropic/claude-sonnet-4-5"],

  code: ["anthropic/claude-sonnet-4-5"],
  alt_code: ["anthropic/claude-sonnet-4-5"],

  review: ["anthropic/claude-sonnet-4-5"],
  critical_review: ["anthropic/claude-sonnet-4-5"],

  long_context: ["anthropic/claude-sonnet-4-5"],
  gemini_review: ["anthropic/claude-sonnet-4-5"],

  critical_design: ["anthropic/claude-opus-4-5", "anthropic/claude-sonnet-4-5"],
  final_arbitration: ["anthropic/claude-opus-4-5", "anthropic/claude-sonnet-4-5"],
};

const READ_ONLY_TOOLS = "read,grep,find,ls";
const REVIEW_TOOLS = "read,bash,grep,find,ls";
const CODING_TOOLS = "read,bash,edit,write,grep,find,ls";

const DEFAULT_TOOLS: Record<Mode, string> = {
  other: READ_ONLY_TOOLS,
  pre_review: REVIEW_TOOLS,

  task: READ_ONLY_TOOLS,
  design: REVIEW_TOOLS,

  code: CODING_TOOLS,
  alt_code: CODING_TOOLS,

  review: REVIEW_TOOLS,
  critical_review: REVIEW_TOOLS,

  long_context: REVIEW_TOOLS,
  gemini_review: REVIEW_TOOLS,

  critical_design: REVIEW_TOOLS,
  final_arbitration: REVIEW_TOOLS,
};

const SYSTEM_BY_MODE: Record<Mode, string[]> = {
  other: [
    "You are a cheap general-purpose read-only sub-agent running on GPT-5.3 Codex.",
    "Use this for low-risk research, code search, summaries, locating files, draft test ideas, and simple analysis.",
    "Do not modify files.",
    "Return concrete file paths and evidence when possible.",
  ],
  pre_review: [
    "You are a cheap pre-review sub-agent running on GPT-5.3 Codex.",
    "Find obvious bugs, missing tests, risky files, incomplete requirements, and review focus areas.",
    "This is not the final review. Produce a prioritized checklist for the parent agent or stronger reviewer.",
    "Do not modify files.",
  ],

  task: [
    "You are a hard task-formulation sub-agent running on Claude Opus.",
    "Use this only for ambiguous, high-impact, architectural, or expensive-to-get-wrong planning.",
    "Turn the request into precise implementation tasks, acceptance criteria, risks, non-goals, and verification steps.",
    "Do not modify files.",
  ],
  design: [
    "You are a design sub-agent running on Claude Opus.",
    "Analyze architecture, trade-offs, public API shape, migration strategy, data model implications, and risk.",
    "Return a concrete design recommendation plus alternatives and rejected options.",
    "Do not modify files.",
  ],

  code: [
    "You are a primary coding sub-agent running on Claude Sonnet.",
    "Implement the requested code change in the current repository.",
    "Keep changes focused and minimal. Follow existing style. Run relevant checks when practical.",
    "Report changed files, commands run, assumptions, and anything the parent agent must review.",
  ],
  alt_code: [
    "You are an alternative coding sub-agent running on a strong Codex model.",
    "Use this when a second implementation approach is valuable or when the parent agent wants cross-model implementation diversity.",
    "Keep changes focused and minimal. Run relevant checks when practical.",
    "Report changed files, commands run, assumptions, and differences from the primary approach.",
  ],

  review: [
    "You are an independent code-review sub-agent running on GPT-5.3 Codex.",
    "Review the current diff or referenced files for correctness, regressions, missing tests, API contract issues, edge cases, and unnecessary complexity.",
    "Do not modify files. Return prioritized findings with evidence and concrete fix suggestions.",
    "If no serious issue is found, say so explicitly and list residual risks.",
  ],
  critical_review: [
    "You are a critical code-review sub-agent running on a strong Codex model.",
    "Use this for high-risk code review: security/auth/payment, permissions, migrations, data loss, concurrency, infra/deploy, public API breakage, or large diffs.",
    "Do not modify files. Be skeptical. Prioritize correctness and safety over politeness.",
    "Return blocker/high/medium/low findings with evidence, exploit/failure scenario where relevant, and concrete fix guidance.",
  ],

  long_context: [
    "You are a long-context audit sub-agent running on Gemini Pro.",
    "Use Gemini's large context window to inspect broad parts of the repository, long specs, logs, plans, or cross-cutting changes.",
    "Do not modify files. Produce a structured synthesis with file paths, evidence, contradictions, and open questions.",
  ],
  gemini_review: [
    "You are a third-opinion review sub-agent running on Gemini Pro.",
    "Use this when Claude and Codex disagree, when the diff spans many files, or when long-context synthesis may catch cross-cutting issues.",
    "Do not modify files. Focus on requirements mismatch, cross-file consistency, hidden coupling, broad regressions, and missed assumptions.",
  ],

  critical_design: [
    "You are a critical design-review sub-agent running on Claude Opus.",
    "Use this for high-risk architecture, security policy, privacy/data-handling, migration strategy, public API design, or product trade-off review.",
    "Do not modify files. Return design blockers, risks, safer alternatives, and required verification.",
  ],
  final_arbitration: [
    "You are a final arbitration sub-agent running on Claude Opus.",
    "Use this when implementation and review agents disagree or when final judgment requires weighing product, architecture, security, and code evidence.",
    "Do not modify files. Decide which findings matter, which are false positives, and what should be done next.",
  ],
};

function hasNonByteStringChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 255) return true;
  }
  return false;
}

function getModelCandidates(mode: Mode, requestedModel?: string): string[] {
  if (requestedModel?.trim()) return [requestedModel.trim()];
  const profile = (process.env.PI_SUBAGENT_PROFILE ?? "default").trim().toLowerCase();
  const source = profile === "claude-only" ? CLAUDE_ONLY_MODEL_CANDIDATES : DEFAULT_MODEL_CANDIDATES;
  return [...new Set(source[mode])];
}

function looksLikeModelUnavailable(stderr: string, reason: string): boolean {
  const text = `${stderr}\n${reason}`.toLowerCase();
  return (
    text.includes("unknown model") ||
    text.includes("model not found") ||
    text.includes("unsupported model") ||
    text.includes("no model")
  );
}

type UsageTotals = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
  turns: number;
};

const LIVE_STATUS_ID = "sub-agent-live";
const TOTAL_STATUS_ID = "sub-agent-total";
const GREEN_MAX = 100_000;
const YELLOW_MAX = 200_000;

let cumulativeSubAgentCost = 0;
let cumulativeSubAgentCalls = 0;

function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function tokenIcon(tokens: number): string {
  if (tokens < GREEN_MAX) return "🟢";
  if (tokens < YELLOW_MAX) return "🟡";
  return "🔴";
}

function extractTextFromContent(content: any): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      if (part.type === "text" && typeof part.text === "string") return part.text;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function usageSnapshot(usage: UsageTotals) {
  return {
    input: usage.input,
    output: usage.output,
    cacheRead: usage.cacheRead,
    cacheWrite: usage.cacheWrite,
    totalTokens: usage.totalTokens,
    cost: {
      total: usage.cost,
    },
    turns: usage.turns,
  };
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "sub_agent",
    label: "Sub Agent",
    description:
      "Delegate work to routed sub-agents: Codex for cheap research/pre-review and review/alt coding, Opus for hard task/design/arbitration, Sonnet for primary coding, Gemini for long-context and third-opinion review.",
    promptSnippet:
      "Delegate to role-specific sub-agents: other/pre_review, task/design, code/alt_code, review/critical_review, long_context/gemini_review, critical_design/final_arbitration.",
    promptGuidelines: [
      "Use sub_agent mode='other' for low-risk research, code search, summaries, locating files, drafting test ideas, and simple analysis.",
      "Use sub_agent mode='pre_review' for a cheap first review pass before stronger review.",
      "Use sub_agent mode='task' or mode='design' only for complex, ambiguous, high-impact planning; do not spend Opus on simple planning.",
      "Use sub_agent mode='code' for primary implementation after the task is clear; this uses Sonnet with file mutation tools, and the parent agent must review the resulting diff.",
      "Use sub_agent mode='alt_code' only when an independent alternative implementation is valuable; this uses Codex with file mutation tools.",
      "Use sub_agent mode='review' for normal independent final code review; this uses Codex and must not modify files.",
      "Use sub_agent mode='critical_review' for high-risk code review: security/auth/payment, migrations, data loss, permissions, concurrency, infra, public API breakage, or large diffs.",
      "Use sub_agent mode='long_context' when the task needs broad repository/spec/log synthesis beyond normal reviewer context.",
      "Use sub_agent mode='gemini_review' as a third-opinion reviewer when Claude and Codex disagree or broad cross-file consistency matters.",
      "Use sub_agent mode='critical_design' or mode='final_arbitration' only for high-risk design judgment or resolving conflicts between agents.",
      "Do not delegate secrets, credentials, destructive operations, production migrations, or final security/auth/payment decisions to sub_agent without explicit user approval.",
      "Treat sub_agent output as advisory; verify important findings with direct tools before relying on them.",
    ],
    parameters: Type.Object({
      mode: StringEnum(MODES, {
        description:
          "Routing mode: other/pre_review=Codex, task/design=Opus, code=Sonnet, alt_code=Codex, review/critical_review=Codex, long_context/gemini_review=Gemini Pro, critical_design/final_arbitration=Opus.",
      }),
      task: Type.String({
        description:
          "Self-contained task for the sub-agent. Include relevant context, constraints, expected output, and verification requirements.",
      }),
      model: Type.Optional(
        Type.String({
          description: "Optional model override. Normally leave unset to use the routing defaults.",
        }),
      ),
      tools: Type.Optional(
        Type.String({
          description:
            "Optional comma-separated tool allowlist. Normally leave unset to use safe defaults for the selected mode.",
        }),
      ),
      timeoutSeconds: Type.Optional(
        Type.Number({
          description: "Timeout in seconds. Default: 420.",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const tools = params.tools ?? DEFAULT_TOOLS[params.mode];
      const timeoutSeconds = params.timeoutSeconds ?? 420;
      const timeout = Math.max(10, timeoutSeconds) * 1000;

      const delegatedPrompt = [
        ...SYSTEM_BY_MODE[params.mode],
        "",
        "Parent-agent task:",
        params.task,
      ].join("\n");

      const modelCandidates = getModelCandidates(params.mode, params.model);
      const attemptedModels: string[] = [];

      const updateTotalsStatus = () => {
        if (!ctx) return;
        ctx.ui.setStatus(
          TOTAL_STATUS_ID,
          `🤖 subagents: $${cumulativeSubAgentCost.toFixed(4)} · ${cumulativeSubAgentCalls} call${cumulativeSubAgentCalls === 1 ? "" : "s"}`,
        );
      };

      const runWithModel = async (model: string) => {
        const usage: UsageTotals = {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: 0,
          turns: 0,
        };
        const assistantOutputs: string[] = [];
        const stderrChunks: string[] = [];

        const renderProgressText = () => {
          const icon = tokenIcon(usage.totalTokens);
          return (
            `${icon} sub_agent ${params.mode} (${model}) · ctx ${formatTokens(usage.totalTokens)} ` +
            `· ↑${formatTokens(usage.input)} ↓${formatTokens(usage.output)} ` +
            `· $${usage.cost.toFixed(4)} · Σ$${(cumulativeSubAgentCost + usage.cost).toFixed(4)}`
          );
        };

        const emitProgress = () => {
          const line = renderProgressText();
          if (onUpdate) {
            onUpdate({
              content: [{ type: "text", text: line }],
              details: {
                mode: params.mode,
                model,
                tools,
                usage: usageSnapshot(usage),
                cumulativeSubAgentCost: cumulativeSubAgentCost + usage.cost,
                cumulativeSubAgentCalls,
                attemptedModels,
                running: true,
              },
            });
          }
          if (ctx) ctx.ui.setStatus(LIVE_STATUS_ID, line);
        };

        const args: string[] = [
          "--mode",
          "json",
          "-p",
          "--no-session",
          "--no-extensions",
          "--model",
          model,
          "--tools",
          tools,
        ];

        let promptPath: string | null = null;
        if (hasNonByteStringChars(delegatedPrompt)) {
          promptPath = join(tmpdir(), `pi-sub-agent-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
          await writeFile(promptPath, delegatedPrompt, "utf8");
          args.push(`@${promptPath}`, "Read the attached file and execute it as the full parent-agent task.");
        } else {
          args.push(delegatedPrompt);
        }

        let timedOut = false;
        let wasAborted = false;
        let closeReason = "";

        const subProc = spawn("pi", args, {
          cwd: ctx?.cwd,
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
        });

        const parseLine = (line: string) => {
          if (!line.trim()) return;
          let event: any;
          try {
            event = JSON.parse(line);
          } catch {
            return;
          }

          if (event.type === "message_end" && event.message?.role === "assistant") {
            usage.turns += 1;
            const msgUsage = event.message.usage;
            if (msgUsage) {
              usage.input += msgUsage.input || 0;
              usage.output += msgUsage.output || 0;
              usage.cacheRead += msgUsage.cacheRead || 0;
              usage.cacheWrite += msgUsage.cacheWrite || 0;
              usage.totalTokens = msgUsage.totalTokens || usage.totalTokens;
              usage.cost += msgUsage.cost?.total || 0;
            }
            const text = extractTextFromContent(event.message.content);
            if (text) assistantOutputs.push(text);
          }
        };

        let stdoutBuffer = "";
        subProc.stdout.on("data", (chunk) => {
          stdoutBuffer += chunk.toString();
          const lines = stdoutBuffer.split("\n");
          stdoutBuffer = lines.pop() ?? "";
          for (const line of lines) parseLine(line);
        });

        subProc.stderr.on("data", (chunk) => {
          stderrChunks.push(chunk.toString());
        });

        emitProgress();
        const progressTimer = setInterval(emitProgress, 10_000);

        const timeoutTimer = setTimeout(() => {
          timedOut = true;
          closeReason = `Timed out after ${timeoutSeconds}s`;
          subProc.kill("SIGTERM");
          setTimeout(() => {
            if (!subProc.killed) subProc.kill("SIGKILL");
          }, 5000);
        }, timeout);

        const killOnAbort = () => {
          wasAborted = true;
          closeReason = "Aborted by parent signal";
          subProc.kill("SIGTERM");
        };

        if (signal) {
          if (signal.aborted) killOnAbort();
          else signal.addEventListener("abort", killOnAbort, { once: true });
        }

        const code = await new Promise<number>((resolve) => {
          subProc.on("close", (exitCode) => {
            if (stdoutBuffer.trim()) parseLine(stdoutBuffer);
            resolve(exitCode ?? 0);
          });
          subProc.on("error", () => {
            closeReason = closeReason || "Failed to spawn pi process";
            resolve(1);
          });
        });

        clearInterval(progressTimer);
        clearTimeout(timeoutTimer);
        if (signal) signal.removeEventListener("abort", killOnAbort);
        if (promptPath) await unlink(promptPath).catch(() => {});

        const stderr = stderrChunks.join("").trim();
        const finalOutput = assistantOutputs.filter(Boolean).join("\n\n").trim();
        const finalText = [
          finalOutput || "sub_agent completed with empty output.",
          stderr ? `[stderr]\n${stderr}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        return {
          code,
          timedOut,
          wasAborted,
          closeReason,
          stderr,
          finalText,
          usage,
          model,
          renderProgressText,
        };
      };

      let lastRun: Awaited<ReturnType<typeof runWithModel>> | null = null;

      for (const candidate of modelCandidates) {
        attemptedModels.push(candidate);
        const run = await runWithModel(candidate);
        lastRun = run;

        if (run.code === 0) break;
        const canRetry =
          !run.timedOut &&
          !run.wasAborted &&
          looksLikeModelUnavailable(run.stderr, run.closeReason) &&
          attemptedModels.length < modelCandidates.length;

        if (!canRetry) break;
      }

      if (!lastRun) {
        throw new Error("sub_agent failed before starting any model attempt");
      }

      if (lastRun.usage.cost > 0) {
        cumulativeSubAgentCost += lastRun.usage.cost;
      }
      cumulativeSubAgentCalls += 1;

      if (ctx) ctx.ui.setStatus(LIVE_STATUS_ID, "");
      updateTotalsStatus();

      const details = {
        mode: params.mode,
        model: lastRun.model,
        modelCandidates,
        attemptedModels,
        tools,
        exitCode: lastRun.code,
        usage: usageSnapshot(lastRun.usage),
        cumulativeSubAgentCost,
        cumulativeSubAgentCalls,
      };

      if (onUpdate) {
        onUpdate({
          content: [{ type: "text", text: lastRun.renderProgressText() }],
          details: { ...details, running: false },
        });
      }

      if (lastRun.code !== 0) {
        const reason = [
          lastRun.timedOut ? `timeout (${timeoutSeconds}s)` : "",
          lastRun.wasAborted ? "aborted" : "",
          lastRun.closeReason,
        ]
          .filter(Boolean)
          .join(", ");
        throw new Error(
          `sub_agent failed with exit code ${lastRun.code}${reason ? ` (${reason})` : ""}\n` +
            `attempted models: ${attemptedModels.join(" -> ")}\n\n${lastRun.finalText}`,
        );
      }

      return {
        content: [{ type: "text", text: lastRun.finalText }],
        details,
      };
    },
  });

  pi.registerCommand("sub-agent-route", {
    description: "Show configured sub-agent routing",
    handler: async (_args, ctx) => {
      const profile = (process.env.PI_SUBAGENT_PROFILE ?? "default").trim().toLowerCase();
      ctx.ui.notify(
        MODES.map((mode) => {
          const candidates = getModelCandidates(mode);
          return `${mode.padEnd(17)} -> ${candidates.join(" -> ")} (${DEFAULT_TOOLS[mode]})`;
        }).join("\n") + `\nprofile: ${profile}`,
        "info",
      );
    },
  });
}
