#!/usr/bin/env bash
# Bootstrap script — sets up the full MERN DevOps stack on a fresh cluster
set -euo pipefail

NAMESPACE="mern-app"
CLUSTER_NAME="${CLUSTER_NAME:-mern-devops-cluster}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "=========================================="
echo "  MERN DevOps Stack Setup"
echo "=========================================="

check_tools() {
  echo "[1/6] Checking required tools..."
  for tool in kubectl helm aws terraform argocd; do
    if ! command -v "$tool" &>/dev/null; then
      echo "  ERROR: $tool is not installed"
      exit 1
    fi
    echo "  OK: $tool $(${tool} version --short 2>/dev/null || true)"
  done
}

provision_infra() {
  echo "[2/6] Provisioning AWS infrastructure with Terraform..."
  cd terraform
  terraform init
  terraform plan -out=tfplan
  terraform apply -auto-approve tfplan
  aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$AWS_REGION"
  cd ..
}

install_operators() {
  echo "[3/6] Installing Kubernetes operators and controllers..."

  # Cert-manager
  kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
  kubectl wait --for=condition=available deployment -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=120s

  # ECK Operator for ELK stack
  kubectl create -f https://download.elastic.co/downloads/eck/2.9.0/crds.yaml || true
  kubectl apply -f https://download.elastic.co/downloads/eck/2.9.0/operator.yaml

  # ArgoCD
  kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
  kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
  kubectl wait --for=condition=available deployment -l app.kubernetes.io/name=argocd-server -n argocd --timeout=180s
}

install_monitoring() {
  echo "[4/6] Installing Prometheus & Grafana (kube-prometheus-stack)..."
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update
  helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
    --namespace monitoring --create-namespace \
    -f monitoring/prometheus/prometheus-stack.yaml \
    --wait --timeout 5m
}

install_logging() {
  echo "[5/6] Installing ELK stack..."
  kubectl create namespace logging --dry-run=client -o yaml | kubectl apply -f -
  kubectl apply -f logging/elasticsearch/elasticsearch.yaml
  kubectl apply -f logging/kibana/kibana.yaml
  kubectl apply -f logging/filebeat/filebeat.yaml
  kubectl apply -f logging/logstash/logstash.yaml
}

deploy_app() {
  echo "[6/6] Deploying MERN application with ArgoCD..."
  kubectl apply -f argocd/project.yaml
  kubectl apply -f argocd/application.yaml

  echo ""
  echo "=========================================="
  echo "  Setup Complete!"
  echo "=========================================="
  echo ""
  echo "ArgoCD UI:"
  echo "  kubectl port-forward svc/argocd-server -n argocd 8080:443"
  echo "  Password: $(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)"
  echo ""
  echo "Grafana UI:"
  echo "  kubectl port-forward svc/kube-prometheus-stack-grafana -n monitoring 3001:80"
  echo "  Login: admin / grafana-admin-pass"
  echo ""
  echo "Kibana UI:"
  echo "  kubectl port-forward svc/kibana-kb-http -n logging 5601:5601"
}

check_tools
provision_infra
install_operators
install_monitoring
install_logging
deploy_app
