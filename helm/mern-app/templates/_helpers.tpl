{{/*
Expand the name of the chart.
*/}}
{{- define "mern-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "mern-app.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "mern-app.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "mern-app.backendSelectorLabels" -}}
app: backend
app.kubernetes.io/name: backend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "mern-app.frontendSelectorLabels" -}}
app: frontend
app.kubernetes.io/name: frontend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
MongoDB URI
*/}}
{{- define "mern-app.mongoUri" -}}
{{- printf "mongodb://%s:%s@mongodb-0.mongodb.%s.svc.cluster.local:27017/%s?authSource=admin" .Values.mongodb.auth.rootUsername .Values.mongodb.auth.rootPassword .Values.global.namespace .Values.mongodb.auth.database }}
{{- end }}
