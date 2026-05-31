# MERN Stack DevOps Operations

> A production-grade **MERN Stack Todo Application** backed by a complete DevOps pipeline —
> covering 20 topics from Linux fundamentals to CKA exam preparation.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, MUI v5, React Query, Nginx |
| **Backend** | Node.js 20, Express 4, Mongoose, Winston, prom-client |
| **Database** | MongoDB 7 (K8s StatefulSet with PVC) |
| **Containerization** | Docker (multi-stage), Docker Compose |
| **Orchestration** | Kubernetes (AWS EKS 1.28) |
| **Package Manager** | Helm 3 |
| **Infrastructure** | Terraform (AWS EKS + VPC + ECR) |
| **CI Pipeline** | GitHub Actions |
| **CD Pipeline** | Jenkins (K8s agents) + ArgoCD (GitOps) |
| **Ingress** | Nginx Ingress Controller + cert-manager (TLS) |
| **Deployments** | Rolling Update, Blue-Green, Canary |
| **Monitoring** | Prometheus + Grafana (kube-prometheus-stack) |
| **Logging** | ELK Stack — Filebeat → Logstash → Elasticsearch → Kibana |
| **Container Registry** | AWS ECR |
| **Cloud** | AWS (EKS, VPC, ECR, S3 for Terraform state) |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET / USER                                │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │  HTTPS
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AWS Load Balancer (ELB)                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Nginx Ingress Controller  (K8s)                          │
│                                                                             │
│   yourdomain.com  ────────────────────────────────────►  Frontend Service  │
│   api.yourdomain.com  ─────────────────────────────────►  Backend Service  │
└──────────┬────────────────────────────────┬────────────────────────────────┘
           │                                │
           ▼                                ▼
┌──────────────────────┐        ┌──────────────────────────────┐
│  Frontend Pod (x2)   │        │  Backend Pod (x2)            │
│  ┌────────────────┐  │        │  ┌────────────────────────┐  │
│  │  React 18 App  │  │        │  │  Express REST API       │  │
│  │  served by     │  │        │  │  /api/todos             │  │
│  │  Nginx 1.25    │  │        │  │  /health  /ready        │  │
│  └────────────────┘  │        │  │  /metrics (Prometheus)  │  │
│  HPA: 2–6 pods       │        │  └────────────┬───────────┘  │
└──────────────────────┘        │  HPA: 2–10 pods│             │
                                └───────────────-│─────────────┘
                                                 │
                                                 ▼
                                ┌──────────────────────────────┐
                                │  MongoDB StatefulSet (x1)    │
                                │  ┌────────────────────────┐  │
                                │  │  MongoDB 7.0           │  │
                                │  │  Headless Service      │  │
                                │  │  PVC: 5Gi (EBS)        │  │
                                │  └────────────────────────┘  │
                                └──────────────────────────────┘
```

---

## CI/CD Pipeline Flow

```
Developer
   │
   │  git push
   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GitHub Repository                                   │
