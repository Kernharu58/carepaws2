export type UserRole = "user" | "staff" | "admin" | "super_admin";
export type UserStatus = "active" | "suspended" | "locked";

export interface AdminUser {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  profilePicture: string | null;
  identityVerificationStatus: "unverified" | "pending" | "verified" | "rejected";
}
