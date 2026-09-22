import { Plus } from "lucide-react";
import { useState } from "react";

import { type Berth, type BerthUpdateInput, useBerths, useCreateBerth, useUpdateBerth } from "../../api/berths";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { tableHeadClass, tableWrapperClass } from "../../lib/formStyles";
import { useAuth } from "../auth/useAuth";
import { BerthRow } from "./BerthRow";
import { NewBerthRow } from "./NewBerthRow";

export function BerthsPage() {
  const { isAdmin } = useAuth();
  const { data: berths, isPending, isError, error } = useBerths(true);
  const updateBerth = useUpdateBerth();
  const createBerth = useCreateBerth();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  if (isPending) return <LoadingState label="Loading berths…" />;
  if (isError) return <ErrorState error={error} />;

  const handleSave = (id: number, input: BerthUpdateInput) => {
    updateBerth.mutate({ id, input }, { onSuccess: () => setEditingId(null) });
  };

  return (
    <div className="animate-fade-in-up">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Berths</h1>
        {isAdmin && !adding && (
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Add berth
          </Button>
        )}
      </div>

      {berths.length === 0 && !adding ? (
        <EmptyState>No berths yet.</EmptyState>
      ) : (
        <table className={`${tableWrapperClass} border-separate border-spacing-0 text-sm`}>
          <thead>
            <tr className={tableHeadClass}>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Length (ft)</th>
              <th className="px-3 py-2">Max draft (ft)</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Notes</th>
              {isAdmin && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {berths.map((berth: Berth) => (
              <BerthRow
                key={berth.id}
                berth={berth}
                isAdmin={isAdmin}
                isEditing={editingId === berth.id}
                onEdit={() => setEditingId(berth.id)}
                onCancel={() => setEditingId(null)}
                onSave={(input) => handleSave(berth.id, input)}
                saving={updateBerth.isPending}
              />
            ))}
            {adding && (
              <NewBerthRow
                onCancel={() => setAdding(false)}
                onSave={(input) => createBerth.mutate(input, { onSuccess: () => setAdding(false) })}
                saving={createBerth.isPending}
              />
            )}
          </tbody>
        </table>
      )}
      {updateBerth.isError && <div className="mt-3"><ErrorState error={updateBerth.error} /></div>}
      {createBerth.isError && <div className="mt-3"><ErrorState error={createBerth.error} /></div>}
    </div>
  );
}
