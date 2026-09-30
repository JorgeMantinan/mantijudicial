import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface CaseNote {
  id: string;
  caseId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

const MAX_CHARS = 4000;

export class NoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoteError";
  }
}

interface NotesFile {
  case_id?: string;
  notes?: CaseNote[];
}

export class NoteStore {
  private notes: CaseNote[];

  private constructor(notes: CaseNote[]) {
    this.notes = notes;
  }

  static empty(): NoteStore {
    return new NoteStore([]);
  }

  static async load(filePath: string): Promise<NoteStore> {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as NotesFile;
      return new NoteStore(Array.isArray(parsed.notes) ? parsed.notes : []);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return NoteStore.empty();
      throw error;
    }
  }

  async save(filePath: string, caseId: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    const payload: NotesFile = { case_id: caseId, notes: this.notes };
    await fs.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await fs.rename(tmp, filePath);
  }

  /** Solo las notas del propio usuario: son LAWYER_ONLY. */
  listFor(userId: string, caseId?: string): CaseNote[] {
    return this.notes
      .filter((note) => note.userId === userId && (!caseId || note.caseId === caseId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  add(input: { caseId: string; userId: string; userName: string; text: string }): CaseNote {
    const text = input.text.trim();
    if (text.length === 0) throw new NoteError("La nota no puede estar vacía");
    if (text.length > MAX_CHARS) throw new NoteError(`Máximo ${MAX_CHARS} caracteres`);
    if (!/^case_\d{6}$/.test(input.caseId)) throw new NoteError("Caso no válido");
    const note: CaseNote = {
      id: `not_${crypto.randomBytes(8).toString("hex")}`,
      caseId: input.caseId,
      userId: input.userId,
      userName: input.userName,
      text,
      createdAt: new Date().toISOString(),
    };
    this.notes.push(note);
    return note;
  }

  remove(noteId: string, userId: string): CaseNote {
    const note = this.notes.find((item) => item.id === noteId);
    if (!note) throw new NoteError("Nota no encontrada");
    if (note.userId !== userId) throw new NoteError("Solo el autor puede borrar la nota");
    this.notes = this.notes.filter((item) => item.id !== noteId);
    return note;
  }
}