│                                                                             │
│   main branch ──────────────────────────────────── Production deploy       │
│   develop branch ───────────────────────────────── Staging deploy          │
│   pull_request ─────────────────────────────────── Tests only              │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │  triggers
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  GitHub Actions CI  (.github/workflows/ci.yml)              │
│                                                                             │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────────────────┐ │
│  │ test-backend│   │ test-frontend│   │     build-push (main/develop)    │ │
│  │             │   │              │   │                                  │ │
│  │ npm ci      │   │ npm ci       │   │  docker buildx (multi-platform)  │ │
│  │ npm test    │   │ npm test     │   │  ECR login (aws-actions)         │ │
│  │ jest cov    │   │ npm build    │   │  push :sha + :latest             │ │
│  │ codecov     │   │              │   │  Trivy vulnerability scan        │ │
│  └──────┬──────┘   └──────┬───────┘   └──────────────┬───────────────────┘ │
│         └────────────┬────┘                           │                    │
│                      │ both pass                      │ images pushed      │
└──────────────────────│────────────────────────────────│────────────────────┘
                       │                                │
                       └──────────── AND ───────────────┘
                                        │  triggers
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  GitHub Actions CD  (.github/workflows/cd.yml)              │
│                                                                             │
│  aws eks update-kubeconfig                                                  │
│       │                                                                     │
│       ▼                                                                     │
│  helm upgrade --install mern-app  (atomic, --wait, 5m timeout)             │
│       │                                                                     │
│       ▼                                                                     │
│  kubectl rollout status  (verify both deployments)                          │
│       │                                                                     │
│       ├── SUCCESS ──► deployment live                                       │
│       └── FAILURE ──► helm rollback  (auto)                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Jenkins Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Jenkins  (K8s Pod Agents)                            │
│                                                                             │
│  Checkout                                                                   │
│     │                                                                       │
│     ▼                                                                       │
│  ┌──────────────────────────────────────┐                                  │
│  │ Parallel Test Stage                  │                                  │
│  │  ┌────────────────┐ ┌─────────────┐  │                                  │
│  │  │ Test Backend   │ │Test Frontend│  │  container: node:20-alpine       │
│  │  │ npm ci + jest  │ │ npm build   │  │                                  │
│  │  └────────────────┘ └─────────────┘  │                                  │
│  └──────────────────────────────────────┘                                  │
│     │ both pass                                                             │
│     ▼                                                                       │
│  Build & Push Images                     container: docker:dind            │
│     │  aws ecr get-login-password                                           │
│     │  docker build + push :sha + :latest                                  │
│     ▼                                                                       │
│  Deploy to Staging    (branch: develop)  container: helm:3.12              │
│     │  helm upgrade --install mern-app-staging                             │
│     ▼                                                                       │
│  Deploy to Production (branch: main)                                       │
│     │                                                                       │
│     ├──► INPUT GATE ◄──  "Deploy to Production? Yes / No"                  │
│     │                                                                       │
│     ▼                                                                       │
│  Smoke Tests                             container: kubectl                 │
│     │  kubectl rollout status                                               │
│     │  kubectl get pods                                                     │
│     ▼                                                                       │
│  Post: cleanWs()                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## GitOps Flow (ArgoCD)

```
Developer
   │
   │  git push ──► GitHub (main branch)
   │
   ▼
┌────────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                           │
│                  helm/mern-app/  (source of truth)                 │
└────────────────────────────┬───────────────────────────────────────┘
                             │  ArgoCD polls every 3 min
                             │  (or webhook triggers instantly)
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                  ArgoCD  (namespace: argocd)                       │
│                                                                    │
│  AppProject: mern-devops                                           │
│      │                                                             │
│      ├── Application: mern-app-production  (tracks: main)         │
│      │       │  syncPolicy: automated { prune, selfHeal }         │
│      │       │  retry: 5x with backoff                            │
│      │       │                                                     │
│      │       ▼                                                     │
│      │   helm template ──► kubectl apply ──► namespace: mern-app  │
│      │                                                             │
│      └── Application: mern-app-staging    (tracks: develop)       │
│              │  namespace: mern-app-staging                        │
│              │  replicas overridden to 1                           │
│              ▼                                                     │
│          helm template ──► kubectl apply                           │
└────────────────────────────────────────────────────────────────────┘

  Drift detected?  ──► ArgoCD auto-heals (selfHeal: true)
  Resource pruned in git? ──► ArgoCD deletes from cluster (prune: true)
```

---

## Kubernetes Deployment Architecture

