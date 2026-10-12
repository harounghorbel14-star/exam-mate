export class BudgetExceededError extends Error {}

/** Hard limits for one agent run: step count, wall-clock deadline and external cancellation. */
export class Budget {
  private steps = 0;
  readonly deadline: number;
  readonly controller = new AbortController();
  constructor(public readonly maxSteps: number, timeoutMs: number, parent?: AbortSignal) {
    this.deadline = Date.now() + timeoutMs;
    if (parent) {
      if (parent.aborted) this.controller.abort(parent.reason);
      else parent.addEventListener('abort', () => this.controller.abort(parent.reason), { once: true });
    }
  }
  get signal() { return this.controller.signal; }
  remainingMs() { return Math.max(0, this.deadline - Date.now()); }
  step(label: string) {
    if (this.controller.signal.aborted) throw new BudgetExceededError(`Cancelled before ${label}`);
    if (Date.now() > this.deadline) { this.controller.abort('timeout'); throw new BudgetExceededError(`Time limit reached before ${label}`); }
    if (++this.steps > this.maxSteps) throw new BudgetExceededError(`Step limit (${this.maxSteps}) reached before ${label}`);
  }
  get used() { return this.steps; }
}

/** Run a promise with a timeout derived from the budget. */
export async function withinBudget<T>(budget: Budget, p: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const t = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new BudgetExceededError(`${label} timed out`)), budget.remainingMs()); });
  const abort = new Promise<never>((_, reject) => budget.signal.addEventListener('abort', () => reject(new BudgetExceededError(`${label} cancelled`)), { once: true }));
  try { return await Promise.race([p, t, abort]); } finally { clearTimeout(timer); }
}
