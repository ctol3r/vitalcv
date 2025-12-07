export function saveCred(id: string, data: any) {
  const k = 'vitalcv_wallet';
  const cur = JSON.parse(localStorage.getItem(k) || '{}');
  cur[id] = data;
  localStorage.setItem(k, JSON.stringify(cur));
}

export function loadCreds() {
  try {
    return JSON.parse(localStorage.getItem('vitalcv_wallet') || '{}');
  } catch {
    return {};
  }
}

export function deleteCred(id: string) {
  const k = 'vitalcv_wallet';
  const cur = JSON.parse(localStorage.getItem(k) || '{}');
  delete cur[id];
  localStorage.setItem(k, JSON.stringify(cur));
}

