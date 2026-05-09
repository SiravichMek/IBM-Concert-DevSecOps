# IBM Concert DevSecOps Pipeline

This repository contains a complete GitHub Actions CI/CD pipeline for automating IBM Concert SBOM (Software Bill of Materials) generation, Docker image building, signing, and CVE (Common Vulnerabilities and Exposures) scanning using the IBM Concert Toolkit.

## Features

- 🔨 **Automated Docker Image Building** - Builds container images on every push
- 📋 **SBOM Generation** - Creates CycloneDX format SBOMs using Syft
- 🔍 **Vulnerability Scanning** - Scans images for CVEs using Grype
- 🔐 **Image Signing** - Signs container images with Cosign for supply chain security
- ☁️ **IBM Concert Toolkit Integration** - Generates build and deploy SBOMs using official IBM Concert Toolkit
- 📊 **Detailed Reporting** - Generates comprehensive scan summaries and artifacts
- 🚀 **Container Registry Push** - Publishes signed images to GitHub Container Registry
- ☸️ **Kubernetes Deployment** - Optional deployment to Kubernetes clusters

## Prerequisites

Before using this workflow, you need:

1. **Dockerfile** - A valid Dockerfile in your repository root

2. **GitHub Permissions** - Ensure the workflow has necessary permissions:
   - `contents: read`
   - `packages: write`
   - `security-events: write`
   - `id-token: write` (for Cosign signing)

3. **IBM Concert Toolkit** - The workflow automatically pulls the IBM Concert Toolkit container image from IBM Container Registry (ICR)

4. **Concert Configuration Files** - Build and deploy configuration files in the `concert/` directory:
   - `concert/build-config.yaml` - Build SBOM configuration
   - `concert/deploy-config.yaml` - Deploy SBOM configuration

5. **Optional: Kubernetes Cluster** - If you want to deploy to Kubernetes, configure kubectl access

## Setup Instructions

### 1. Create a Dockerfile

If you don't have a Dockerfile, create one in your repository root:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
CMD ["node", "index.js"]
```

### 2. Configure Concert Settings

The Concert configuration files are already created in the `concert/` directory. Update them with your environment-specific values:

- Edit `concert/build-config.yaml` - Configure build SBOM settings
- Edit `concert/deploy-config.yaml` - Configure deployment SBOM settings

### 3. Enable GitHub Container Registry

Ensure GitHub Container Registry is enabled for your repository:

```
Settings → Actions → General → Workflow permissions
```

Select: "Read and write permissions"

## Workflow Triggers

The workflow runs automatically on:

- **Push** to `main` branch
- **Manual trigger** via GitHub Actions UI (workflow_dispatch)

## Workflow Steps

### 1. Checkout & Docker Login
- Checks out the repository
- Logs into GitHub Container Registry (GHCR)

### 2. Build Docker Image
- Builds the Docker image
- Tags with commit SHA

### 3. Generate SBOM with Syft
- Installs Syft SBOM generator
- Creates CycloneDX format SBOM
- Captures all dependencies and components

### 4. Vulnerability Scan with Grype
- Installs Grype vulnerability scanner
- Scans the SBOM for CVEs
- Generates detailed vulnerability report
- Optionally fails on high severity vulnerabilities

### 5. Push & Sign Image
- Pushes image to GitHub Container Registry
- Installs Cosign
- Signs the image with keyless signing (OIDC)

### 6. IBM Concert Toolkit Integration
- Pulls IBM Concert Toolkit container (v2.1.0)
- Prepares toolkit data directory
- Substitutes environment variables in config files

### 7. Generate Build SBOM
- Runs Concert Toolkit to generate build SBOM
- Includes build metadata and source information
- Outputs Concert-compatible SBOM format

### 8. Generate Deploy SBOM
- Runs Concert Toolkit to generate deployment SBOM
- Includes deployment configuration and runtime info
- Outputs Concert-compatible SBOM format

### 9. Upload Artifacts
- Uploads all generated SBOMs as artifacts
- Includes Grype vulnerability report
- Retains artifacts for 30 days

### 10. Generate Summary
- Creates GitHub Actions summary
- Lists all generated artifacts
- Shows security check status

## IBM Concert Toolkit Configuration

### Configuration Files (spec_version 1.0.2)

The workflow uses official IBM Concert Toolkit configuration format:

**Build Configuration** (`concert/build-config.yaml`):
```yaml
spec_version: "1.0.2"
concert:
  builds:
  - component_name: "concert-demo"
    output_file: "concert-build-sbom.json"
    number: "${IMAGE_TAG}"
    version: "1.0.0"
    image:
      name: "${IMAGE_NAME}"
      tag: "${IMAGE_TAG}"
      cyclonedx_bom_link:
        file: "/toolkit-data/concert-demo-sbom.json"
    repositories:
    - name: "${GITHUB_REPOSITORY}"
      url: "https://github.com/${GITHUB_REPOSITORY}"
      branch: "${GITHUB_REF_NAME}"
      commit_sha: "${GITHUB_SHA}"
