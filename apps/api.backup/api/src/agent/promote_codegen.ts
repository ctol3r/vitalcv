import fs from 'fs';
import path from 'path';
import { pool } from './db';

export async function codegenNativeTool(name: string) {
  const { rows } = await pool.query('SELECT manifest FROM "McpTool" WHERE name=$1 LIMIT 1', [name]);
  if (!rows[0]) throw new Error('MCP not found');
  const m = rows[0].manifest;
  const fnName = 'native_' + name.replace(/[^a-zA-Z0-9_]/g, '_');

  const code = `export async function ${fnName}(args:any, tools:any){
  let ctx={...args};
  ${(m.steps || []).map((s: any) => `ctx = Object.assign(ctx, await tools['${s.tool}']({ ...( ${JSON.stringify(s.params || {})} ), ...ctx }));`).join('\n  ')}
  return ctx;
}`;

  const outDir = path.join(process.cwd(), 'src', 'tools', 'native');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${fnName}.ts`);
  fs.writeFileSync(file, code);
  return { file, fnName, code };
}

export async function compileNativeTool(tsFile: string) {
  /* simple: rely on ts-node/tsx at runtime; compilation unnecessary in dev */
  return { jsFile: tsFile };
}
