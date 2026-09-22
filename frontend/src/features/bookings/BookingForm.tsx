import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { type Berth } from "../../api/berths";
import {
  type Booking,
  type BookingKind,
  type BookingStatus,
  useCreateBooking,
  useUpdateBooking,
  useValidateBooking,
} from "../../api/bookings";
import { ApiError, type ValidationResult, isValidationResult } from "../../api/client";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { KIND_STYLE } from "../../lib/bookingDisplay";
import { ValidationChecklist } from "./ValidationChecklist";
import { VesselCombobox } from "./VesselCombobox";

interface FormValues {
  kind: BookingKind;
  berth_id: number;
  start_date: string;
  end_date: string;
  status: BookingStatus;
  title: string;
  notes: string;
}

interface BookingFormProps {
  berths: Berth[];
  editing?: Booking;
  defaults: { berth_id: number; start_date: string; end_date: string };
  onSaved: () => void;
  onOpenConflict: (bookingId: number) => void;
}

export function BookingForm({ berths, editing, defaults, onSaved, onOpenConflict }: BookingFormProps) {
  const isEditing = editing !== undefined;
  const { register, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: editing
      ? {
          kind: editing.kind,
          berth_id: editing.berth_id,
          start_date: editing.start_date,
          end_date: editing.end_date,
          status: editing.status,
          title: editing.title ?? "",
          notes: editing.notes ?? "",
        }
      : {
          kind: "vessel",
          berth_id: defaults.berth_id,
          start_date: defaults.start_date,
          end_date: defaults.end_date,
          status: "confirmed",
          title: "",
          notes: "",
        },
  });

  const [vesselId, setVesselId] = useState<number | null>(editing?.vessel_id ?? null);
  const [vesselName, setVesselName] = useState<string | null>(editing?.vessel_name ?? null);
  const values = watch();
  const [validation, setValidation] = useState<ValidationResult | undefined>();
  const validateBooking = useValidateBooking();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();

  const saveError = createBooking.error ?? updateBooking.error;
  const saveErrorResult =
    saveError instanceof ApiError && isValidationResult(saveError.detail) ? saveError.detail : undefined;

  useEffect(() => {
    if (values.kind === "vessel" && vesselId == null) {
      setValidation(undefined);
      return;
    }
    if (!values.start_date || !values.end_date || !values.berth_id) return;

    const timer = setTimeout(() => {
      validateBooking.mutate(
        {
          berth_id: Number(values.berth_id),
          kind: values.kind,
          vessel_id: values.kind === "vessel" ? vesselId : null,
          title: values.kind === "vessel" ? null : values.title || null,
          start_date: values.start_date,
          end_date: values.end_date,
          status: values.status,
          booking_id: editing?.id ?? null,
        },
        { onSuccess: setValidation },
      );
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    values.kind,
    values.berth_id,
    values.start_date,
    values.end_date,
    values.status,
    values.title,
    vesselId,
    editing?.id,
  ]);

  const canSave = validation?.ok === true && (values.kind !== "vessel" || vesselId != null);

  const onSubmit = handleSubmit((form) => {
    const input = {
      berth_id: Number(form.berth_id),
      kind: form.kind,
      vessel_id: form.kind === "vessel" ? vesselId : null,
      title: form.kind === "vessel" ? null : form.title || null,
      start_date: form.start_date,
      end_date: form.end_date,
      status: form.status,
      notes: form.notes || null,
    };
    if (isEditing) {
      updateBooking.mutate({ id: editing.id, input }, { onSuccess: onSaved });
    } else {
      createBooking.mutate(input, { onSuccess: onSaved });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Kind</span>
        <div className="flex gap-1 rounded-md border border-slate-300 p-0.5">
          {(Object.keys(KIND_STYLE) as BookingKind[]).map((k) => (
            <label
              key={k}
              className={`flex-1 cursor-pointer rounded px-2 py-1 text-center text-sm ${
                values.kind === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <input type="radio" value={k} className="sr-only" {...register("kind")} />
              {KIND_STYLE[k].label}
            </label>
          ))}
        </div>
      </div>

      {values.kind === "vessel" ? (
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Vessel</span>
          <VesselCombobox
            vesselId={vesselId}
            vesselName={vesselName}
            onSelect={(id, name) => {
              setVesselId(id);
              setVesselName(name);
            }}
          />
        </div>
      ) : (
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
            Title
          </label>
          <input
            id="title"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register("title")}
          />
        </div>
      )}

      <div>
        <label htmlFor="berth_id" className="mb-1 block text-sm font-medium text-slate-700">
          Berth
        </label>
        <select
          id="berth_id"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register("berth_id", { valueAsNumber: true })}
        >
          {berths.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {b.length_ft != null ? `(${b.length_ft}ft)` : "(length unknown)"}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="start_date" className="mb-1 block text-sm font-medium text-slate-700">
            Start date
          </label>
          <input
            id="start_date"
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register("start_date")}
          />
        </div>
        <div>
          <label htmlFor="end_date" className="mb-1 block text-sm font-medium text-slate-700">
            End date
          </label>
          <input
            id="end_date"
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register("end_date")}
          />
        </div>
      </div>

      <div>
        <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
          Status
        </label>
        <select
          id="status"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register("status")}
        >
          <option value="tentative">Tentative</option>
          <option value="confirmed">Confirmed</option>
        </select>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register("notes")}
        />
      </div>

      <ValidationChecklist
        result={validation}
        isVessel={values.kind === "vessel"}
        checking={validateBooking.isPending}
        onOpenConflict={onOpenConflict}
      />

      {saveErrorResult ? (
        <ValidationChecklist
          result={saveErrorResult}
          isVessel={values.kind === "vessel"}
          checking={false}
          onOpenConflict={onOpenConflict}
        />
      ) : (
        (createBooking.isError || updateBooking.isError) && <ErrorState error={saveError} />
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={!canSave || createBooking.isPending || updateBooking.isPending}
      >
        {isEditing ? "Save changes" : "Create booking"}
      </Button>
    </form>
  );
}
