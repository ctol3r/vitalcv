class BondingCurve:
    """Simple linear bonding curve model for token pricing."""

    def __init__(self, base_price: float, slope: float):
        self.base_price = base_price
        self.slope = slope

    def price(self, supply: float) -> float:
        """Price of the next token at a given supply."""
        return self.base_price + self.slope * supply

    def cost_to_mint(self, current_supply: float, num_tokens: float) -> float:
        """Total cost to mint `num_tokens` starting from `current_supply`."""
        start_price = self.price(current_supply)
        end_price = self.price(current_supply + num_tokens)
        return (start_price + end_price) * num_tokens / 2

    def tokens_for_cost(self, current_supply: float, budget: float) -> float:
        """Number of tokens purchasable with a given budget."""
        a = self.slope / 2
        b = self.base_price + self.slope * current_supply
        c = -budget
        discriminant = b ** 2 - 4 * a * c
        if discriminant < 0:
            return 0
        tokens = (-b + discriminant ** 0.5) / (2 * a)
        return max(tokens, 0)
