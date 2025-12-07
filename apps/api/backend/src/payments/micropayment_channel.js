/**
 * Voucher for claiming a portion of funds in a micropayment channel.
 * This module provides a very small in-memory implementation that can be used
 * to prototype off-chain API payments with eventual on-chain settlement.
 */

class MicropaymentChannel {
  constructor(channelId, payer, payee) {
    this.channelId = channelId;
    this.payer = payer;
    this.payee = payee;
    this.balance = 0;
  }

  deposit(amount) {
    this.balance += amount;
  }

  createVoucher(amount, signer) {
    if (amount > this.balance) {
      throw new Error('Insufficient balance');
    }
    const message = `${this.channelId}:${amount}`;
    const signature = signer(message);
    return { channelId: this.channelId, amount, signature };
  }

  settle(voucher, verifier) {
    const message = `${voucher.channelId}:${voucher.amount}`;
    if (!verifier(message, voucher.signature)) {
      return false;
    }
    if (voucher.amount > this.balance) {
      return false;
    }
    this.balance -= voucher.amount;
    // In a real implementation the smart contract would be invoked here
    return true;
  }
}

module.exports = { MicropaymentChannel };
