export class DeflationaryToken {
  private balances: Map<string, number> = new Map();
  private _totalSupply: number;
  constructor(
    initialHolder: string,
    initialSupply: number,
    private burnRate: number
  ) {
    this._totalSupply = initialSupply;
    this.balances.set(initialHolder, initialSupply);
  }

  get totalSupply(): number {
    return this._totalSupply;
  }

  getBalance(address: string): number {
    return this.balances.get(address) || 0;
  }

  transfer(from: string, to: string, amount: number): void {
    const fromBalance = this.getBalance(from);
    if (fromBalance < amount) {
      throw new Error('Insufficient balance');
    }
    const burnAmount = amount * this.burnRate;
    const amountAfterBurn = amount - burnAmount;
    this.balances.set(from, fromBalance - amount);
    this.balances.set(to, this.getBalance(to) + amountAfterBurn);
    this._totalSupply -= burnAmount;
  }

  // Represents using tokens for a utility function
  useUtility(user: string, cost: number): void {
    const userBalance = this.getBalance(user);
    if (userBalance < cost) {
      throw new Error('Insufficient balance for utility use');
    }
    const burnAmount = cost * this.burnRate;
    this.balances.set(user, userBalance - cost);
    this._totalSupply -= burnAmount;
  }
}