```

**Deploy Configuration** (`concert/deploy-config.yaml`):
```yaml
spec_version: "1.0.2"
concert:
  deployments:
  - output_file: "concert-deploy-sbom.json"
    metadata:
      component_name: "concert-demo"
      number: "${GITHUB_RUN_NUMBER}"
      version: "1.0.0"
    environment_target: "production"
    runtime:
    - name: "kubernetes-cluster"
      type: "kubernetes"
      api-server: "https://kubernetes.default.svc"
      namespaces:
      - name: "default"
        images:
        - name: "${IMAGE_NAME}"
          tag: "${IMAGE_TAG}"
```

### Reference Samples

Complete configuration examples are available:
- `concert/build-config-sample.yaml` - All build options including library and VM configurations
- `concert/deploy-config-sample.yaml` - All deployment options including Kubernetes, VM, and zOS

## Customization

### Modify Vulnerability Thresholds

To fail the build on high severity vulnerabilities, edit the Grype scan step:

```yaml
- name: Scan CVEs
  run: |
    grype sbom:concert-demo-sbom.json -o json --file grype-report.json
    grype sbom:concert-demo-sbom.json -o table
    grype sbom:concert-demo-sbom.json --fail-on high  # Uncomment to fail on high CVEs
```

### Add Additional Branches

Update the workflow triggers:

```yaml
on:
  push:
    branches:
      - main
      - develop  # Add additional branches
      - staging
```

### Customize Concert Toolkit Version

Update the toolkit version in the workflow:

```yaml
env:
  CONCERT_TOOLKIT_VERSION: v2.1.0  # Change to desired version
```

### Add Multiple Components

Edit `concert/build-config.yaml` to add multiple components:

```yaml
concert:
  builds:
  - component_name: "frontend"
    output_file: "frontend-build-sbom.json"
    # ... configuration
  - component_name: "backend"
    output_file: "backend-build-sbom.json"
    # ... configuration
```

## Artifacts

The workflow generates and uploads the following artifacts:

- `concert-demo-sbom.json` - Syft-generated CycloneDX SBOM
- `grype-report.json` - Grype vulnerability scan results
- `concert-build-sbom.json` - IBM Concert build SBOM (spec_version 1.0.2)
- `concert-deploy-sbom.json` - IBM Concert deployment SBOM (spec_version 1.0.2)

All artifacts are retained for 30 days and can be downloaded from the Actions tab under the "concert-sboms" artifact.

## Viewing Results

### GitHub Actions Summary

After each workflow run, view the summary:

1. Go to **Actions** tab
2. Select the workflow run
3. View the **Summary** section for vulnerability breakdown

### Download Artifacts

1. Go to **Actions** tab
2. Select the workflow run
3. Scroll to **Artifacts** section
4. Download `concert-sboms` artifact
5. Extract and review:
   - `concert-demo-sbom.json` - Syft SBOM
   - `concert-build-sbom.json` - Concert build SBOM
   - `concert-deploy-sbom.json` - Concert deploy SBOM
   - `grype-report.json` - Vulnerability report

### Container Images

Published images are available at:

```
ghcr.io/<username>/<repository>:<tag>
```

Pull the image:

```bash
docker pull ghcr.io/<username>/<repository>:latest
```

## Troubleshooting

### Concert Toolkit Container Not Found

If the workflow fails to pull the toolkit:

1. Verify IBM Container Registry is accessible
2. Check toolkit version is correct: `icr.io/cpopen/ibm-concert-toolkit:v2.1.0`
3. Ensure network connectivity from GitHub Actions runners

### SBOM Generation Fails

If Syft fails to generate SBOM:

1. Ensure Docker image builds successfully
2. Check image format is supported
3. Verify Syft installation
4. Review image name and tag

### Concert Toolkit Configuration Errors

If toolkit fails to generate SBOMs:

1. Verify configuration files use `spec_version: "1.0.2"`
2. Check all required fields are present
3. Ensure environment variables are substituted correctly
4. Review toolkit logs in workflow output
5. Validate YAML syntax

### Grype Scan Fails

If vulnerability scanning fails:

1. Ensure SBOM file exists and is valid
2. Check Grype installation
3. Review scan output for specific errors
4. Verify SBOM format is CycloneDX

## Security Best Practices

1. **Never commit secrets** - Always use GitHub Secrets
2. **Review scan results** - Check vulnerability reports regularly
3. **Update dependencies** - Keep base images and packages current
4. **Enable branch protection** - Require scan success before merging
5. **Monitor artifacts** - Review SBOM and scan results periodically

## Contributing

To contribute to this workflow:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the workflow
5. Submit a pull request

## License

This workflow configuration is provided as-is for use with IBM Concert.

## Support

For issues related to:
- **GitHub Actions**: Check GitHub Actions documentation
- **IBM Concert**: Contact IBM Concert support
- **This workflow**: Open an issue in this repository

## Additional Resources

- [IBM Concert Documentation](https://www.ibm.com/docs/concert)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Syft SBOM Generator](https://github.com/anchore/syft)
- [Grype Vulnerability Scanner](https://github.com/anchore/grype)
- [CycloneDX SBOM Standard](https://cyclonedx.org/)
- [SPDX SBOM Standard](https://spdx.dev/)