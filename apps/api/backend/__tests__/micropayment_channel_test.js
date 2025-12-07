const { MicropaymentChannel } = require('../src/payments/micropayment_channel');
const assert = require('assert');

(function () {
  const signer = (data) => 'sig-' + data;
  const verifier = (data, signature) => signature === 'sig-' + data;
  const channel = new MicropaymentChannel('chan1', 'alice', 'bob');
  channel.deposit(100);
  const voucher = channel.createVoucher(50, signer);
  assert.strictEqual(channel.balance, 100);
  const settled = channel.settle(voucher, verifier);
  assert.strictEqual(settled, true);
  assert.strictEqual(channel.balance, 50);
})();
