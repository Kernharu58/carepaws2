import { useResourceList } from "../hooks/useResourceList";
import { PageHeader } from "../components/ui/SharedUI";
import DataTable, { type Column } from "../components/ui/DataTable";
import StatusBadge from "../components/ui/StatusBadge";

interface RiskAssessment {
  _id: string;
  applicant: { displayName: string };
  pet: { name: string };
  totalScore: number;
  riskLevel: "Low" | "Medium" | "High";
  recommendation: string;
  createdAt: string;
}

export default function RiskAssessments() {
  const list = useResourceList<RiskAssessment>("/api/risk-assessments");

  const columns: Column<RiskAssessment>[] = [
    { key: "applicant", header: "Applicant", accessor: (r) => r.applicant?.displayName },
    { key: "pet", header: "Pet", accessor: (r) => r.pet?.name },
    { key: "totalScore", header: "Score", accessor: (r) => `${r.totalScore}/30` },
    {
      key: "riskLevel",
      header: "Risk level",
      accessor: (r) => <StatusBadge status={r.riskLevel} tone={r.riskLevel === "Low" ? "success" : r.riskLevel === "Medium" ? "warning" : "danger"} />,
    },
    { key: "recommendation", header: "Recommendation", accessor: (r) => r.recommendation },
  ];

  return (
    <div>
      <PageHeader
        title="Risk Assessments"
        description="Scores and risk levels are computed server-side from the six weighted dimensions — never editable directly here."
      />
      <DataTable
        columns={columns}
        rows={list.rows}
        rowKey={(r) => r._id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No risk assessments yet"
        searchValue={list.search}
        onSearchChange={list.onSearchChange}
        page={list.pagination.page}
        pages={list.pagination.pages}
        total={list.pagination.total}
        onPageChange={list.setPage}
      />
    </div>
  );
}
