# Quick Setup Guide for IBM Concert Toolkit CI/CD

This guide will help you quickly set up the IBM Concert Toolkit SBOM generation and CVE scanning pipeline.

## Overview

This pipeline uses the **official IBM Concert Toolkit (spec_version 1.0.2)** to generate build and deployment SBOMs. No API keys or secrets are required for SBOM generation - the toolkit runs locally in the workflow.

## Step 1: Create Your Dockerfile

If you don't have a Dockerfile yet:

```bash
# Copy the example Dockerfile
cp Dockerfile.example Dockerfile

# Edit it for your application
nano Dockerfile  # or use your preferred editor
```

### Example Dockerfile for Node.js Application

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

### Example Dockerfile for Python Application

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]
```

### Example Dockerfile for Java Application

```dockerfile
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

## Step 2: Review Concert Configuration Files

The Concert Toolkit configuration files are already set up with the official format (spec_version 1.0.2):

**Build Configuration** (`concert/build-config.yaml`):
- Configured for Docker image builds
- Links to Syft-generated SBOM
- Includes repository metadata
- Uses environment variable substitution

**Deploy Configuration** (`concert/deploy-config.yaml`):
- Configured for Kubernetes deployments
- Includes runtime environment details
- Defines service access points
- Uses environment variable substitution

**Reference Samples**:
- `concert/build-config-sample.yaml` - Complete reference with all options
- `concert/deploy-config-sample.yaml` - Complete reference including VM and zOS

You can customize these files for your specific needs, but the defaults work for most Docker/Kubernetes deployments.

## Step 3: Enable GitHub Container Registry

1. Go to **Settings** → **Actions** → **General**
2. Scroll to **Workflow permissions**
3. Select **Read and write permissions**
4. Check **Allow GitHub Actions to create and approve pull requests**
5. Click **Save**

## Step 4: Commit and Push

```bash
# Add all files
git add .github/workflows/concert-sbom-scan.yml
git add concert/
git add k8s/
git add Dockerfile
git add README.md

# Commit
git commit -m "Add IBM Concert Toolkit DevSecOps pipeline"

# Push to trigger the workflow
git push origin main
```

## Step 5: Monitor the Workflow

1. Go to the **Actions** tab in your repository
2. You should see the workflow running
3. Click on the workflow run to see detailed logs
4. Wait for completion (typically 3-5 minutes)

## Step 6: Review Results

### View Scan Summary

After the workflow completes:
1. Click on the workflow run
2. Scroll to the **Summary** section
3. Review the vulnerability breakdown

### Download Artifacts

1. Scroll to the **Artifacts** section
2. Download `concert-sboms.zip`
3. Extract and review:
   - `concert-demo-sbom.json` - Syft-generated CycloneDX SBOM
   - `concert-build-sbom.json` - IBM Concert build SBOM (spec 1.0.2)
   - `concert-deploy-sbom.json` - IBM Concert deployment SBOM (spec 1.0.2)
   - `grype-report.json` - Vulnerability scan results

### Access Your Container Image

Your image is published to GitHub Container Registry:

```bash
# Pull the image
docker pull ghcr.io/<your-username>/<your-repo>:latest

# Run the image
docker run -p 3000:3000 ghcr.io/<your-username>/<your-repo>:latest
```

## Troubleshooting

### Workflow Fails at "Pull Concert Toolkit"

**Problem:** Cannot pull IBM Concert Toolkit container

**Solutions:**
- Verify IBM Container Registry is accessible
- Check toolkit version: `icr.io/cpopen/ibm-concert-toolkit:v2.1.0`
- Ensure network connectivity from GitHub Actions
- Try pulling manually:
  ```bash
  docker pull icr.io/cpopen/ibm-concert-toolkit:v2.1.0
  ```

### Workflow Fails at "Build Docker image"

**Problem:** Dockerfile errors or missing dependencies

**Solutions:**
- Test Docker build locally:
  ```bash
  docker build -t test-image .
  ```
- Check Dockerfile syntax
- Ensure all required files are in the repository
- Review build logs for specific errors

### Workflow Fails at "Generate Build SBOM"

**Problem:** Concert Toolkit configuration error

**Solutions:**
- Verify `concert/build-config.yaml` uses `spec_version: "1.0.2"`
- Check all required fields are present
- Ensure Syft SBOM file exists in toolkit-data directory
- Review toolkit logs in workflow output
- Validate YAML syntax:
  ```bash
  yamllint concert/build-config.yaml
  ```

### Workflow Fails at "Generate Deploy SBOM"

**Problem:** Concert Toolkit deployment configuration error

**Solutions:**
- Verify `concert/deploy-config.yaml` uses `spec_version: "1.0.2"`
- Check runtime configuration is correct
- Ensure build SBOM was generated successfully
- Review toolkit logs in workflow output

### Grype Scan Fails

**Problem:** Vulnerability scanning fails

**Solutions:**
- Ensure SBOM file exists and is valid CycloneDX format
- Check Grype installation
- Review scan output for specific errors
- Test locally:
  ```bash
  grype sbom:concert-demo-sbom.json
  ```

## Advanced Configuration

### Fail Build on High Severity CVEs

Edit the Grype scan step in the workflow:

