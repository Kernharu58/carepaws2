// components/FormInput.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../utils/colors";

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  isPassword?: boolean;
}

export default function FormInput({ label, error, testID, isPassword, ...rest }: FormInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View className="mb-4 gap-1.5">
      <Text className="font-sans-medium text-sm text-ink">{label}</Text>
      {isPassword ? (
        <View className={`flex-row items-center rounded-xl border bg-white ${error ? "border-status-danger" : "border-border"}`}>
          <TextInput
            className="flex-1 px-4 py-3 font-sans text-base text-ink"
            placeholderTextColor={colors.mutedLight}
            testID={testID}
            {...rest}
            secureTextEntry={!visible}
          />
          <Pressable
            onPress={() => setVisible((prev) => !prev)}
            className="pl-2 pr-4"
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            testID={testID ? `${testID}-toggle` : undefined}
          >
            <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.mutedLight} />
          </Pressable>
        </View>
      ) : (
        <TextInput
          className={`rounded-xl border bg-white px-4 py-3 font-sans text-base text-ink ${error ? "border-status-danger" : "border-border"}`}
          placeholderTextColor={colors.mutedLight}
          testID={testID}
          {...rest}
        />
      )}
      {error && <Text className="font-sans text-xs text-status-danger">{error}</Text>}
    </View>
  );
}