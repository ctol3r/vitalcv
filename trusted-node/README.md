# Trusted Node Deployment Kit

This directory contains a minimal example of how institutional validators can deploy a
"trusted node" using Docker and Helm. The implementation is a placeholder and does
not run a real blockchain node.

## Building the Docker image

```
docker build -t trusted-node:latest .
```

## Running locally

```
docker run --rm trusted-node:latest
```

## Deploying with Helm

```
helm install my-trusted-node ./helm
```

Customize the values in `helm/values.yaml` to suit your environment.
