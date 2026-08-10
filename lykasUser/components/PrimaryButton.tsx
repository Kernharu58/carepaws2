import { Pressable, Text, ActivityIndicator, type PressableProps } from "react-native";
import colors from "../utils/colors";

interface PrimaryButtonProps extends PressableProps {
  label: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "outline";
}

export default function PrimaryButton({ label, loading, variant = "primary", disabled, className = "", ...rest }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  const variantClasses =
    variant === "primary"
      ? "bg-primary"
      : variant === "secondary"
        ? "bg-cardBg"
        : "border border-primary bg-transparent";

  const textColor = variant === "primary" ? "text-white" : variant === "secondary" ? "text-ink" : "text-primary";

  return (
    <Pressable
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-xl px-5 py-3.5 ${variantClasses} ${isDisabled ? "opacity-50" : ""} ${className}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      {...rest}
    >
      {loading && <ActivityIndicator color={variant === "primary" ? colors.white : colors.primary} className="mr-2" />}
      <Text className={`font-sans-bold text-base ${textColor}`}>{label}</Text>
    </Pressable>
  );
}
