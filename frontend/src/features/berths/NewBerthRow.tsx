import { useState } from "react";

import type { BerthCreateInput } from "../../api/berths";
import { Button } from "../../components/Button";
import { inputClass } from "../../lib/formStyles";

interface NewBerthRowProps {
  onCancel: () => void;
  onSave: (input: BerthCreateInput) => void;
  saving: boolean;
}

export function NewBerthRow({ onCancel, onSave, saving }: NewBerthRowProps) {
  const [name, setName] = useState("");
  const [lengthFt, setLengthFt] = useState("");

  return (
    <tr className="border-t border-surface-700/60 bg-emerald-500/10">
      <td className="px-3 py-2">
        <input
          autoFocus
          placeholder="Berth name"
          className={`${inputClass} w-full py-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          placeholder="Length"
          className={`${inputClass} w-24 py-1`}
          value={lengthFt}
          onChange={(e) => setLengthFt(e.target.value)}
        />
      </td>
      <td className="px-3 py-2 text-slate-500">{"—"}</td>
      <td className="px-3 py-2 text-slate-500">Yes</td>
      <td className="px-3 py-2 text-slate-500">{"—"}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <Button
          variant="primary"
          disabled={saving || name.trim() === ""}
          onClick={() =>
            onSave({
              name: name.trim(),
              length_ft: lengthFt === "" ? null : Number(lengthFt),
              is_active: true,
              sort_order: 0,
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
