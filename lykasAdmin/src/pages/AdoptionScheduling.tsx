import { useApplications } from "../hooks/useApplications";
import { PageHeader, Card } from "../components/ui/SharedUI";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/StateDisplays";
import StatusBadge from "../components/ui/StatusBadge";

const STAGES = ["submitted", "document_review", "interview", "home_visit", "risk_assessment", "approved", "adoption_scheduled", "completed"] as const;
const STAGE_LABELS: Record<string, string> = {
  submitted: "Submitted",
  document_review: "Document review",
  interview: "Interview",
  home_visit: "Home visit",
  risk_assessment: "Risk assessment",
  approved: "Approved",
  adoption_scheduled: "Scheduled",
  completed: "Completed",
};

/** A kanban-style pipeline view across the full application lifecycle. */
export default function AdoptionScheduling() {
  const applications = useApplications();

  if (applications.loading) return <LoadingState />;
  if (applications.error) return <ErrorState message={applications.error} onRetry={applications.reload} />;

  const activeApps = applications.rows.filter((a) => a.status === "pending");

  return (
    <div>
      <PageHeader title="Adoption Scheduling" description="Pipeline view of applications currently in progress." />

      {activeApps.length === 0 ? (
        <EmptyState title="No applications currently in progress" />
      ) : (
        <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {STAGES.map((stage) => {
            const appsInStage = activeApps.filter((a) => a.stage === stage);
            return (
              <div key={stage} className="min-w-[180px]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {STAGE_LABELS[stage]} ({appsInStage.length})
                </p>
                <div className="space-y-2">
                  {appsInStage.map((app) => (
                    <Card key={app._id} className="p-3">
                      <p className="text-sm font-medium text-gray-900">{app.applicant?.displayName}</p>
                      <p className="text-xs text-gray-500">{app.pet?.name}</p>
                      <div className="mt-1">
                        <StatusBadge status={app.type} tone="neutral" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
