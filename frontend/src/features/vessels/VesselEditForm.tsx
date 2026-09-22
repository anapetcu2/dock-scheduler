import { CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { type VesselDetail, type VesselUpdateInput, useUpdateVessel } from "../../api/vessels";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { cardClass, inputClass, labelClass } from "../../lib/formStyles";

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
    <form onSubmit={onSubmit} className={`${cardClass} space-y-3 p-4`}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="name" className={labelClass}>
            Name
          </label>
          <input id="name" className={`${inputClass} w-full`} {...register("name")} />
        </div>
        <div>
          <label htmlFor="type_prefix" className={labelClass}>
            Type prefix
          </label>
          <input id="type_prefix" className={`${inputClass} w-full`} {...register("type_prefix")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="loa_ft" className={labelClass}>
            LOA (ft)
          </label>
          <input
            id="loa_ft"
            type="number"
            className={`${inputClass} w-full`}
            {...register("loa_ft", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label htmlFor="draft_ft" className={labelClass}>
            Draft (ft)
          </label>
          <input
            id="draft_ft"
            type="number"
            className={`${inputClass} w-full`}
            {...register("draft_ft", { valueAsNumber: true })}
          />
        </div>
      </div>
      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <textarea id="notes" rows={2} className={`${inputClass} w-full`} {...register("notes")} />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-surface-500 bg-surface-800 text-brand-500 focus:ring-brand-500/40"
          {...register("is_active")}
        />
        Active
      </label>
      {updateVessel.isError && <ErrorState error={updateVessel.error} />}
      {updateVessel.isSuccess && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Saved.
        </p>
      )}
      <Button type="submit" variant="primary" disabled={updateVessel.isPending}>
        Save
      </Button>
    </form>
  );
}
