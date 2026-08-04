import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, User } from "lucide-react";
import { api, getApiErrorMessage } from "../services/api";
import { PageHeader, Card } from "../components/ui/SharedUI";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/StateDisplays";
import { Input } from "../components/ui/FormUI";
import StatusBadge from "../components/ui/StatusBadge";
import { useResourceList } from "../hooks/useResourceList";

interface AdopterUser {
  _id: string;
  displayName: string;
  email: string;
  identityVerificationStatus: string;
}

interface AdopterProfile {
  user: AdopterUser;
  applications: { _id: string; pet: { name: string }; status: string; stage: string; createdAt: string }[];
  riskAssessments: { _id: string; riskLevel: string; totalScore: number; recommendation: string; createdAt: string }[];
}

export default function Adopters() {
  const users = useResourceList<AdopterUser>("/api/auth/users", { role: "user" });
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedUserId = searchParams.get("userId");

  const [profile, setProfile] = useState<AdopterProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedUserId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get(`/api/adopter-profile/${selectedUserId}`)
      .then((res) => {
        if (!cancelled) setProfile(res.data.data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "Failed to load adopter profile"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  return (
    <div>
      <PageHeader title="Adopter Profiles & Risk" description="Review an adopter's application and risk-assessment history." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="p-0">
          <div className="border-b border-gray-100 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <Input value={users.search} onChange={(e) => users.onSearchChange(e.target.value)} placeholder="Search adopters…" className="pl-9" />
            </div>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {users.loading ? (
              <LoadingState />
            ) : (
              users.rows.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => setSearchParams({ userId: u._id })}
                  className={`flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left hover:bg-gray-50 ${
                    selectedUserId === u._id ? "bg-emerald-50" : ""
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <User className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{u.displayName}</p>
                    <p className="truncate text-xs text-gray-500">{u.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <div>
          {!selectedUserId ? (
            <Card>
              <p className="py-12 text-center text-sm text-gray-500">Select an adopter to view their profile.</p>
            </Card>
          ) : loading ? (
            <Card>
              <LoadingState />
            </Card>
          ) : error ? (
            <Card>
              <ErrorState message={error} />
            </Card>
          ) : profile ? (
            <div className="space-y-4">
              <Card>
                <h2 className="mb-1 text-base font-semibold text-gray-900">{profile.user.displayName}</h2>
                <p className="mb-2 text-sm text-gray-500">{profile.user.email}</p>
                <StatusBadge status={profile.user.identityVerificationStatus} />
              </Card>

              <Card>
                <h3 className="mb-3 text-sm font-semibold text-gray-700">Applications</h3>
                {profile.applications.length === 0 ? (
                  <EmptyState title="No applications yet" />
                ) : (
                  <div className="space-y-2">
                    {profile.applications.map((a) => (
                      <div key={a._id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                        <span className="text-sm text-gray-700">{a.pet?.name} — {a.stage.replace(/_/g, " ")}</span>
                        <StatusBadge status={a.status} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h3 className="mb-3 text-sm font-semibold text-gray-700">Risk assessments</h3>
                {profile.riskAssessments.length === 0 ? (
                  <EmptyState title="No risk assessments yet" />
                ) : (
                  <div className="space-y-2">
                    {profile.riskAssessments.map((r) => (
                      <div key={r._id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                        <span className="text-sm text-gray-700">Score: {r.totalScore}/30 — {r.recommendation}</span>
                        <StatusBadge status={r.riskLevel} tone={r.riskLevel === "Low" ? "success" : r.riskLevel === "Medium" ? "warning" : "danger"} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
