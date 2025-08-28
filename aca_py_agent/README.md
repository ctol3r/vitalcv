# ACA-Py Agent Microservice

This microservice wraps an [Aries Cloud Agent Python](https://github.com/hyperledger/aries-cloudagent-python) (ACA-Py) instance. It exposes helper utilities for starting the agent and issuing or verifying credentials via the ACA-Py admin API. The service is configured to support both Hyperledger AnonCreds and W3C Verifiable Credential (VC) formats.

## Usage

```
python -m aca_py_agent.src.agent
```

The `CredentialService` class can be imported to programmatically issue and verify credentials.
