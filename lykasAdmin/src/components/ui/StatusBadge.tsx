// Driven entirely by the four semantic status tones, never a hardcoded
// per-screen color (§2.2/§7.3) — always pair color with a text label so
// color is never the only signal (§11.8 accessibility requirement).
type Tone = "success" | "warning" | "danger" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-status-successBg text-status-success",
  warning: "bg-status-warningBg text-status-warning",
  danger: "bg-status-dangerBg text-status-danger",
  neutral: "bg-status-neutralBg text-status-neutral",
};

// Maps common domain status strings to a semantic tone. Extend this map
// rather than hardcoding a color per call site.
const STATUS_TONE_MAP: Record<string, Tone> = {
  active: "success",
  available: "success",
  approved: "success",
  completed: "success",
  paid: "success",
  confirmed: "success",
  verified: "success",
  resolved: "success",
  attended: "success",

  pending: "warning",
  "in_review": "warning",
  "in progress": "warning",
  scheduled: "warning",
  flagged: "warning",
  running: "warning",

  suspended: "danger",
  locked: "danger",
  rejected: "danger",
  cancelled: "danger",
  failed: "danger",
  critical: "danger",
  overdue: "danger",

  inactive: "neutral",
  archived: "neutral",
  draft: "neutral",
};

interface StatusBadgeProps {
  status: string;
  tone?: Tone;
}

export default function StatusBadge({ status, tone }: StatusBadgeProps) {
  const resolvedTone = tone ?? STATUS_TONE_MAP[status.toLowerCase()] ?? "neutral";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TONE_CLASSES[resolvedTone]}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
