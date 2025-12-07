import fs from 'fs';
import axios from 'axios';

const base = process.env.AGENT_BASE || 'http://localhost:4000/api/agent';

(async () => {
  const items = JSON.parse(fs.readFileSync('src/eval/evalset.json', 'utf8'));

  console.log('Running eval harness...\n');

  let lastUsed: string[] = [];

  for (const it of items) {
    try {
      const r = await axios.post(base + '/solve', {
        task: it.task,
        input: it.input,
        scopeHints: ['global', `domain:${it.domain}`]
      });

      console.log(`✓ ${it.task}`);
      console.log(`  Success: ${r.data.success}`);
      console.log(`  Used: ${JSON.stringify(r.data.used || [])}`);
      console.log(`  TraceID: ${r.data.traceId || 'N/A'}\n`);

      if (r.data.used) {
        lastUsed = r.data.used;
      }
    } catch (err: any) {
      console.error(`✗ ${it.task}`);
      console.error(`  Error: ${err.message}\n`);
    }
  }

  // After loop end, call maybePromote with last used list if any
  try {
    const { maybePromote } = await import('../src/eval/streaks');
    await maybePromote(lastUsed);
    console.log('✓ Auto-promote check complete\n');
  } catch (err) {
    console.error('Failed to check auto-promote:', err);
  }
})();

