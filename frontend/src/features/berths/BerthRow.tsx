import { useState } from "react";

import type { Berth, BerthUpdateInput } from "../../api/berths";
import { Button } from "../../components/Button";
import { inputClass } from "../../lib/formStyles";

interface BerthRowProps {
  berth: Berth;
  isAdmin: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (input: BerthUpdateInput) => void;
  saving: boolean;
}

const cellInput = `${inputClass} w-full py-1`;
const cellInputNarrow = `${inputClass} w-24 py-1`;

export function BerthRow({ berth, isAdmin, isEditing, onEdit, onCancel, onSave, saving }: BerthRowProps) {
  const [name, setName] = useState(berth.name);
  const [lengthFt, setLengthFt] = useState(berth.length_ft?.toString() ?? "");
  const [maxDraftFt, setMaxDraftFt] = useState(berth.max_draft_ft?.toString() ?? "");
  const [isActive, setIsActive] = useState(berth.is_active);
  const [notes, setNotes] = useState(berth.notes ?? "");

  if (!isEditing) {
    return (
      <tr className="transition-default border-t border-surface-700/60 hover:bg-surface-800/60">
        <td className="px-3 py-2 font-medium text-slate-200">{berth.name}</td>
        <td className="px-3 py-2 text-slate-300">
          {berth.length_ft ?? <span className="text-amber-400">Unknown</span>}
        </td>
        <td className="px-3 py-2 text-slate-300">{berth.max_draft_ft ?? "—"}</td>
        <td className="px-3 py-2">
          {berth.is_active ? (
            <span className="text-emerald-400">Yes</span>
          ) : (
            <span className="text-slate-500">No</span>
          )}
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
    <tr className="border-t border-surface-700/60 bg-brand-600/10">
      <td className="px-3 py-2">
        <input className={cellInput} value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          className={cellInputNarrow}
          value={lengthFt}
          onChange={(e) => setLengthFt(e.target.value)}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          className={cellInputNarrow}
          value={maxDraftFt}
          onChange={(e) => setMaxDraftFt(e.target.value)}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-surface-500 bg-surface-800 text-brand-500 focus:ring-brand-500/40"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      </td>
      <td className="px-3 py-2">
        <input className={cellInput} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
