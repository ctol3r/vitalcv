export function validateVAT(v?:string){ if(!v) return false; return /^([A-Z]{2})[A-Z0-9]{6,12}$/.test(v); }
export function calcTax(subtotal:number, rate:number){ return +(subtotal*rate/100).toFixed(2); }
export function applyPromo(subtotal:number, pct?:number){ if(!pct) return subtotal; return +(subtotal*(1 - pct/100)).toFixed(2); }

