import os
import sys
import pytest

# allow importing from backend package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from tcr.token_curated_registry import TokenCuratedRegistry


def test_item_accepted():
    balances = {"alice": 100, "bob": 50}
    tcr = TokenCuratedRegistry(balances)
    tcr.propose("Course A", "alice", 10)
    tcr.vote("Course A", "alice", True)
    tcr.vote("Course A", "bob", True)
    tcr.finalize("Course A")
    assert "Course A" in tcr.listed_items()
    assert balances["alice"] == 100  # deposit returned


def test_item_rejected():
    balances = {"alice": 100, "bob": 50}
    tcr = TokenCuratedRegistry(balances)
    tcr.propose("Course B", "alice", 10)
    tcr.vote("Course B", "bob", False)
    tcr.finalize("Course B")
    assert "Course B" not in tcr.listed_items()
    assert balances["alice"] == 90  # deposit forfeited
