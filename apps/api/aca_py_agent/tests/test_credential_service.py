import json
from unittest.mock import patch
from aca_py_agent.src.credential_service import CredentialService


@patch('aca_py_agent.src.credential_service.requests.post')
def test_issue_and_verify(mock_post):
    service = CredentialService('http://acapy:8031')

    # Mock issuing response
    mock_post.return_value.status_code = 200
    mock_post.return_value.json.return_value = {'success': True}

    credential = {'credential_proposal': {'attributes': [{'name': 'license', 'value': '123'}]}}
    resp = service.issue_credential(credential)
    assert resp['success']

    proof_request = {'presentation_request': {'name': 'proof', 'version': '1.0'}}
    resp = service.verify_credential(proof_request)
    assert resp['success']

    assert mock_post.call_count == 2
