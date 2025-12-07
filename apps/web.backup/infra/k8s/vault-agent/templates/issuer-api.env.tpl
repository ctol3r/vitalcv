{{- /*
  Template rendered by Vault Agent into /vault/secrets/issuer-api.env
  Expected fields:
    - signing_key_jwk  (JSON string)
    - issuer_did
    - database_url
*/ -}}
{{- with .Data.data }}
export VC_SIGNING_KEY_JWK='{{ .signing_key_jwk }}'
export ISSUER_DID='{{ .issuer_did }}'
export DATABASE_URL='{{ .database_url }}'
{{- end }}

