from dataclasses import dataclass, field
from typing import Dict, Set

@dataclass
class Proposal:
    proposer: str
    deposit: int
    votes: Dict[str, bool] = field(default_factory=dict)

class TokenCuratedRegistry:
    """Simple token curated registry for top issuers or courses."""
    def __init__(self, token_balances: Dict[str, int], min_deposit: int = 10):
        self.token_balances = token_balances
        self.min_deposit = min_deposit
        self.registry: Set[str] = set()
        self.proposals: Dict[str, Proposal] = {}

    def propose(self, item: str, proposer: str, deposit: int) -> None:
        if deposit < self.min_deposit:
            raise ValueError("deposit below minimum")
        if self.token_balances.get(proposer, 0) < deposit:
            raise ValueError("insufficient balance")
        if item in self.proposals or item in self.registry:
            raise ValueError("item already proposed or registered")
        self.token_balances[proposer] -= deposit
        self.proposals[item] = Proposal(proposer=proposer, deposit=deposit)

    def vote(self, item: str, voter: str, support: bool) -> None:
        if item not in self.proposals:
            raise ValueError("unknown proposal")
        self.proposals[item].votes[voter] = support

    def finalize(self, item: str) -> None:
        if item not in self.proposals:
            raise ValueError("unknown proposal")
        proposal = self.proposals.pop(item)
        yes = sum(1 for v in proposal.votes.values() if v)
        no = sum(1 for v in proposal.votes.values() if not v)
        if yes > no:
            self.registry.add(item)
            self.token_balances[proposal.proposer] += proposal.deposit
        # if rejected deposit is forfeited

    def listed_items(self) -> Set[str]:
        return set(self.registry)
