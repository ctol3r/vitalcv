// packages/command-registry/src/registry.ts
// Simplified command registry with /, ;;, jj support

type Cmd = {
  id: string;
  hint: string;
  run: (args?: any) => Promise<any>;
};

const cmds = new Map<string, Cmd>();

export function register(cmd: Cmd) {
  cmds.set(cmd.id, cmd);
}

export function list() {
  return [...cmds.values()].map((c) => ({ id: c.id, hint: c.hint }));
}

export async function exec(id: string, args?: any) {
  const c = cmds.get(id);
  if (!c) throw new Error('unknown_command');
  return c.run(args);
}

export function get(id: string): Cmd | undefined {
  return cmds.get(id);
}

export function search(query: string): Cmd[] {
  const q = query.toLowerCase();
  return [...cmds.values()].filter(
    (c) => c.id.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)
  );
}

