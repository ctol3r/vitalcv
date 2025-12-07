export function jlog(obj: any) {
  try {
    console.log(JSON.stringify(obj));
  } catch {
    console.log('[log]');
  }
}

