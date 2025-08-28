import requests
from typing import Dict, Any


class CredentialService:
    """Service that issues and verifies credentials via ACA-Py's admin API."""

    def __init__(self, admin_url: str = "http://localhost:8031") -> None:
        self.admin_url = admin_url.rstrip("/")

    def issue_credential(self, credential_data: Dict[str, Any]) -> Dict[str, Any]:
        """Issue a credential using the issuer credential API."""
        response = requests.post(f"{self.admin_url}/issue-credential/send", json=credential_data)
        response.raise_for_status()
        return response.json()

    def verify_credential(self, proof_request: Dict[str, Any]) -> Dict[str, Any]:
        """Verify a credential by sending a proof request."""
        response = requests.post(f"{self.admin_url}/present-proof/send-request", json=proof_request)
        response.raise_for_status()
        return response.json()