```yaml
- name: Scan CVEs
  run: |
    grype sbom:concert-demo-sbom.json -o json --file grype-report.json
    grype sbom:concert-demo-sbom.json -o table
    grype sbom:concert-demo-sbom.json --fail-on high  # Uncomment to fail on high CVEs
```

### Customize Concert Toolkit Configuration

Edit `concert/build-config.yaml` to add custom metadata:

```yaml
concert:
  builds:
  - component_name: "my-app"
    version: "2.0.0"
    tags:
    - "production"
    - "critical"
    # Add more customization
```

Edit `concert/deploy-config.yaml` for deployment settings:

```yaml
concert:
  deployments:
  - environment_target: "staging"  # Change to staging, production, etc.
    runtime:
    - name: "my-cluster"
      type: "kubernetes"
      # Customize runtime configuration
```

### Add Multiple Components

For multi-component builds, edit `concert/build-config.yaml`:

```yaml
concert:
  builds:
  - component_name: "frontend"
    output_file: "frontend-build-sbom.json"
    image:
      name: "${IMAGE_NAME}-frontend"
      tag: "${IMAGE_TAG}"
  - component_name: "backend"
    output_file: "backend-build-sbom.json"
    image:
      name: "${IMAGE_NAME}-backend"
      tag: "${IMAGE_TAG}"
```

### Schedule Regular Scans

Add to workflow triggers:

```yaml
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Run daily at 2 AM UTC
  workflow_dispatch:
```

### Change Concert Toolkit Version

Update the environment variable in the workflow:

```yaml
env:
  CONCERT_TOOLKIT_VERSION: v2.1.0  # Change to desired version
```

## Testing Locally

### Test SBOM Generation

```bash
# Install Syft
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin

# Build your image
docker build -t test-image .

# Generate SBOM
syft test-image -o cyclonedx-json=concert-demo-sbom.json
```

### Test Vulnerability Scanning

```bash
# Install Grype
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin

# Scan SBOM
grype sbom:concert-demo-sbom.json
```

### Test Concert Toolkit Locally

```bash
# Pull the toolkit
docker pull icr.io/cpopen/ibm-concert-toolkit:v2.1.0

# Prepare data directory
mkdir -p toolkit-data
cp concert-demo-sbom.json toolkit-data/

# Substitute environment variables
export IMAGE_NAME="test-image"
export IMAGE_TAG="test"
export GITHUB_REPOSITORY="user/repo"
export GITHUB_SHA="abc123"
export GITHUB_REF_NAME="main"
export GITHUB_RUN_NUMBER="1"

envsubst < concert/build-config.yaml > toolkit-data/build-config.yaml
envsubst < concert/deploy-config.yaml > toolkit-data/deploy-config.yaml

# Generate build SBOM
docker run --rm \
  -v $(pwd)/toolkit-data:/toolkit-data \
  icr.io/cpopen/ibm-concert-toolkit:v2.1.0 \
  /bin/bash -c \
  "build-sbom --build-config /toolkit-data/build-config.yaml"

# Generate deploy SBOM
docker run --rm \
  -v $(pwd)/toolkit-data:/toolkit-data \
  icr.io/cpopen/ibm-concert-toolkit:v2.1.0 \
  /bin/bash -c \
  "deploy-sbom --deploy-config /toolkit-data/deploy-config.yaml"

# Check generated SBOMs
ls -lh toolkit-data/*.json
```

## Next Steps

1. **Upload SBOMs to IBM Concert** - Use Concert UI or API to upload generated SBOMs
2. **Review scan results** - Check Grype vulnerability reports regularly
3. **Update dependencies** - Keep base images and packages current
4. **Customize configurations** - Tailor build and deploy configs to your needs
5. **Integrate with deployment** - Use generated SBOMs in your deployment pipeline

## Uploading to IBM Concert

After the workflow generates SBOMs, upload them to IBM Concert:

### Using Concert UI
1. Log in to IBM Concert
2. Navigate to **SBOM Management**
3. Click **Upload SBOM**
4. Select the generated SBOM files from artifacts
5. Confirm upload

### Using Concert API
```bash
# Upload build SBOM
curl -X POST "https://your-concert-instance.com/api/v1/sbom/upload" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "sbom=@concert-build-sbom.json" \
  -F "type=build"

# Upload deploy SBOM
curl -X POST "https://your-concert-instance.com/api/v1/sbom/upload" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "sbom=@concert-deploy-sbom.json" \
  -F "type=deploy"
```

## Support

- **GitHub Actions Issues**: [GitHub Support](https://support.github.com)
- **IBM Concert Toolkit**: [IBM Concert Documentation](https://www.ibm.com/docs/concert/toolkit)
- **IBM Concert Issues**: [IBM Support](https://www.ibm.com/support)
- **Workflow Issues**: Open an issue in this repository

## Additional Resources

- [IBM Concert Documentation](https://www.ibm.com/docs/concert)
- [IBM Concert Toolkit Guide](./CONCERT_TOOLKIT_GUIDE.md)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Syft SBOM Generator](https://github.com/anchore/syft)
- [Grype Vulnerability Scanner](https://github.com/anchore/grype)
- [CycloneDX Specification](https://cyclonedx.org/)
- [Cosign Image Signing](https://github.com/sigstore/cosign)