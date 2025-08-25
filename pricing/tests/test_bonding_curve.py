import unittest
from pricing.bonding_curve import BondingCurve

class TestBondingCurve(unittest.TestCase):
    def test_price_calculation(self):
        curve = BondingCurve(base_price=1.0, slope=0.5)
        self.assertAlmostEqual(curve.price(0), 1.0)
        self.assertAlmostEqual(curve.price(2), 2.0)

    def test_cost_to_mint(self):
        curve = BondingCurve(base_price=1.0, slope=0.5)
        cost = curve.cost_to_mint(0, 2)
        self.assertAlmostEqual(cost, 3.0)

    def test_tokens_for_cost(self):
        curve = BondingCurve(base_price=1.0, slope=0.5)
        tokens = curve.tokens_for_cost(0, 3.0)
        self.assertAlmostEqual(tokens, 2.0, places=5)

if __name__ == '__main__':
    unittest.main()