```
Namespace: mern-app
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ConfigMap: backend-config          Secret: mongodb-secret                  │
│  (PORT, NODE_ENV, LOG_LEVEL)        (base64: user, pass, db)               │
│          │                                   │                              │
│          └──────────────┬────────────────────┘                             │
│                         │  envFrom / secretKeyRef                          │
│                         ▼                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Deployment: backend  (replicas: 2, RollingUpdate maxUnavailable: 0) │  │
│  │  ┌──────────────┐  ┌──────────────┐                                  │  │
│  │  │ backend pod  │  │ backend pod  │  ◄── HPA: 2–10 (CPU 70%)        │  │
│  │  │ :5000        │  │ :5000        │                                  │  │
│  │  │ /health ✓    │  │ /health ✓    │                                  │  │
│  │  │ /metrics ✓   │  │ /metrics ✓   │                                  │  │
│  │  └──────────────┘  └──────────────┘                                  │  │
│  └──────────────────────────┬─────────────────────────────────────────--┘  │
│                             │  Service: backend (ClusterIP :5000)           │
│                             ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  StatefulSet: mongodb  (replicas: 1, Headless Service)               │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │ mongodb-0                                                    │   │  │
│  │  │ DNS: mongodb-0.mongodb.mern-app.svc.cluster.local:27017      │   │  │
│  │  │ PVC: mongo-data (5Gi EBS, ReadWriteOnce)                     │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Deployment: frontend  (replicas: 2, RollingUpdate)                  │  │
│  │  ┌──────────────┐  ┌──────────────┐                                  │  │
│  │  │ frontend pod │  │ frontend pod │  ◄── HPA: 2–6 (CPU 70%)         │  │
│  │  │ Nginx :80    │  │ Nginx :80    │                                  │  │
│  │  └──────────────┘  └──────────────┘                                  │  │
│  └──────────────────────────┬─────────────────────────────────────────--┘  │
│                             │  Service: frontend (ClusterIP :80)            │
└─────────────────────────────│───────────────────────────────────────────────┘
                              │
                    Ingress (Nginx)
                    yourdomain.com → frontend :80
                    api.yourdomain.com → backend :5000
```

---

## Blue-Green Deployment Flow

```
                     ┌─────────────────────────┐
                     │  Service: backend        │
                     │  selector: slot = blue   │◄── Traffic flows here
                     └────────────┬────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              │                                       │
              ▼                                       ▼
  ┌─────────────────────────┐           ┌─────────────────────────┐
  │  Deployment: backend-   │           │  Deployment: backend-   │
  │  blue  (slot=blue)      │           │  green  (slot=green)    │
  │  Image: mern-backend:v1 │           │  Image: mern-backend:v2 │
  │  replicas: 2            │  STANDBY  │  replicas: 2            │
  │  ✅ LIVE                │           │  (warming up / testing) │
  └─────────────────────────┘           └─────────────────────────┘

  ─────────────── switch-traffic.sh ───────────────────────────────

  1. Verify green readyReplicas >= 1
  2. kubectl patch service backend
        selector: slot ──► green
  3. 100% traffic instantly moves to green (zero downtime)

                     ┌─────────────────────────┐
                     │  Service: backend        │
                     │  selector: slot = green  │◄── Traffic now here
                     └────────────┬────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              │                                       │
              ▼                                       ▼
  ┌─────────────────────────┐           ┌─────────────────────────┐
  │  Deployment: backend-   │           │  Deployment: backend-   │
  │  blue  (slot=blue)      │           │  green  (slot=green)    │
  │  Image: mern-backend:v1 │  STANDBY  │  Image: mern-backend:v2 │
  │  (kept for rollback)    │           │  ✅ LIVE                │
  └─────────────────────────┘           └─────────────────────────┘

  Rollback: run switch-traffic.sh again → flips back to blue instantly
```

---

## Canary Deployment Flow

