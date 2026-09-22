import { AlertTriangle, Plus, Search } from "lucide-react";
import { useState } from "react";

import { ApiError } from "../../api/client";
import {
  isVesselConflictDetail,
  useCreateVessel,
  useUpdateVessel,
  useVessel,
  useVessels,
} from "../../api/vessels";
import { Button } from "../../components/Button";
import { inputClass } from "../../lib/formStyles";

interface VesselComboboxProps {
  vesselId: number | null;
  vesselName: string | null;
  onSelect: (vesselId: number, vesselName: string) => void;
}

export function VesselCombobox({ vesselId, vesselName, onSelect }: VesselComboboxProps) {
  const [query, setQuery] = useState(vesselName ?? "");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const { data: vessels } = useVessels({ q: query.length >= 2 ? query : undefined });
  const createVessel = useCreateVessel();
  // Refetched by id whenever a vessel is selected, regardless of where the
  // selection came from (a search result, a freshly-created vessel, or an
  // existing booking being edited) — this is what lets the "no length yet"
  // prompt below stay accurate without threading loa_ft through every
  // caller of onSelect.
  const { data: selectedVessel } = useVessel(vesselId ?? undefined);

  return (
    <div
      className="relative"
      onBlur={(e) => {
        // Only close when focus leaves the whole widget, not when it moves
        // from the search input to something else inside it (a result, the
        // "add new vessel" button, or one of the inline add-vessel fields).
        // relatedTarget is null for e.g. a click that doesn't focus anything.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          className={`${inputClass} w-full pl-8`}
          value={query}
          placeholder={"Search vessels…"}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {vesselId != null && selectedVessel && selectedVessel.loa_ft == null ? (
        <SetVesselLengthPrompt vesselId={vesselId} vesselName={vesselName} />
      ) : (
        vesselId != null && (
          <p className="mt-1 text-xs text-emerald-400">Selected: {vesselName}</p>
        )
      )}

      {open && (
        <div className="animate-fade-in absolute z-10 mt-1 w-full rounded-lg border border-surface-600 bg-surface-800 shadow-panel">
          <ul className="max-h-48 overflow-y-auto py-1">
            {(vessels ?? []).map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="transition-default block w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-brand-600/20"
                  onMouseDown={() => {
                    onSelect(v.id, v.name);
                    setQuery(v.name);
                    setOpen(false);
                  }}
                >
                  {v.type_prefix ? `${v.type_prefix} ${v.name}` : v.name}
                  {v.loa_ft == null && <span className="ml-1 text-amber-400">(length unknown)</span>}
                </button>
              </li>
            ))}
            {(vessels ?? []).length === 0 && (
              <li className="px-3 py-1.5 text-sm text-slate-500">No matches</li>
            )}
          </ul>
          <div className="border-t border-surface-700 p-2">
            {!adding ? (
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300"
                onMouseDown={() => setAdding(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add new vessel{query ? ` "${query}"` : ""}
              </button>
            ) : (
              <AddVesselInline
                initialName={query}
                onCancel={() => setAdding(false)}
                onCreated={(id, name) => {
                  onSelect(id, name);
                  setQuery(name);
                  setAdding(false);
                  setOpen(false);
                }}
              />
            )}
          </div>
        </div>
      )}

      {createVessel.isError &&
        createVessel.error instanceof ApiError &&
        isVesselConflictDetail(createVessel.error.detail) && (
          <p className="mt-1 text-xs text-rose-400">
            A vessel with this name already exists (#{createVessel.error.detail.vessel_id}).
          </p>
        )}
    </div>
  );
}

/** Shown instead of "Selected: X" when the selected vessel has no LOA — a
 * booking can't be saved until it does (VESSEL_LENGTH_UNKNOWN blocks it).
 * This updates the *same* vessel via PATCH, unlike "+ Add new vessel"
 * above, which always creates a new one. */
function SetVesselLengthPrompt({ vesselId, vesselName }: { vesselId: number; vesselName: string | null }) {
  const [loaFt, setLoaFt] = useState("");
  const updateVessel = useUpdateVessel();

  return (
    <div className="animate-fade-in mt-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
      <p className="mb-1.5 flex items-start gap-1.5 text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Selected: {vesselName} {"—"} no recorded length yet, needed before this booking can be
          saved.
        </span>
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          placeholder="LOA (ft)"
          className={`${inputClass} w-24 py-1`}
          value={loaFt}
          onChange={(e) => setLoaFt(e.target.value)}
        />
        <Button
          variant="primary"
          disabled={loaFt === "" || updateVessel.isPending}
          onClick={() => updateVessel.mutate({ id: vesselId, input: { loa_ft: Number(loaFt) } })}
        >
          Save length
        </Button>
      </div>
      {updateVessel.isError && <p className="mt-1 text-rose-400">Couldn't save that length.</p>}
    </div>
  );
}

function AddVesselInline({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (id: number, name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [typePrefix, setTypePrefix] = useState("");
  const [loaFt, setLoaFt] = useState("");
  const createVessel = useCreateVessel();

  return (
    <div className="space-y-2">
      <input
        className={`${inputClass} w-full py-1`}
        placeholder="Vessel name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          className={`${inputClass} w-20 py-1`}
          placeholder="R/V"
          value={typePrefix}
          onChange={(e) => setTypePrefix(e.target.value)}
        />
        <input
          className={`${inputClass} w-24 py-1`}
          placeholder="LOA (ft)"
          type="number"
          value={loaFt}
          onChange={(e) => setLoaFt(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button
          variant="primary"
          disabled={name.trim() === "" || createVessel.isPending}
          onClick={() =>
            createVessel.mutate(
              {
                name: name.trim(),
                type_prefix: typePrefix.trim() || null,
                loa_ft: loaFt === "" ? null : Number(loaFt),
                is_active: true,
              },
              { onSuccess: (v) => onCreated(v.id, v.name) },
            )
          }
        >
          Add vessel
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
