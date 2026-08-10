import { View, Text } from "react-native";
import { getStatusColors, type StatusTone } from "../utils/colors";

const STATUS_TONE_MAP: Record<string, StatusTone> = {
  active: "success",
  available: "success",
  approved: "success",
  completed: "success",
  paid: "success",
  confirmed: "success",
  verified: "success",

  pending: "warning",
  scheduled: "warning",
  in_review: "warning",

  suspended: "danger",
  locked: "danger",
  rejected: "danger",
  cancelled: "danger",
  failed: "danger",

  inactive: "neutral",
  archived: "neutral",
};

export default function StatusBadge({ status, tone }: { status: string; tone?: StatusTone }) {
  const resolvedTone = tone ?? STATUS_TONE_MAP[status.toLowerCase()] ?? "neutral";
  const { fg, bg } = getStatusColors(resolvedTone);

  return (
    <View style={{ backgroundColor: bg }} className="rounded-full px-2.5 py-1">
      <Text style={{ color: fg }} className="font-sans-medium text-xs capitalize">
        {status.replace(/_/g, " ")}
      </Text>
    </View>
  );
}
