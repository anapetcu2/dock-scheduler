import { useForm } from "react-hook-form";

import { type VesselDetail, type VesselUpdateInput, useUpdateVessel } from "../../api/vessels";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";

export function VesselEditForm({ vessel }: { vessel: VesselDetail }) {
  const updateVessel = useUpdateVessel();
  const { register, handleSubmit } = useForm<VesselUpdateInput>({
    defaultValues: {
      name: vessel.name,
      type_prefix: vessel.type_prefix ?? "",
      loa_ft: vessel.loa_ft,
      draft_ft: vessel.draft_ft,
      notes: vessel.notes ?? "",
      is_active: vessel.is_active,
    },
  });

  const onSubmit = handleSubmit((values) => {
    updateVessel.mutate({
      id: vessel.id,
      input: {
        ...values,
        loa_ft: values.loa_ft === undefined || Number.isNaN(values.loa_ft) ? null : Number(values.loa_ft),
        draft_ft:
          values.draft_ft === undefined || Number.isNaN(values.draft_ft) ? null : Number(values.draft_ft),
      },
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
            Name
          </label>
          <input
            id="name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register("name")}
          />
        </div>
        <div>
          <label htmlFor="type_prefix" className="mb-1 block text-sm font-medium text-slate-700">
            Type prefix
          </label>
          <input
            id="type_prefix"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register("type_prefix")}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="loa_ft" className="mb-1 block text-sm font-medium text-slate-700">
            LOA (ft)
          </label>
          <input
            id="loa_ft"
            type="number"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register("loa_ft", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label htmlFor="draft_ft" className="mb-1 block text-sm font-medium text-slate-700">
            Draft (ft)
          </label>
          <input
            id="draft_ft"
            type="number"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register("draft_ft", { valueAsNumber: true })}
          />
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="notes"
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register("notes")}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" {...register("is_active")} />
        Active
      </label>
      {updateVessel.isError && <ErrorState error={updateVessel.error} />}
      {updateVessel.isSuccess && <p className="text-sm text-emerald-700">Saved.</p>}
      <Button type="submit" variant="primary" disabled={updateVessel.isPending}>
        Save
      </Button>
    </form>
  );
}
