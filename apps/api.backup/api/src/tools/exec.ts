type Job = () => Promise<any>;
const Q: Job[] = [];
const CONC = Number(process.env.TOOL_CONCURRENCY || 6);
let active = 0;

export function enqueue(job: Job) {
  Q.push(job);
  run();
}

async function run() {
  while (active < CONC && Q.length) {
    const j = Q.shift()!;
    active++;
    j()
      .catch(() => {})
      .finally(() => {
        active--;
        setTimeout(run, 10);
      });
  }
}

export async function withRetry<T>(fn: () => Promise<T>, n = 3) {
  let last: any;
  for (let i = 0; i < n; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, Math.random() * 150 + 50));
    }
  }
  throw last;
}

