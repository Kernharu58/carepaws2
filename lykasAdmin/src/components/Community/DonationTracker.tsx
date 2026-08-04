interface DonationStat {
  _id: string;
  totalCentavos?: number;
  count: number;
}

/** Small summary strip used atop the Donations page. */
export default function DonationTracker({ stats }: { stats: DonationStat[] }) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s._id} className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">{s._id}</p>
          <p className="text-lg font-semibold text-gray-900">
            {s.totalCentavos !== undefined ? (s.totalCentavos / 100).toLocaleString(undefined, { style: "currency", currency: "PHP" }) : s.count}
          </p>
          <p className="text-xs text-gray-500">{s.count} payments</p>
        </div>
      ))}
    </div>
  );
}
