import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

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
import { inputClass, labelClass } from "../../lib/formStyles";
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
        <span className={labelClass}>Kind</span>
        <div className="flex gap-1 rounded-lg border border-surface-600 bg-surface-800 p-0.5">
          {(Object.keys(KIND_STYLE) as BookingKind[]).map((k) => (
            <label
              key={k}
              className={`transition-default flex-1 cursor-pointer rounded-md px-2 py-1 text-center text-sm ${
                values.kind === k
                  ? "bg-brand-gradient text-white shadow-glow"
                  : "text-slate-400 hover:bg-surface-700 hover:text-white"
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
          <span className={labelClass}>Vessel</span>
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
          <label htmlFor="title" className={labelClass}>
            Title
          </label>
          <input id="title" className={`${inputClass} w-full`} {...register("title")} />
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="berth_id" className="block text-sm font-medium text-slate-300">
            Berth
          </label>
          <Link
            to="/availability"
            state={{
              vesselId: values.kind === "vessel" ? vesselId : null,
              vesselName: values.kind === "vessel" ? vesselName : null,
              start: values.start_date,
              end: values.end_date,
            }}
            className="text-xs text-brand-400 hover:text-brand-300 hover:underline"
          >
            Find a berth that fits
          </Link>
        </div>
        <select id="berth_id" className={`${inputClass} w-full`} {...register("berth_id", { valueAsNumber: true })}>
          {berths.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {b.length_ft != null ? `(${b.length_ft}ft)` : "(length unknown)"}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="start_date" className={labelClass}>
            Start date
          </label>
          <input id="start_date" type="date" className={`${inputClass} w-full`} {...register("start_date")} />
        </div>
        <div>
          <label htmlFor="end_date" className={labelClass}>
            End date
          </label>
          <input id="end_date" type="date" className={`${inputClass} w-full`} {...register("end_date")} />
        </div>
      </div>

      <div>
        <label htmlFor="status" className={labelClass}>
          Status
        </label>
        <select id="status" className={`${inputClass} w-full`} {...register("status")}>
          <option value="tentative">Tentative</option>
          <option value="confirmed">Confirmed</option>
        </select>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <textarea id="notes" rows={3} className={`${inputClass} w-full`} {...register("notes")} />
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
