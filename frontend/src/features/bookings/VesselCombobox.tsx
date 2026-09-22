import { useState } from "react";

import { ApiError } from "../../api/client";
import { isVesselConflictDetail, useCreateVessel, useVessels } from "../../api/vessels";
import { Button } from "../../components/Button";

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

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={query}
        placeholder={"Search vessels…"}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {vesselId != null && (
        <p className="mt-1 text-xs text-emerald-700">Selected: {vesselName}</p>
      )}

      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          <ul className="max-h-48 overflow-y-auto py-1">
            {(vessels ?? []).map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50"
                  onMouseDown={() => {
                    onSelect(v.id, v.name);
                    setQuery(v.name);
                    setOpen(false);
                  }}
                >
                  {v.type_prefix ? `${v.type_prefix} ${v.name}` : v.name}
                  {v.loa_ft == null && <span className="ml-1 text-amber-600">(length unknown)</span>}
                </button>
              </li>
            ))}
            {(vessels ?? []).length === 0 && (
              <li className="px-3 py-1.5 text-sm text-slate-400">No matches</li>
            )}
          </ul>
          <div className="border-t border-slate-200 p-2">
            {!adding ? (
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800"
                onMouseDown={() => setAdding(true)}
              >
                + Add new vessel{query ? ` "${query}"` : ""}
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
          <p className="mt-1 text-xs text-red-600">
            A vessel with this name already exists (#{createVessel.error.detail.vessel_id}).
          </p>
        )}
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
    <div className="space-y-2" onMouseDown={(e) => e.stopPropagation()}>
      <input
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        placeholder="Vessel name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="R/V"
          value={typePrefix}
          onChange={(e) => setTypePrefix(e.target.value)}
        />
        <input
          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
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
