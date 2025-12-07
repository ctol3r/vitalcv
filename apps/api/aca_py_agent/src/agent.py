import os
import subprocess
from typing import List


def start_agent(extra_args: List[str] = None) -> subprocess.Popen:
    """Start an ACA-Py agent with support for AnonCreds and W3C credentials."""
    aca_py_command = [
        "aca-py",
        "start",
        "--inbound-transport", "http", "0.0.0.0", "8020",
        "--outbound-transport", "http",
        "--admin", "0.0.0.0", "8031",
        "--plugin", "aries_cloudagent.messaging.jsonld",
        "--plugin", "aries_cloudagent.anoncreds",
    ]

    if extra_args:
        aca_py_command.extend(extra_args)

    env = os.environ.copy()
    return subprocess.Popen(aca_py_command, env=env)
