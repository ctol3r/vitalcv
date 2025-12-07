{{- /*
  Web API secret template
*/ -}}
{{- with .Data.data }}
export SESSION_SECRET='{{ .session_secret }}'
export API_SIGNING_KEY='{{ .api_signing_key }}'
{{- end }}

