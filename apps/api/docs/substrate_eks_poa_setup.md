# Deploying a Substrate PoA Network on AWS EKS

This document explains how to deploy a permissioned blockchain network based on [Substrate](https://github.com/paritytech/substrate) on Amazon EKS using Proof-of-Authority (PoA) consensus.

## Prerequisites

- **AWS account** with sufficient permissions to create EKS clusters
- **eksctl** for cluster provisioning
- **kubectl** for interacting with Kubernetes
- **Docker** for building container images
- **Helm** (optional) if you prefer using charts

## 1. Create the EKS cluster

Use `eksctl` to create a cluster with at least three worker nodes. The following command creates a basic cluster in the `us-west-2` region:

```bash
eksctl create cluster \
  --name chai-substrate \
  --region us-west-2 \
  --nodes 3 \
  --node-type t3.medium
```

The command may take several minutes to complete. After it finishes, configure your shell to use the new cluster:

```bash
aws eks --region us-west-2 update-kubeconfig --name chai-substrate
```

Verify access with:

```bash
kubectl get nodes
```

## 2. Build a Substrate node image

Clone the Substrate node template and build a Docker image. The template provides a starting point for custom runtimes and PoA networks:

```bash
git clone https://github.com/substrate-developer-hub/substrate-node-template.git
cd substrate-node-template
cargo build --release
```

Build the Docker image and push it to a registry accessible by your EKS cluster (e.g., Amazon ECR):

```bash
docker build -t <account-id>.dkr.ecr.us-west-2.amazonaws.com/chai-node:latest .
# Authenticate to ECR then push
```

## 3. Prepare a PoA chain specification

Generate a raw chain specification with authority keys predefined. Below is a minimal example that defines a single authority using Aura (PoA) consensus. Save it as `chain-spec.json`:

```json
{
  "name": "Chai PoA",
  "id": "chai-poa",
  "chainType": "Live",
  "bootNodes": [],
  "telemetryEndpoints": null,
  "protocolId": null,
  "properties": null,
  "forkBlocks": null,
  "badBlocks": null,
  "consensusEngine": null,
  "genesis": {
    "runtime": {
      "aura": {
        "authorities": ["<AUTHORITY_SR25519_PUBLIC_KEY>"]
      },
      "grandpa": {
        "authorities": [["<AUTHORITY_ED25519_PUBLIC_KEY>", 1]]
      }
    }
  }
}
```

Replace the placeholders with real keys from your authority accounts. Multiple authorities can be listed by adding their keys to the arrays.

## 4. Deploy nodes to the cluster

Kubernetes manifests in `k8s/substrate` describe a simple deployment of two authority nodes sharing the same chain specification. Each node uses a persistent volume for its chain data.

Apply the manifests after adjusting the image name and key values:

```bash
kubectl apply -f k8s/substrate/bootstrap-statefulset.yaml
kubectl apply -f k8s/substrate/authority-statefulset.yaml
```

Use `kubectl get pods` to watch the nodes start up. Once running, you have a functional PoA network on EKS.

## 5. Interact with the network

Port-forward to one of the nodes to submit transactions or read chain data:

```bash
kubectl port-forward svc/chai-node-0 9944:9944
```

You can then use Polkadot JS Apps or a custom application to connect to the RPC endpoint at `localhost:9944`.

## Cleanup

To remove the cluster and all resources:

```bash
kubectl delete -f k8s/substrate/bootstrap-statefulset.yaml
kubectl delete -f k8s/substrate/authority-statefulset.yaml
eksctl delete cluster --name chai-substrate --region us-west-2
```

## Next steps

- Customize your runtime and add modules needed for your application.
- Configure additional authority nodes for fault tolerance.
- Explore Helm charts or other deployment strategies for production setups.

