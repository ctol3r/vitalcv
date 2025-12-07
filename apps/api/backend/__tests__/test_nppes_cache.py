import json
import os
import sys
import tempfile
from unittest import mock

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from backend.src.nppes_cache import NPPESDataCache


class FakeResponse:
    def __init__(self, status_code=200, json_data=None):
        self.status_code = status_code
        self._json = json_data or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f"HTTP {self.status_code}")

    def json(self):
        return self._json


def test_cache_and_recovery():
    fake_data = {"results": [{"number": "123"}]}
    with tempfile.TemporaryDirectory() as tmpdir:
        cache = NPPESDataCache(cache_dir=tmpdir, ttl=60)

        with mock.patch('requests.get', return_value=FakeResponse(json_data=fake_data)) as m:
            data = cache.fetch('123')
            assert data == fake_data
            assert os.path.exists(os.path.join(tmpdir, '123.json'))
            m.assert_called_once()

        # Simulate network failure; should fall back to cache
        with mock.patch('requests.get', side_effect=Exception('network down')) as m:
            data2 = cache.fetch('123')
            assert data2 == fake_data
            m.assert_not_called()
