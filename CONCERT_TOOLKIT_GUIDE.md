# IBM Concert Toolkit Integration Guide

This guide explains how to use the IBM Concert Toolkit in the DevSecOps pipeline for generating build and deployment SBOMs.

## Overview

The IBM Concert Toolkit is an official IBM tool that generates Software Bill of Materials (SBOM) in a format optimized for IBM Concert. It creates two types of SBOMs:

1. **Build SBOM** - Captures information about the build process, dependencies, and artifacts
2. **Deploy SBOM** - Captures deployment configuration, runtime environment, and infrastructure

## IBM Concert Toolkit Container

The toolkit is distributed as a container image:

```
icr.io/cpopen/ibm-concert-toolkit:v2.1.0
```

### Pulling the Toolkit

```bash
docker pull icr.io/cpopen/ibm-concert-toolkit:v2.1.0
```

## Configuration Files

The toolkit requires two YAML configuration files:

### 1. Build Configuration (`concert/build-config.yaml`)

This file configures the build SBOM generation:

```yaml
apiVersion: v1
kind: BuildConfig
metadata:
  name: concert-demo-build

build:
  name: concert-demo
  version: ${IMAGE_TAG}
  
  source:
    type: git
    repository: ${GITHUB_REPOSITORY}
    commit: ${GITHUB_SHA}
  
  image:
    name: ${IMAGE_NAME}
    tag: ${IMAGE_TAG}
  
  sbom:
    input_file: /toolkit-data/concert-demo-sbom.json
    output_file: /toolkit-data/concert-build-sbom.json
    format: cyclonedx
```

**Key Fields:**
- `input_file` - Path to the Syft-generated SBOM
- `output_file` - Path where Concert build SBOM will be saved
- `format` - SBOM format (cyclonedx or spdx)

### 2. Deploy Configuration (`concert/deploy-config.yaml`)

This file configures the deployment SBOM generation:

```yaml
apiVersion: v1
kind: DeployConfig
metadata:
  name: concert-demo-deploy

deployment:
  name: concert-demo
  version: ${IMAGE_TAG}
  
  environment:
    name: production
    type: kubernetes
  
  image:
    name: ${IMAGE_NAME}
    tag: ${IMAGE_TAG}

sbom:
  input_file: /toolkit-data/concert-build-sbom.json
  output_file: /toolkit-data/concert-deploy-sbom.json
  format: cyclonedx
```

**Key Fields:**
- `input_file` - Path to the build SBOM
- `output_file` - Path where Concert deploy SBOM will be saved
- `environment` - Target deployment environment details

## Environment Variables

The configuration files use environment variable substitution. The workflow automatically substitutes these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `IMAGE_NAME` | Full image name with registry | `ghcr.io/user/repo/concert-demo` |
| `IMAGE_TAG` | Image tag (commit SHA) | `abc123def456` |
| `GITHUB_REPOSITORY` | Repository name | `user/repo` |
| `GITHUB_SHA` | Commit SHA | `abc123def456` |
| `GITHUB_REF_NAME` | Branch name | `main` |
| `GITHUB_ACTOR` | User who triggered workflow | `username` |
| `GITHUB_RUN_ID` | Workflow run ID | `12345` |
| `GITHUB_RUN_NUMBER` | Workflow run number | `42` |

### Variable Substitution

The workflow uses `envsubst` to replace variables:

```bash
envsubst < concert/build-config.yaml > toolkit-data/build-config.yaml
```

## Running the Toolkit

### Generate Build SBOM

```bash
docker run --rm \
  -v $(pwd)/toolkit-data:/toolkit-data \
  icr.io/cpopen/ibm-concert-toolkit:v2.1.0 \
  /bin/bash -c \
  "build-sbom --build-config /toolkit-data/build-config.yaml"
```

**Parameters:**
- `-v $(pwd)/toolkit-data:/toolkit-data` - Mount local directory into container
- `build-sbom` - Toolkit command for generating build SBOM
- `--build-config` - Path to build configuration file

### Generate Deploy SBOM

```bash
docker run --rm \
  -v $(pwd)/toolkit-data:/toolkit-data \
  icr.io/cpopen/ibm-concert-toolkit:v2.1.0 \
  /bin/bash -c \
  "deploy-sbom --deploy-config /toolkit-data/deploy-config.yaml"
```

**Parameters:**
- `deploy-sbom` - Toolkit command for generating deploy SBOM
- `--deploy-config` - Path to deploy configuration file

## Toolkit Data Directory Structure

The toolkit expects a specific directory structure:

```
toolkit-data/
├── concert-demo-sbom.json          # Input: Syft-generated SBOM
├── build-config.yaml               # Input: Build configuration
├── deploy-config.yaml              # Input: Deploy configuration
├── concert-build-sbom.json         # Output: Build SBOM
└── concert-deploy-sbom.json        # Output: Deploy SBOM
```

## Workflow Integration

### Step 1: Prepare Data Directory

```yaml
- name: Prepare Toolkit Directory
  run: |
    mkdir -p toolkit-data
    cp concert-demo-sbom.json toolkit-data/
    envsubst < concert/build-config.yaml > toolkit-data/build-config.yaml
    envsubst < concert/deploy-config.yaml > toolkit-data/deploy-config.yaml
```

### Step 2: Generate Build SBOM

