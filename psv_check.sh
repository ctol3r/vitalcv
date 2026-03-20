#!/bin/bash

echo "{
  \"source\": \"test-script\",
  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
  \"status\": \"ok\",
  \"notes\": \"PSV check simulated successfully\"
}" >> ~/psv_log.json

echo "PSV check complete"
