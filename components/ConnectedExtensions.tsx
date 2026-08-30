"use client";

import { useState } from "react";
import { MonitorSmartphone, Trash2 } from "lucide-react";

import { revokeExtensionConnection } from "@/app/settings/actions";

type ExtensionConnection = {
  id: number;
  name: string;
  createdAt: string;
  expiresAt: string;
};

export function ConnectedExtensions({ initialConnections }: { initialConnections: ExtensionConnection[] }) {
  const [connections, setConnections] = useState(initialConnections);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  if (connections.length === 0) return null;

  async function revoke(connectionId: number) {
    setRevokingId(connectionId);
    try {
      await revokeExtensionConnection(connectionId);
      setConnections((current) => current.filter((connection) => connection.id !== connectionId));
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold font-mono uppercase tracking-wider text-muted px-1">Connected extensions</h2>
      <div className="border-y border-border divide-y divide-border">
        {connections.map((connection) => (
          <div key={connection.id} className="flex items-center gap-4 py-4">
            <MonitorSmartphone className="w-5 h-5 text-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary truncate">{connection.name}</p>
              <p className="text-xs text-muted mt-0.5">
                Connected {formatDate(connection.createdAt)} · expires {formatDate(connection.expiresAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => revoke(connection.id)}
              disabled={revokingId === connection.id}
              className="p-2 text-muted hover:text-destructive disabled:opacity-40 transition-colors"
              aria-label={`Revoke ${connection.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
