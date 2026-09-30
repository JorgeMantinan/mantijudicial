"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

interface Note {
  id: string;
  text: string;
  userName: string;
  createdAt: string;
}

export function NotesPanel({ caseId }: { caseId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const response = await fetch(`/api/notes?resource=${caseId}`).catch(() => null);
    if (!response?.ok) return;
    const payload = (await response.json().catch(() => ({ notes: [] }))) as { notes?: Note[] };
    setNotes(payload.notes ?? []);
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, text }),
    }).catch(() => null);
    if (!response) {
      setError("No se pudo contactar con el servidor");
      return;
    }
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "No se pudo guardar la nota");
      return;
    }
    setText("");
    await load();
  }

  async function remove(noteId: string) {
    setError(null);
    const response = await fetch("/api/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, noteId }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = response ? ((await response.json().catch(() => ({}))) as { error?: string }) : {};
      setError(payload.error ?? "No se pudo borrar la nota");
      return;
    }
    startTransition(() => void load());
  }

  return (
    <div className="section">
      <h2>Notas privadas</h2>
      <p className="small muted">
        Visibles <strong>solo para ti</strong> (LAWYER_ONLY): no entran en la búsqueda, en los
        agregados ni en el análisis de otros usuarios.
      </p>

      {notes.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
          {notes.map((note) => (
            <li key={note.id} style={{ marginBottom: 8 }}>
              <blockquote style={{ margin: 0 }}>
                {note.text}
                <div className="small muted" style={{ marginTop: 6 }}>
                  {note.userName} · {note.createdAt.slice(0, 10)} ·{" "}
                  <a
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      void remove(note.id);
                    }}
                  >
                    borrar
                  </a>
                </div>
              </blockquote>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="filters">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Escribe una nota (máx. 4000 caracteres)"
          style={{ flex: 1, minWidth: 240 }}
          maxLength={4000}
        />
        <button type="submit" disabled={isPending || text.trim().length === 0}>
          {isPending ? "Guardando…" : "Guardar nota"}
        </button>
      </form>
      {error && (
        <p className="small" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
