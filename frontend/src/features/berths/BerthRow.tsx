import { useState } from "react";

import type { Berth, BerthUpdateInput } from "../../api/berths";
import { Button } from "../../components/Button";

interface BerthRowProps {
  berth: Berth;
  isAdmin: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (input: BerthUpdateInput) => void;
  saving: boolean;
}

export function BerthRow({ berth, isAdmin, isEditing, onEdit, onCancel, onSave, saving }: BerthRowProps) {
  const [name, setName] = useState(berth.name);
  const [lengthFt, setLengthFt] = useState(berth.length_ft?.toString() ?? "");
  const [maxDraftFt, setMaxDraftFt] = useState(berth.max_draft_ft?.toString() ?? "");
  const [isActive, setIsActive] = useState(berth.is_active);
  const [notes, setNotes] = useState(berth.notes ?? "");

  if (!isEditing) {
    return (
      <tr className="border-t border-slate-100">
        <td className="px-3 py-2 font-medium text-slate-800">{berth.name}</td>
        <td className="px-3 py-2">{berth.length_ft ?? <span className="text-amber-600">Unknown</span>}</td>
        <td className="px-3 py-2">{berth.max_draft_ft ?? "—"}</td>
        <td className="px-3 py-2">
          {berth.is_active ? "Yes" : <span className="text-slate-400">No</span>}
        </td>
        <td className="px-3 py-2 text-slate-500">{berth.notes ?? "—"}</td>
        {isAdmin && (
          <td className="px-3 py-2 text-right">
            <Button variant="ghost" onClick={onEdit}>
              Edit
            </Button>
          </td>
        )}
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100 bg-blue-50/40">
      <td className="px-3 py-2">
        <input
          className="w-full rounded border border-slate-300 px-2 py-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          className="w-24 rounded border border-slate-300 px-2 py-1"
          value={lengthFt}
          onChange={(e) => setLengthFt(e.target.value)}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          className="w-24 rounded border border-slate-300 px-2 py-1"
          value={maxDraftFt}
          onChange={(e) => setMaxDraftFt(e.target.value)}
        />
      </td>
      <td className="px-3 py-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
      </td>
      <td className="px-3 py-2">
        <input
          className="w-full rounded border border-slate-300 px-2 py-1"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <Button
          variant="primary"
          disabled={saving}
          onClick={() =>
            onSave({
              name,
              length_ft: lengthFt === "" ? null : Number(lengthFt),
              max_draft_ft: maxDraftFt === "" ? null : Number(maxDraftFt),
              is_active: isActive,
              notes: notes === "" ? null : notes,
            })
          }
        >
          Save
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </td>
    </tr>
  );
}
