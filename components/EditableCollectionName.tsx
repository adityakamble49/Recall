"use client";

import { useState } from "react";
import { updateCollection } from "@/app/actions";

export function EditableCollectionName({ id, name }: { id: number; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) { setValue(name); setEditing(false); return; }
    await updateCollection(id, { name: trimmed });
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setValue(name); setEditing(false); } }}
        className="text-sm font-semibold bg-transparent border-b-2 border-zinc-900 dark:border-zinc-50 outline-none"
      />
    );
  }

  return (
    <h2
      onClick={() => setEditing(true)}
      className="text-sm font-semibold cursor-pointer hover:text-zinc-500 transition-colors"
      title="Click to rename"
    >
      {value}
    </h2>
  );
}
