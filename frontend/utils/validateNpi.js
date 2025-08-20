/**
 * Validate an NPI number using format and Luhn checksum.
 * The check digit is calculated with the standard NPI prefix 80840.
 * @param {string} npi - 10 digit National Provider Identifier
 * @returns {boolean} true if the NPI is valid
 */
function isValidNPI(npi) {
  if (typeof npi !== 'string') return false;
  const digits = npi.replace(/\D/g, '');
  if (digits.length !== 10) return false;
  const nums = digits.split('').map(Number);
  const prefix = [8, 0, 8, 4, 0];
  const payload = prefix.concat(nums.slice(0, 9));
  let sum = 0;
  for (let i = payload.length - 1; i >= 0; i--) {
    let val = payload[i];
    if ((payload.length - i) % 2 === 1) {
      val *= 2;
      if (val > 9) val -= 9;
    }
    sum += val;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === nums[9];
}

module.exports = { isValidNPI };