```
                                   Nginx Ingress
                                        │
                          ┌─────────────┴────────────┐
                          │  Traffic split via replica │
                          │  ratio to backend Service │
                          │  (selector: app=backend)  │
                          └─────────────┬─────────────┘
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           │                                                         │
           ▼  ~90% of requests                                       ▼  ~10% of requests
  ┌────────────────────┐                                   ┌────────────────────┐
  │  backend-stable    │                                   │  backend-canary    │
  │  replicas: 9       │                                   │  replicas: 1       │
  │  Image: v1         │                                   │  Image: v2         │
  │  track=stable      │                                   │  track=canary      │
  └────────────────────┘                                   └────────────────────┘

  Header-based routing (explicit canary testing):
  curl -H "X-Canary: always" https://api.yourdomain.com
       └──► always routes to canary pod regardless of replica ratio

  ─────────────── Promotion Steps ─────────────────────────────────────────────

  Phase 1 (10%)  stable:9  canary:1   ← observe error rate & latency
  Phase 2 (30%)  stable:7  canary:3   ← scale canary, shrink stable
  Phase 3 (50%)  stable:5  canary:5   ← 50/50 split
  Phase 4 (100%) stable:0  canary:9   ← full promotion (rename → stable)

  Abort:  kubectl scale deployment backend-canary --replicas=0 -n mern-app
```

---

## Infrastructure (Terraform → AWS)

```
AWS Account
└── Region: us-east-1
    │
    ├── VPC  (10.0.0.0/16)
    │   ├── Public Subnets  (3 AZs)  ── NAT Gateway, ELB
    │   └── Private Subnets (3 AZs)  ── EKS worker nodes
    │
    ├── EKS Cluster: mern-devops-cluster  (k8s 1.28)
    │   ├── Managed Node Group: t3.medium  (min:1, max:5)
    │   ├── Add-ons: CoreDNS, kube-proxy, vpc-cni, ebs-csi-driver
    │   └── Helm Releases (provisioned by Terraform):
    │       ├── aws-load-balancer-controller
    │       ├── ingress-nginx
    │       └── cert-manager
    │
    ├── ECR Repositories
    │   ├── mern-backend   (scan-on-push, lifecycle: keep 10 tagged)
    │   └── mern-frontend  (scan-on-push, lifecycle: expire untagged >7d)
    │
    └── S3 Bucket: mern-devops-tfstate  (Terraform remote state)
        DynamoDB Table: terraform-locks  (state locking)
```

---

## Monitoring Flow (Prometheus + Grafana)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster (namespace: mern-app)               │
│                                                                             │
│  backend pods                                                               │
│  ┌─────────────┐                                                            │
│  │  Express    │──── GET /metrics ────────────────────────────────────┐    │
│  │  prom-client│   (Prometheus text format)                           │    │
│  └─────────────┘                                                      │    │
│                                                                       │    │
└───────────────────────────────────────────────────────────────────────│────┘
                                                                        │
                                                                        │ scrape (15s)
                                                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  namespace: monitoring                                      │
