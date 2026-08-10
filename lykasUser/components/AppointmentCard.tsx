import { Pressable, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../utils/colors";
import { formatDateTime } from "../utils/format";
import StatusBadge from "./StatusBadge";

export interface AppointmentSummary {
  _id: string;
  title: string;
  date: string;
  durationHours: number;
  status: string;
}

export default function AppointmentCard({ appointment, onPress }: { appointment: AppointmentSummary; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-white p-4"
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-mintBg">
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-sans-medium text-sm text-ink" numberOfLines={1}>
          {appointment.title}
        </Text>
        <Text className="font-sans text-xs text-muted">
          {formatDateTime(appointment.date)} · {appointment.durationHours}h
        </Text>
      </View>
      <StatusBadge status={appointment.status} />
    </Pressable>
  );
}
