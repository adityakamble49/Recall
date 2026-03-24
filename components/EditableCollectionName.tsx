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
        className="text-4xl md:text-[3.5rem] font-extrabold tracking-tighter text-on-surface leading-none bg-transparent border-b-2 border-primary outline-none w-full"
      />
    );
  }

  return (
    <h1
      onClick={() => setEditing(true)}
      className="text-4xl md:text-[3.5rem] font-extrabold tracking-tighter text-on-surface leading-none cursor-pointer hover:text-primary/80 transition-colors"
      title="Click to rename"
    >
      {value}
    </h1>
  );
}
