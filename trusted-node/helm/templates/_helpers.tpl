{{- define "trusted-node.name" -}}
trusted-node
{{- end }}

{{- define "trusted-node.fullname" -}}
{{ include "trusted-node.name" . }}-{{ .Release.Name }}
{{- end }}
