export interface StakeInfo {
  address: string;
  amount: number;
}

export default class YieldFarming {
  private stakers: Map<string, number> = new Map();
  private feesCollected = 0;
  private totalStaked = 0;

  stake(info: StakeInfo): void {
    const current = this.stakers.get(info.address) || 0;
    this.stakers.set(info.address, current + info.amount);
    this.totalStaked += info.amount;
  }

  recordFee(amount: number): void {
    this.feesCollected += amount;
  }

  distributeRewards(): Map<string, number> {
    const rewards = new Map<string, number>();
    this.stakers.forEach((staked, address) => {
      const reward = this.totalStaked === 0 ? 0 : (staked / this.totalStaked) * this.feesCollected;
      rewards.set(address, reward);
    });
    this.feesCollected = 0;
    return rewards;
  }
}