```yaml
- name: Generate Build SBOM
  run: |
    docker run --rm \
      -v $(pwd)/toolkit-data:/toolkit-data \
      icr.io/cpopen/ibm-concert-toolkit:v2.1.0 \
      /bin/bash -c \
      "build-sbom --build-config /toolkit-data/build-config.yaml"
```

### Step 3: Generate Deploy SBOM

```yaml
- name: Generate Deploy SBOM
  run: |
    docker run --rm \
      -v $(pwd)/toolkit-data:/toolkit-data \
      icr.io/cpopen/ibm-concert-toolkit:v2.1.0 \
      /bin/bash -c \
      "deploy-sbom --deploy-config /toolkit-data/deploy-config.yaml"
```

## Output Format

### Build SBOM Structure

The build SBOM includes:

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "metadata": {
    "component": {
      "name": "concert-demo",
      "version": "abc123def456",
      "type": "container"
    },
    "properties": [
      {
        "name": "concert:build:source:repository",
        "value": "user/repo"
      },
      {
        "name": "concert:build:source:commit",
        "value": "abc123def456"
      }
    ]
  },
  "components": [...],
  "dependencies": [...]
}
```

### Deploy SBOM Structure

The deploy SBOM includes:

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "metadata": {
    "component": {
      "name": "concert-demo",
      "version": "abc123def456",
      "type": "application"
    },
    "properties": [
      {
        "name": "concert:deploy:environment",
        "value": "production"
      },
      {
        "name": "concert:deploy:platform",
        "value": "kubernetes"
      }
    ]
  },
  "components": [...],
  "dependencies": [...]
}
```

## Uploading to IBM Concert

After generating the SBOMs, upload them to IBM Concert:

### Using Concert CLI

```bash
# Upload build SBOM
concert-cli sbom upload \
  --file toolkit-data/concert-build-sbom.json \
  --type build \
  --project concert-demo

# Upload deploy SBOM
concert-cli sbom upload \
  --file toolkit-data/concert-deploy-sbom.json \
  --type deploy \
  --project concert-demo
```

### Using Concert API

```bash
# Upload build SBOM
curl -X POST "https://concert.example.com/api/v1/sbom/upload" \
  -H "Authorization: Bearer $CONCERT_API_KEY" \
  -F "sbom=@toolkit-data/concert-build-sbom.json" \
  -F "type=build"

# Upload deploy SBOM
curl -X POST "https://concert.example.com/api/v1/sbom/upload" \
  -H "Authorization: Bearer $CONCERT_API_KEY" \
  -F "sbom=@toolkit-data/concert-deploy-sbom.json" \
  -F "type=deploy"
```

## Troubleshooting

### Toolkit Container Not Found

**Error:** `Unable to find image 'icr.io/cpopen/ibm-concert-toolkit:v2.1.0'`

**Solution:**
```bash
# Verify image exists
docker pull icr.io/cpopen/ibm-concert-toolkit:v2.1.0

# Check IBM Container Registry access
docker login icr.io
```

### Configuration File Errors

**Error:** `Error parsing configuration file`

**Solution:**
- Verify YAML syntax is correct
- Ensure all required fields are present
- Check environment variables are substituted correctly

```bash
# Test variable substitution
envsubst < concert/build-config.yaml
```

### Missing Input SBOM

**Error:** `Input SBOM file not found`

**Solution:**
- Ensure Syft SBOM is generated before running toolkit
- Verify file is copied to toolkit-data directory
- Check file path in configuration

```bash
# Verify SBOM exists
ls -lh toolkit-data/concert-demo-sbom.json
```

### Volume Mount Issues

**Error:** `Permission denied` or `File not found`

**Solution:**
- Use absolute paths for volume mounts
- Ensure directory exists before mounting
- Check file permissions

```bash
# Use absolute path
docker run --rm \
  -v /absolute/path/to/toolkit-data:/toolkit-data \
  icr.io/cpopen/ibm-concert-toolkit:v2.1.0 \
  /bin/bash -c "build-sbom --build-config /toolkit-data/build-config.yaml"
```

## Advanced Configuration

### Custom Metadata

Add custom metadata to SBOMs:

```yaml
sbom:
  metadata:
    author: "DevSecOps Team"
    supplier: "Your Organization"
    license: "Apache-2.0"
    description: "Custom description"
```

### Component Filtering

Filter components in the SBOM:

```yaml
sbom:
  filters:
    include_dev_dependencies: false
    include_test_dependencies: false
    min_confidence: 0.8
```

### Validation Rules

Add validation rules:

```yaml
validation:
  required_components:
    - type: library
      min_count: 1
  
  blocked_components:
    - name: vulnerable-package
      version: "1.0.0"
  
  allowed_licenses:
    - MIT
    - Apache-2.0
```

## Best Practices

1. **Version Control** - Keep configuration files in version control
2. **Environment Variables** - Use environment variables for dynamic values
3. **Validation** - Validate SBOMs before uploading to Concert
4. **Artifacts** - Always upload SBOMs as workflow artifacts
5. **Documentation** - Document any custom configuration changes

## Resources

- [IBM Concert Documentation](https://www.ibm.com/docs/concert)
- [IBM Concert Toolkit Release Notes](https://www.ibm.com/docs/concert/toolkit)
- [CycloneDX Specification](https://cyclonedx.org/specification/overview/)
- [SPDX Specification](https://spdx.dev/specifications/)

## Support

For toolkit issues:
- **IBM Support:** https://www.ibm.com/support
- **Documentation:** https://www.ibm.com/docs/concert/toolkit
- **Community:** IBM Concert Community Forum