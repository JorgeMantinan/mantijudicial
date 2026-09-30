export type JobStatus = "queued" | "running" | "done" | "error";

export interface JobRecord {
  id: string;
  kind: string;
  status: JobStatus;
  caseId?: string;
  lines: string[];
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export class JobRegistry {
  private jobs = new Map<string, JobRecord>();
  private tail: Promise<unknown> = Promise.resolve();
  private counter = 0;

  create(kind: string): JobRecord {
    this.counter += 1;
    const job: JobRecord = {
      id: `job_${String(this.counter).padStart(4, "0")}_${Date.now().toString(36)}`,
      kind,
      status: "queued",
      lines: [],
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  get(id: string): JobRecord | null {
    return this.jobs.get(id) ?? null;
  }

  list(): JobRecord[] {
    return [...this.jobs.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  append(id: string, line: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.lines.push(line);
    if (job.lines.length > 500) job.lines.splice(0, job.lines.length - 500);
  }

  patch(id: string, changes: Partial<JobRecord>): void {
    const job = this.jobs.get(id);
    if (!job) return;
    Object.assign(job, changes);
  }

  /**
   * Las tareas pesadas (ingesta con IA) se ejecutan en serie: si llega otra,
   * espera a que termine la anterior en lugar de pisar manifiestos.
   */
  runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task, task);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  isBusy(): boolean {
    return this.list().some((job) => job.status === "queued" || job.status === "running");
  }
}
