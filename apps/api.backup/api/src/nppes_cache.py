import os
import json
import time
from typing import Any
import requests


class NPPESDataCache:
    """Fetch NPPES provider data with local caching."""

    def __init__(self, cache_dir: str = "nppes_cache", ttl: int = 24 * 3600) -> None:
        self.cache_dir = cache_dir
        self.ttl = ttl
        os.makedirs(self.cache_dir, exist_ok=True)

    def _cache_path(self, npi: str) -> str:
        return os.path.join(self.cache_dir, f"{npi}.json")

    def _is_cache_valid(self, path: str) -> bool:
        if not os.path.exists(path):
            return False
        return time.time() - os.path.getmtime(path) < self.ttl

    def fetch(self, npi: str) -> Any:
        """Return provider data for the given NPI number."""
        cache_file = self._cache_path(npi)
        if self._is_cache_valid(cache_file):
            with open(cache_file, "r") as f:
                return json.load(f)

        url = f"https://npiregistry.cms.hhs.gov/api/?version=2.1&number={npi}"
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            with open(cache_file, "w") as f:
                json.dump(data, f)
            return data
        except Exception as exc:
            if os.path.exists(cache_file):
                with open(cache_file, "r") as f:
                    return json.load(f)
            raise RuntimeError(f"Failed to fetch NPPES data: {exc}")
