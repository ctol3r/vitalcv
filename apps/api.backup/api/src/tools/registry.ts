// dynamic loader for generated native tools
const tools: Record<string, any> = {};

export async function loadNative(fnName: string) {
  try {
    const m = await import(`./native/${fnName}.ts`);
    tools[fnName] = async (args: any) => m[fnName](args, tools);
    return true;
  } catch {
    return false;
  }
}
