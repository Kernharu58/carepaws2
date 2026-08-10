import { View, Text, TextInput, type TextInputProps } from "react-native";
import colors from "../utils/colors";

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export default function FormInput({ label, error, testID, ...rest }: FormInputProps) {
  return (
    <View className="mb-4 gap-1.5">
      <Text className="font-sans-medium text-sm text-ink">{label}</Text>
      <TextInput
        className={`rounded-xl border bg-white px-4 py-3 font-sans text-base text-ink ${error ? "border-status-danger" : "border-border"}`}
        placeholderTextColor={colors.mutedLight}
        testID={testID}
        {...rest}
      />
      {error && <Text className="font-sans text-xs text-status-danger">{error}</Text>}
    </View>
  );
}