│                                                                             │
│  ServiceMonitor: mern-backend-monitor                                       │
│      │  (tells Prometheus Operator which pods to scrape)                   │
│      ▼                                                                      │
│  Prometheus  ◄── kube-state-metrics (pod/node/deploy state)               │
│      │       ◄── node-exporter (CPU, memory, disk per node)               │
│      │                                                                      │
│      │  evaluates PrometheusRules every 30s                                │
│      ├──► BackendHighErrorRate  (>5% 5xx for 2m)  ──► Alertmanager        │
│      ├──► BackendHighLatency    (p95 >1s for 5m)  ──► Alertmanager        │
│      ├──► PodRestartingTooMuch  (>5 restarts/1h)  ──► Alertmanager        │
│      └──► MongoDBDown           (0 ready replicas) ──► Alertmanager       │
│                                                                             │
│  Grafana  ◄── datasource: Prometheus                                       │
│      │                                                                      │
│      ├── Dashboard: MERN App                                               │
│      │     ├── Request Rate (req/s)                                        │
│      │     ├── Error Rate (%)                                              │
│      │     ├── P95 Latency (ms)                                            │
│      │     ├── Pod Count                                                   │
│      │     ├── Request Rate Over Time (by status)                          │
│      │     ├── CPU Usage by Pod                                            │
│      │     └── Memory Usage by Pod                                         │
│      │                                                                      │
│      └── Dashboard: Kubernetes / Node overview (built-in)                 │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Logging Flow (ELK Stack)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                  Kubernetes Cluster (all namespaces)                        │
│                                                                             │
│  backend pods                  frontend pods                               │
│  /var/log/containers/*.log     /var/log/containers/*.log                   │
│         │                              │                                    │
│         └──────────────┬──────────────┘                                    │
│                        │  hostPath volume mounts                           │
│                        ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Filebeat DaemonSet  (one pod per node)                             │   │
│  │  - Reads all container log files                                    │   │
│  │  - Adds K8s metadata (pod, namespace, labels)                      │   │
│  │  - Parses JSON log lines from Winston logger                       │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
└───────────────────────────────────│────────────────────────────────────────┘
                                    │  Beats protocol (:5044)
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  namespace: logging  (ECK Operator)                         │
│                                                                             │
│  Logstash                                                                   │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │  input  { beats { port => 5044 } }                      │               │
│  │  filter {                                               │               │
│  │    json { source => "message" target => "parsed" }     │               │
│  │    date { match => ["timestamp", "ISO8601"] }          │               │
│  │    mutate { add_field => { "service" => "mern-..." } } │               │
│  │  }                                                      │               │
│  │  output { elasticsearch { index => "mern-logs-%{date}"}│               │
│  └───────────────────────────────┬─────────────────────────┘               │
│                                  │                                          │
│                                  ▼                                          │
│  Elasticsearch  (ECK, 1 node, 2Gi RAM, 20Gi EBS PVC)                       │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │  index: mern-logs-YYYY.MM.DD                         │                  │
│  │  xpack.security: enabled                             │                  │
│  └────────────────────────────┬─────────────────────────┘                  │
│                               │                                             │
│                               ▼                                             │
│  Kibana  (ECK, port 5601)                                                   │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │  Discover  ── search & filter logs                   │                  │
│  │  Dashboards ── visualize log volume, errors, latency │                  │
│  │  Alerting  ── notify on error spikes                 │                  │
│  └──────────────────────────────────────────────────────┘                  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Request Lifecycle (End to End)

```
User Browser
     │
     │  1. HTTPS GET https://yourdomain.com
     ▼
AWS ELB  (provisioned by aws-load-balancer-controller)
     │
     │  2. TLS termination
     ▼
Nginx Ingress Pod
     │
     │  3. Route by Host header
     │     yourdomain.com      ──► frontend Service
     │     api.yourdomain.com  ──► backend Service
     ▼
Frontend Pod (Nginx)
     │
     │  4. Serve React SPA (cached static assets)
     │     /api/* requests proxied to backend Service
     ▼
Backend Pod (Express)
     │
     │  5. Rate limit check (100 req/15min per IP)
     │  6. Request logged via Morgan (stdout → Filebeat)
     │  7. Route handler: GET /api/todos
     │  8. Mongoose query → MongoDB StatefulSet
     │  9. Prometheus counter incremented
     │ 10. JSON response returned
     ▼
User Browser  ◄── response in ~50ms
     │
     │  Async / background:
     ├── Filebeat tails log → Logstash → Elasticsearch
     └── Prometheus scrapes /metrics every 15s → Grafana dashboard
```

---

## Directory Structure

```
devops-operations/
│
├── app/                                # Application source code
│   ├── backend/                        # 04 Node.js + Express REST API
│   │   ├── src/
│   │   │   ├── server.js               #    Entry point, middleware wiring
│   │   │   ├── models/todo.js          #    Mongoose schema
│   │   │   ├── routes/todos.js         #    CRUD + toggle endpoints
│   │   │   └── middleware/logger.js    #    Winston structured logger
│   │   ├── Dockerfile                  # 04 Multi-stage, non-root, healthcheck
│   │   └── package.json
│   │
│   ├── frontend/                       # 04 React 18 SPA
│   │   ├── src/
│   │   │   ├── App.js
│   │   │   ├── components/TodoList.js
│   │   │   └── services/api.js         #    Axios API client
│   │   ├── nginx.conf                  # 08 Nginx SPA config + API proxy
│   │   └── Dockerfile                  # 04 Multi-stage build
│   │
│   └── docker-compose.yml              # 05 Local dev: 4 services
│
├── k8s/                                # Raw Kubernetes manifests
│   ├── 00-namespace.yaml               # 09 Namespace
│   ├── mongodb/                        # 09 StatefulSet, headless SVC, Secret
│   ├── backend/                        # 10 Deployment, Service, ConfigMap
│   ├── frontend/                       # 10 Deployment, Service
│   ├── ingress/                        # 08 Nginx Ingress + TLS
│   ├── hpa/                            # 09 HPA for backend & frontend
│   ├── blue-green/                     # 14 Blue + Green Deployments, switch script
│   └── canary/                         # 15 Stable + Canary + weighted Ingress
│
├── helm/mern-app/                      # 11 Helm chart
│   ├── Chart.yaml
│   ├── values.yaml                     #    Single source of config truth
│   └── templates/
│       ├── _helpers.tpl                #    Named templates & helpers
│       ├── deployment-backend.yaml
│       ├── deployment-frontend.yaml
│       ├── service-backend.yaml
│       ├── service-frontend.yaml
│       ├── ingress.yaml
│       └── hpa.yaml
│
├── terraform/                          # 12 AWS infrastructure
│   ├── providers.tf                    #    AWS, K8s, Helm providers + S3 backend
│   ├── vpc.tf                          #    VPC, subnets, NAT, tags for EKS
│   ├── eks.tf                          #    EKS cluster, node groups, add-ons
│   ├── ecr.tf                          #    ECR repos + lifecycle policies
│   ├── variables.tf
│   └── outputs.tf
│
├── .github/workflows/
│   ├── ci.yml                          # 06 Test → Build → Scan → Push
│   └── cd.yml                          # 06 Helm deploy → Verify → Rollback
│
├── jenkins/
│   └── Jenkinsfile                     # 07 K8s pod agents, parallel stages, gate
│
├── argocd/
│   ├── project.yaml                    # 13 AppProject (RBAC scope)
│   └── application.yaml               # 13 prod + staging Applications
│
├── monitoring/
│   ├── prometheus/
│   │   ├── prometheus-stack.yaml       # 16 kube-prometheus-stack Helm values
│   │   └── service-monitor.yaml        # 16 ServiceMonitor + PrometheusRules
│   └── grafana/
│       └── dashboard-mern.json         # 17 Pre-built MERN dashboard
│
├── logging/
│   ├── elasticsearch/elasticsearch.yaml# 18 ECK Elasticsearch
│   ├── kibana/kibana.yaml              # 18 ECK Kibana + Ingress
│   ├── logstash/logstash.yaml          # 18 Logstash pipeline
│   └── filebeat/filebeat.yaml          # 18 DaemonSet + RBAC
│
└── scripts/
    ├── setup.sh                        # 19 Bootstrap entire stack (6 steps)
    └── rollback.sh                     # 19 Interactive Helm rollback
```

---

## Topic Coverage

| # | Topic | What's demonstrated |
|---|-------|---------------------|
| 01 | **Linux** | Bash scripts, `adduser`/`addgroup` in Dockerfiles, `chmod`, volume mounts, log dirs |
| 02 | **Networking** | VPC + subnets + NAT, K8s Services (ClusterIP/headless), Nginx Ingress, TLS |
| 03 | **Git & GitHub** | `.gitignore`, branch strategy (main/develop), PR-triggered CI |
| 04 | **Docker** | Multi-stage builds, non-root users, HEALTHCHECK, `.dockerignore`, build args |
| 05 | **Docker Compose** | 4-service stack with `depends_on` health conditions, named volumes, networks |
| 06 | **GitHub Actions** | Matrix tests, ECR login, `docker/build-push-action`, Trivy scan, Helm deploy |
| 07 | **Jenkins** | Kubernetes pod agents, parallel stages, `input` approval gate, `withCredentials` |
| 08 | **Nginx** | SPA routing, API proxy, gzip, security headers, rate limiting, cache headers |
| 09 | **K8s Basics** | Namespace, Deployment, StatefulSet, Service, ConfigMap, Secret, HPA, PVC |
| 10 | **Deploy MERN on K8s** | All three tiers on K8s with probes, resource limits, env injection |
| 11 | **Helm** | Chart with `_helpers.tpl`, conditional blocks, `toYaml`, `values.yaml` overrides |
| 12 | **Terraform** | EKS + VPC modules, ECR lifecycle, S3+DynamoDB remote state, Helm provider |
| 13 | **ArgoCD** | AppProject RBAC, automated sync, selfHeal, prune, retry backoff |
| 14 | **Blue-Green** | Two live deployments, instant service selector flip, health-gated switch |
| 15 | **Canary** | Pod-ratio traffic split + Nginx weight annotation + header-based override |
| 16 | **Prometheus** | prom-client in app, ServiceMonitor, 4 custom alert rules, Alertmanager |
| 17 | **Grafana** | Dashboard JSON (7 panels), Helm values datasource config |
| 18 | **ELK Stack** | ECK operator, Filebeat DaemonSet, Logstash pipeline, Kibana ingress, RBAC |
| 19 | **End-to-End** | `setup.sh` (6-phase bootstrap), `rollback.sh` (interactive Helm) |
| 20 | **CKA Prep** | Covers all 5 CKA domains — see section below |

---

## Quick Start (Local Dev)

```bash
# Clone and start the full stack locally
git clone https://github.com/sashikantcodex/devops-operations.git
cd devops-operations/app

docker compose up --build

# Frontend:       http://localhost:3000
# API:            http://localhost:5000/api/todos
# Mongo Express:  http://localhost:8081
```

---

## Deploy to AWS EKS

### Step 1 — Provision Infrastructure
```bash
cd terraform
terraform init
terraform plan
terraform apply
# Note the ECR URLs in the output
```

### Step 2 — Build & Push Images
```bash
ECR_BASE=$(terraform output -json ecr_registry_url | jq -r '.["mern-backend"]' | cut -d/ -f1)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_BASE

docker build -t $ECR_BASE/mern-backend:v1 app/backend/  && docker push $ECR_BASE/mern-backend:v1
docker build -t $ECR_BASE/mern-frontend:v1 app/frontend/ && docker push $ECR_BASE/mern-frontend:v1
```

### Step 3 — Deploy with Helm
```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/mongodb/

helm upgrade --install mern-app helm/mern-app \
  --namespace mern-app \
  --set backend.image.repository=$ECR_BASE/mern-backend \
  --set frontend.image.repository=$ECR_BASE/mern-frontend \
  --set backend.image.tag=v1 \
  --set frontend.image.tag=v1 \
  --wait
```

### Step 4 — Set up GitOps
```bash
# ArgoCD will auto-sync Helm chart on every push to main
kubectl apply -f argocd/project.yaml
kubectl apply -f argocd/application.yaml

# Get ArgoCD admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d
```

### Step 5 — Or use the bootstrap script
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh    # provisions infra + installs operators + deploys everything
```

---

## Blue-Green Deployment

```bash
# Deploy both slots
kubectl apply -f k8s/blue-green/

# Validate green is healthy, then flip
./k8s/blue-green/switch-traffic.sh

# Rollback: run again (flips back)
./k8s/blue-green/switch-traffic.sh
```

## Canary Deployment

```bash
kubectl apply -f k8s/canary/
# 10% traffic hits v2 automatically (1 canary : 9 stable pods)

# Test canary explicitly
curl -H "X-Canary: always" https://api.yourdomain.com/api/todos

# Promote gradually
kubectl scale deployment backend-canary --replicas=5 -n mern-app
kubectl scale deployment backend-stable --replicas=5 -n mern-app

# Full promotion
kubectl scale deployment backend-stable --replicas=0 -n mern-app
kubectl scale deployment backend-canary --replicas=9 -n mern-app
```

---

## Monitoring Setup

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f monitoring/prometheus/prometheus-stack.yaml --wait

kubectl apply -f monitoring/prometheus/service-monitor.yaml

# Grafana UI
kubectl port-forward svc/kube-prometheus-stack-grafana -n monitoring 3001:80
# http://localhost:3001  (admin / grafana-admin-pass)

# Prometheus UI
kubectl port-forward svc/kube-prometheus-stack-prometheus -n monitoring 9090:9090
```

---

## Logging Setup (ELK)

```bash
# Install ECK Operator
kubectl create -f https://download.elastic.co/downloads/eck/2.9.0/crds.yaml
kubectl apply  -f https://download.elastic.co/downloads/eck/2.9.0/operator.yaml

kubectl create namespace logging
kubectl apply -f logging/elasticsearch/elasticsearch.yaml
kubectl apply -f logging/kibana/kibana.yaml
kubectl apply -f logging/logstash/logstash.yaml
kubectl apply -f logging/filebeat/filebeat.yaml

# Kibana UI
kubectl port-forward svc/kibana-kb-http -n logging 5601:5601
# http://localhost:5601
# Password: kubectl get secret elasticsearch-es-elastic-user -n logging -o jsonpath='{.data.elastic}' | base64 -d
```

---

## CKA Preparation

| CKA Domain (% of exam) | Demonstrated in this project |
|-------------------------|------------------------------|
| **Cluster Architecture (25%)** | EKS node groups, RBAC (ArgoCD project roles, Filebeat ClusterRole), ServiceAccounts |
| **Workloads & Scheduling (15%)** | Deployments (RollingUpdate), StatefulSet (MongoDB), DaemonSet (Filebeat), HPA |
| **Services & Networking (20%)** | ClusterIP, headless Service, Nginx Ingress, NetworkPolicy-ready namespace structure |
| **Storage (10%)** | PVC via StatefulSet `volumeClaimTemplates`, EBS CSI driver, emptyDir for logs |
| **Troubleshooting (30%)** | Liveness + Readiness probes, resource requests/limits, structured logging, `/health` + `/ready` |

### Handy CKA Commands
```bash
# Inspect running state
kubectl get all -n mern-app
kubectl top pods -n mern-app
kubectl top nodes

# Debug a pod
kubectl describe pod <pod-name> -n mern-app
kubectl logs <pod-name> -n mern-app --previous
kubectl exec -it <pod-name> -n mern-app -- sh

# Deployment operations
kubectl rollout status deployment/backend -n mern-app
kubectl rollout history deployment/backend -n mern-app
kubectl rollout undo deployment/backend -n mern-app
kubectl scale deployment backend --replicas=4 -n mern-app

# Resource inspection
kubectl get events -n mern-app --sort-by='.lastTimestamp'
kubectl get hpa -n mern-app
kubectl get pvc -n mern-app
```

---

## Rollback

```bash
# Interactive Helm rollback (shows history, asks for revision)
./scripts/rollback.sh

# Manual
helm history mern-app -n mern-app
helm rollback mern-app <revision> -n mern-app --wait
```

---

## Environment Access

| Service | Command | URL |
|---------|---------|-----|
| App (local) | `docker compose up` | http://localhost:3000 |
| API (local) | `docker compose up` | http://localhost:5000 |
| ArgoCD | `kubectl port-forward svc/argocd-server -n argocd 8080:443` | https://localhost:8080 |
| Grafana | `kubectl port-forward svc/kube-prometheus-stack-grafana -n monitoring 3001:80` | http://localhost:3001 |
| Prometheus | `kubectl port-forward svc/...-prometheus -n monitoring 9090:9090` | http://localhost:9090 |
| Kibana | `kubectl port-forward svc/kibana-kb-http -n logging 5601:5601` | http://localhost:5601 |
| Mongo Express | `docker compose up` | http://localhost:8081 |
