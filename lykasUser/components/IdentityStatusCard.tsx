import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StatusBadge from "./StatusBadge";
import colors, { getStatusColors } from "../utils/colors";
import { describeIdentity, WHY_IDENTITY_IS_REQUIRED, type IdentityOverview } from "../utils/identity";

interface Props {
  overview: IdentityOverview;
  onUpload?: () => void;
  onWithdraw?: () => void;
  busy?: boolean;
  /** Hides the long "why we ask" text (used where space is tight). */
  compact?: boolean;
}

/** Shows the server-reported identity status, why it matters, the staff's reason when there is one, and the next step. */
export default function IdentityStatusCard({ overview, onUpload, onWithdraw, busy, compact }: Props) {
  const copy = describeIdentity(overview);
  const { fg, bg } = getStatusColors(copy.tone);

  return (
    <View testID="identity-card" className="rounded-2xl border border-border bg-white p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View style={{ backgroundColor: bg }} className="h-8 w-8 items-center justify-center rounded-full">
            <Ionicons name="shield-checkmark" size={16} color={fg} />
          </View>
          <Text className="font-display text-base text-ink">Identity verification</Text>
        </View>
        <StatusBadge status={overview.status} />
      </View>

      <Text testID="identity-title" className="mt-3 font-sans-medium text-sm text-ink">
        {copy.title}
      </Text>
      <Text testID="identity-body" className="mt-1 font-sans text-sm text-muted">
        {copy.body}
      </Text>

      {!compact && (
        <Text testID="identity-why" className="mt-3 font-sans text-xs text-muted">
          {WHY_IDENTITY_IS_REQUIRED}
        </Text>
      )}

      {copy.actionLabel && onUpload && (
        <Pressable
          testID="identity-upload-button"
          onPress={onUpload}
          disabled={busy}
          accessibilityRole="button"
          className="mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
          <Text className="font-sans-medium text-sm text-white">{copy.actionLabel}</Text>
        </Pressable>
      )}

      {overview.canWithdraw && onWithdraw && (
        <Pressable testID="identity-withdraw-button" onPress={onWithdraw} disabled={busy} accessibilityRole="button" className="mt-3 items-center py-2">
          <Text style={{ color: colors.status.danger }} className="font-sans text-xs">
            Withdraw this upload
          </Text>
        </Pressable>
      )}
    </View>
  );
}
