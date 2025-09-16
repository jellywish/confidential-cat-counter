# Docker Attestation Patterns: Reproducible Builds & PCR Management

**Source**: Docker Buildx Attestation + Nitro Enclaves PCR Requirements  
**Date**: January 2025  
**Purpose**: Proven patterns for reproducible Docker builds and attestation for Nitro Enclaves

---

## Executive Summary

**Key Insight**: Reproducible Docker builds are critical for consistent PCR measurements in Nitro Enclaves. Attestation ensures supply chain security and enables automated deployment with known-good PCR values.

**Critical Patterns for CCC Project:**
1. **Reproducible builds**: Consistent PCR measurements across environments
2. **Build attestation**: Verifiable build provenance and integrity
3. **Supply chain security**: Software Bill of Materials (SBOM) generation
4. **Automated PCR extraction**: Build-time PCR measurement capture

---

## Reproducible Build Patterns

### **Pattern 1: Deterministic Dockerfile**

**Problem**: Non-deterministic builds produce different PCR values  
**Solution**: Pin all versions and timestamps for reproducible builds

```dockerfile
# Dockerfile.reproducible - Deterministic enclave builds
FROM public.ecr.aws/amazonlinux/amazonlinux:2023.3.20240108.0

# Pin exact package versions for reproducibility
RUN yum update -y && yum install -y \
    python3-3.9.16-1.amzn2023.0.5 \
    python3-pip-21.3.1-2.amzn2023.0.7 \
    python3-devel-3.9.16-1.amzn2023.0.5 \
    gcc-11.4.1-2.amzn2023.0.2 \
    && yum clean all \
    && rm -rf /var/cache/yum

# Set fixed timestamp for reproducible builds
ENV SOURCE_DATE_EPOCH=1640995200
ENV TZ=UTC

# Create non-root user with fixed UID/GID
RUN groupadd -g 1000 enclave && \
    useradd -u 1000 -g 1000 -m -s /bin/bash enclave

# Set consistent file permissions and ownership
WORKDIR /app
COPY --chown=1000:1000 requirements.lock ./

# Install exact dependency versions
RUN pip install --no-cache-dir \
    --index-url https://pypi.org/simple/ \
    --requirement requirements.lock

# Copy application code with consistent ownership
COPY --chown=1000:1000 src/ ./src/
COPY --chown=1000:1000 scripts/ ./scripts/

# Set consistent permissions
RUN chmod 755 scripts/*.sh && \
    chmod 644 src/*.py

# Switch to non-root user
USER 1000:1000

# Fixed entrypoint
ENTRYPOINT ["python3", "src/main.py"]

# Metadata for attestation
LABEL org.opencontainers.image.title="CCC Enclave"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.description="Confidential Cat Counter Enclave"
LABEL org.opencontainers.image.source="https://github.com/spencer/ccc"
LABEL org.opencontainers.image.revision="COMMIT_SHA_PLACEHOLDER"
LABEL build.timestamp="${SOURCE_DATE_EPOCH}"
```

### **Pattern 2: Requirements Lock File Generation**

**Problem**: Floating dependency versions break reproducibility  
**Solution**: Generate and use lock files with exact versions

```bash
#!/bin/bash
# generate-requirements-lock.sh
set -e

echo "Generating requirements lock file..."

# Create temporary virtual environment
python3 -m venv temp_venv
source temp_venv/bin/activate

# Install from requirements.txt (with version ranges)
pip install --upgrade pip
pip install -r requirements.txt

# Generate lock file with exact versions
pip freeze > requirements.lock

# Add additional metadata to lock file
cat >> requirements.lock << EOF
# Generated on: $(date -u)
# Python version: $(python3 --version)
# Platform: $(uname -a)
# Build environment: amazonlinux:2023
EOF

# Cleanup
deactivate
rm -rf temp_venv

echo "Requirements lock file generated: requirements.lock"
```

```bash
# Example requirements.lock output
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.2
numpy==1.24.3
torch==2.1.2
torchvision==0.16.2
Pillow==10.1.0
boto3==1.34.34
# Generated on: 2025-01-15 10:30:00 UTC
# Python version: Python 3.9.16
# Platform: Linux x86_64
# Build environment: amazonlinux:2023
```

### **Pattern 3: Reproducible Build Script**

**Problem**: Build environment differences affect reproducibility  
**Solution**: Controlled build environment with fixed parameters

```bash
#!/bin/bash
# build-reproducible.sh
set -e

VERSION=${1:-"latest"}
COMMIT_SHA=${2:-$(git rev-parse HEAD)}

echo "Building reproducible enclave image v$VERSION"

# Set reproducible build environment
export DOCKER_BUILDKIT=1
export SOURCE_DATE_EPOCH=1640995200
export BUILDKIT_PROGRESS=plain

# Ensure clean build context
docker system prune -f

# Substitute commit SHA in Dockerfile
sed "s/COMMIT_SHA_PLACEHOLDER/$COMMIT_SHA/g" Dockerfile.reproducible > Dockerfile.build

# Build with consistent parameters
docker build \
    --build-arg SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --build-arg BUILD_DATE=$(date -u -d "@$SOURCE_DATE_EPOCH" +%Y-%m-%dT%H:%M:%SZ) \
    --platform linux/x86_64 \
    --progress plain \
    --tag ccc-enclave:$VERSION \
    --file Dockerfile.build \
    .

# Generate EIF file
echo "Building Enclave Image File (EIF)..."
nitro-cli build-enclave \
    --docker-uri ccc-enclave:$VERSION \
    --output-file ccc-enclave-$VERSION.eif

# Extract PCR measurements
echo "Extracting PCR measurements..."
nitro-cli describe-eif \
    --eif-path ccc-enclave-$VERSION.eif \
    --output-format json > pcr-measurements-$VERSION.json

# Generate build manifest
echo "Generating build manifest..."
cat > build-manifest-$VERSION.json << EOF
{
  "version": "$VERSION",
  "commit_sha": "$COMMIT_SHA",
  "build_timestamp": "$(date -u -d "@$SOURCE_DATE_EPOCH" +%Y-%m-%dT%H:%M:%SZ)",
  "source_date_epoch": $SOURCE_DATE_EPOCH,
  "builder": {
    "docker_version": "$(docker --version)",
    "nitro_cli_version": "$(nitro-cli --version)",
    "build_platform": "$(uname -m)",
    "host_os": "$(uname -s)"
  },
  "files": {
    "eif": "ccc-enclave-$VERSION.eif",
    "pcr_measurements": "pcr-measurements-$VERSION.json",
    "dockerfile": "Dockerfile.reproducible",
    "requirements_lock": "requirements.lock"
  }
}
EOF

# Verify reproducibility by building twice
echo "Verifying build reproducibility..."
docker build \
    --build-arg SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH \
    --platform linux/x86_64 \
    --tag ccc-enclave:$VERSION-verify \
    --file Dockerfile.build \
    .

# Compare image digests
DIGEST1=$(docker inspect ccc-enclave:$VERSION --format='{{.Id}}')
DIGEST2=$(docker inspect ccc-enclave:$VERSION-verify --format='{{.Id}}')

if [ "$DIGEST1" = "$DIGEST2" ]; then
    echo "✅ Build is reproducible - identical digests"
else
    echo "❌ Build is NOT reproducible - different digests"
    echo "Original:  $DIGEST1"
    echo "Verify:    $DIGEST2"
    exit 1
fi

# Cleanup
rm Dockerfile.build
docker image rm ccc-enclave:$VERSION-verify

echo "✅ Reproducible build complete:"
echo "  EIF: ccc-enclave-$VERSION.eif"
echo "  PCR: pcr-measurements-$VERSION.json"
echo "  Manifest: build-manifest-$VERSION.json"
```

---

## Build Attestation Patterns

### **Pattern 4: Docker Buildx Attestation**

**Problem**: Need verifiable proof of build process and contents  
**Solution**: Generate signed attestations during build

```bash
#!/bin/bash
# build-with-attestation.sh
set -e

VERSION=${1:-"latest"}
REGISTRY=${2:-"your-registry.com"}

echo "Building with attestation for version $VERSION"

# Build with attestation generation
docker buildx build \
    --platform linux/x86_64 \
    --tag $REGISTRY/ccc-enclave:$VERSION \
    --file Dockerfile.reproducible \
    --attestation type=provenance,mode=max \
    --attestation type=sbom,mode=max \
    --metadata-file build-metadata.json \
    --push \
    .

# Extract attestation information
echo "Extracting attestation data..."
docker buildx imagetools inspect $REGISTRY/ccc-enclave:$VERSION \
    --format '{{json .}}' > image-manifest.json

# Generate custom attestation for Nitro Enclave
cat > enclave-attestation.json << EOF
{
  "predicateType": "https://github.com/spencer/ccc/enclave-build/v1",
  "subject": [
    {
      "name": "$REGISTRY/ccc-enclave:$VERSION",
      "digest": {
        "sha256": "$(docker inspect $REGISTRY/ccc-enclave:$VERSION --format='{{.Id}}' | cut -d: -f2)"
      }
    }
  ],
  "predicate": {
    "buildType": "nitro-enclave",
    "builder": {
      "id": "docker-buildx",
      "version": "$(docker buildx version)"
    },
    "invocation": {
      "configSource": {
        "uri": "git+https://github.com/spencer/ccc.git",
        "digest": {
          "sha1": "$(git rev-parse HEAD)"
        }
      }
    },
    "buildConfig": {
      "source_date_epoch": $SOURCE_DATE_EPOCH,
      "platform": "linux/x86_64",
      "reproducible": true
    },
    "materials": [
      {
        "uri": "Dockerfile.reproducible",
        "digest": {
          "sha256": "$(sha256sum Dockerfile.reproducible | cut -d' ' -f1)"
        }
      },
      {
        "uri": "requirements.lock",
        "digest": {
          "sha256": "$(sha256sum requirements.lock | cut -d' ' -f1)"
        }
      }
    ],
    "metadata": {
      "completeness": {
        "parameters": true,
        "environment": true,
        "materials": true
      },
      "reproducible": true
    }
  }
}
EOF

echo "✅ Build with attestation complete"
```

### **Pattern 5: Software Bill of Materials (SBOM) Generation**

**Problem**: Need inventory of all components for security scanning  
**Solution**: Generate comprehensive SBOM during build

```bash
#!/bin/bash
# generate-sbom.sh
set -e

IMAGE_NAME=$1
VERSION=$2

echo "Generating SBOM for $IMAGE_NAME:$VERSION"

# Generate SBOM using Syft
syft $IMAGE_NAME:$VERSION -o spdx-json > sbom-$VERSION.spdx.json
syft $IMAGE_NAME:$VERSION -o cyclonedx-json > sbom-$VERSION.cyclonedx.json

# Generate custom enclave SBOM with Nitro-specific information
cat > enclave-sbom-$VERSION.json << EOF
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.4",
  "serialNumber": "urn:uuid:$(uuidgen)",
  "version": 1,
  "metadata": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "tools": [
      {
        "vendor": "CCC Project",
        "name": "Enclave SBOM Generator",
        "version": "1.0.0"
      }
    ],
    "component": {
      "type": "container",
      "name": "ccc-enclave",
      "version": "$VERSION",
      "description": "Confidential Cat Counter Enclave for AWS Nitro"
    }
  },
  "components": [
EOF

# Extract Python packages and add to SBOM
docker run --rm $IMAGE_NAME:$VERSION pip list --format=json | jq -r '.[] | 
{
  "type": "library",
  "name": .name,
  "version": .version,
  "purl": "pkg:pypi/\(.name)@\(.version)",
  "scope": "required"
}' | jq -s '.' | sed '1d; $d' >> enclave-sbom-$VERSION.json

# Add base image information
cat >> enclave-sbom-$VERSION.json << EOF
    {
      "type": "operating-system",
      "name": "amazonlinux",
      "version": "2023",
      "description": "Amazon Linux base image",
      "scope": "required"
    },
    {
      "type": "application",
      "name": "nitro-enclave-runtime",
      "version": "unknown",
      "description": "AWS Nitro Enclave runtime environment",
      "scope": "required"
    }
  ]
}
EOF

echo "✅ SBOM generation complete:"
echo "  SPDX: sbom-$VERSION.spdx.json"
echo "  CycloneDX: sbom-$VERSION.cyclonedx.json"
echo "  Enclave: enclave-sbom-$VERSION.json"
```

---

## PCR Management Patterns

### **Pattern 6: Automated PCR Extraction**

**Problem**: Manual PCR extraction is error-prone  
**Solution**: Automated PCR extraction with validation

```bash
#!/bin/bash
# extract-pcr-measurements.sh
set -e

EIF_FILE=$1
VERSION=$2

echo "Extracting PCR measurements from $EIF_FILE"

# Extract PCR measurements
nitro-cli describe-eif --eif-path $EIF_FILE --output-format json > raw-pcr-$VERSION.json

# Parse and format PCR measurements
jq '{
  "version": "'$VERSION'",
  "eif_file": "'$EIF_FILE'",
  "build_timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "measurements": {
    "PCR0": .Measurements.PCR0,
    "PCR1": .Measurements.PCR1,
    "PCR2": .Measurements.PCR2
  },
  "metadata": {
    "image_sha384": .Measurements.PCR0,
    "kernel_cmdline": .Measurements.PCR1,
    "application": .Measurements.PCR2,
    "eif_info": {
      "build_time": .BuildTime,
      "built_at": .BuiltAt
    }
  }
}' raw-pcr-$VERSION.json > pcr-measurements-$VERSION.json

# Generate KMS policy template
cat > kms-policy-template-$VERSION.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EnableEnclaveDecryption",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT_ID:role/ENCLAVE_ROLE"
      },
      "Action": "kms:Decrypt",
      "Resource": "*",
      "Condition": {
        "StringEqualsIgnoreCase": {
          "kms:RecipientAttestation:ImageSha384": "$(jq -r '.measurements.PCR0' pcr-measurements-$VERSION.json)",
          "kms:RecipientAttestation:PCR1": "$(jq -r '.measurements.PCR1' pcr-measurements-$VERSION.json)",
          "kms:RecipientAttestation:PCR2": "$(jq -r '.measurements.PCR2' pcr-measurements-$VERSION.json)"
        }
      }
    }
  ]
}
EOF

# Validate PCR measurements
echo "Validating PCR measurements..."
PCR0=$(jq -r '.measurements.PCR0' pcr-measurements-$VERSION.json)
PCR1=$(jq -r '.measurements.PCR1' pcr-measurements-$VERSION.json)
PCR2=$(jq -r '.measurements.PCR2' pcr-measurements-$VERSION.json)

if [[ ${#PCR0} -eq 96 ]] && [[ ${#PCR1} -eq 96 ]] && [[ ${#PCR2} -eq 96 ]]; then
    echo "✅ PCR measurements are valid (96 hex characters each)"
else
    echo "❌ Invalid PCR measurements:"
    echo "  PCR0 length: ${#PCR0} (expected 96)"
    echo "  PCR1 length: ${#PCR1} (expected 96)"
    echo "  PCR2 length: ${#PCR2} (expected 96)"
    exit 1
fi

# Cleanup
rm raw-pcr-$VERSION.json

echo "✅ PCR extraction complete:"
echo "  Measurements: pcr-measurements-$VERSION.json"
echo "  KMS Policy: kms-policy-template-$VERSION.json"
echo ""
echo "PCR Values:"
echo "  PCR0 (Image): $PCR0"
echo "  PCR1 (Kernel): $PCR1"
echo "  PCR2 (App): $PCR2"
```

### **Pattern 7: PCR Validation Across Environments**

**Problem**: PCR values must be consistent across dev/staging/production  
**Solution**: Environment-specific PCR validation

```bash
#!/bin/bash
# validate-pcr-consistency.sh
set -e

VERSION=$1
ENVIRONMENTS=("development" "staging" "production")

echo "Validating PCR consistency across environments for version $VERSION"

# Store expected PCRs
EXPECTED_PCR_FILE="expected-pcrs-$VERSION.json"

if [ ! -f "$EXPECTED_PCR_FILE" ]; then
    echo "Creating expected PCR baseline from current build..."
    cp pcr-measurements-$VERSION.json $EXPECTED_PCR_FILE
fi

# Validate against expected values
EXPECTED_PCR0=$(jq -r '.measurements.PCR0' $EXPECTED_PCR_FILE)
EXPECTED_PCR1=$(jq -r '.measurements.PCR1' $EXPECTED_PCR_FILE)
EXPECTED_PCR2=$(jq -r '.measurements.PCR2' $EXPECTED_PCR_FILE)

CURRENT_PCR0=$(jq -r '.measurements.PCR0' pcr-measurements-$VERSION.json)
CURRENT_PCR1=$(jq -r '.measurements.PCR1' pcr-measurements-$VERSION.json)
CURRENT_PCR2=$(jq -r '.measurements.PCR2' pcr-measurements-$VERSION.json)

echo "Comparing PCR values:"
echo "                Expected                                                                    Current"
echo "PCR0 (Image):   $EXPECTED_PCR0"
echo "                $CURRENT_PCR0"

if [ "$EXPECTED_PCR0" = "$CURRENT_PCR0" ]; then
    echo "✅ PCR0 matches"
else
    echo "❌ PCR0 mismatch!"
    exit 1
fi

echo "PCR1 (Kernel):  $EXPECTED_PCR1"
echo "                $CURRENT_PCR1"

if [ "$EXPECTED_PCR1" = "$CURRENT_PCR1" ]; then
    echo "✅ PCR1 matches"
else
    echo "❌ PCR1 mismatch!"
    exit 1
fi

echo "PCR2 (App):     $EXPECTED_PCR2"
echo "                $CURRENT_PCR2"

if [ "$EXPECTED_PCR2" = "$CURRENT_PCR2" ]; then
    echo "✅ PCR2 matches"
else
    echo "❌ PCR2 mismatch!"
    exit 1
fi

echo "✅ All PCR values match expected baseline"
```

---

## Security & Compliance Patterns

### **Pattern 8: Container Image Signing**

**Problem**: Need to verify image integrity and authenticity  
**Solution**: Sign images and verify signatures before deployment

```bash
#!/bin/bash
# sign-container-image.sh
set -e

IMAGE=$1
VERSION=$2
PRIVATE_KEY=${3:-"signing-key.pem"}

echo "Signing container image $IMAGE:$VERSION"

# Sign the image using cosign
cosign sign --key $PRIVATE_KEY $IMAGE:$VERSION

# Generate signature metadata
cat > signature-metadata-$VERSION.json << EOF
{
  "image": "$IMAGE:$VERSION",
  "signature_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "signer": "CCC Project Build System",
  "key_fingerprint": "$(openssl rsa -in $PRIVATE_KEY -pubout | openssl dgst -sha256)",
  "verification_command": "cosign verify --key signing-key.pub $IMAGE:$VERSION"
}
EOF

echo "✅ Image signed successfully"
echo "  Signature metadata: signature-metadata-$VERSION.json"
```

### **Pattern 9: Vulnerability Scanning Integration**

**Problem**: Need to scan for vulnerabilities before deployment  
**Solution**: Integrate scanning into build pipeline

```bash
#!/bin/bash
# scan-vulnerabilities.sh
set -e

IMAGE=$1
VERSION=$2
SEVERITY_THRESHOLD=${3:-"HIGH"}

echo "Scanning $IMAGE:$VERSION for vulnerabilities"

# Scan with Trivy
trivy image --format json --output vulnerability-report-$VERSION.json $IMAGE:$VERSION

# Check for high/critical vulnerabilities
HIGH_VULNS=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL")] | length' vulnerability-report-$VERSION.json)

if [ "$HIGH_VULNS" -gt 0 ]; then
    echo "❌ Found $HIGH_VULNS high/critical vulnerabilities"
    echo "Vulnerability summary:"
    jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH" or .Severity == "CRITICAL") | "  \(.VulnerabilityID): \(.Severity) - \(.Title)"' vulnerability-report-$VERSION.json
    
    if [ "$SEVERITY_THRESHOLD" = "HIGH" ]; then
        echo "Build failed due to high/critical vulnerabilities"
        exit 1
    fi
else
    echo "✅ No high/critical vulnerabilities found"
fi

# Generate vulnerability attestation
cat > vulnerability-attestation-$VERSION.json << EOF
{
  "scan_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "scanner": "trivy",
  "image": "$IMAGE:$VERSION",
  "summary": {
    "total_vulnerabilities": $(jq '[.Results[]?.Vulnerabilities[]?] | length' vulnerability-report-$VERSION.json),
    "critical": $(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' vulnerability-report-$VERSION.json),
    "high": $(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH")] | length' vulnerability-report-$VERSION.json),
    "medium": $(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "MEDIUM")] | length' vulnerability-report-$VERSION.json),
    "low": $(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "LOW")] | length' vulnerability-report-$VERSION.json)
  },
  "passed_threshold": true,
  "threshold": "$SEVERITY_THRESHOLD"
}
EOF

echo "✅ Vulnerability scan complete"
echo "  Report: vulnerability-report-$VERSION.json"
echo "  Attestation: vulnerability-attestation-$VERSION.json"
```

---

## CI/CD Integration Patterns

### **Pattern 10: Complete Release Pipeline**

**Problem**: Need automated pipeline for reproducible releases  
**Solution**: End-to-end pipeline with attestation

```yaml
# .github/workflows/build-release.yml
name: Build and Release Enclave

on:
  push:
    tags: ['v*']

jobs:
  build-and-attest:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
      
    - name: Install Nitro CLI
      run: |
        curl -O https://github.com/aws/aws-nitro-enclaves-cli/releases/download/v1.2.2/aws-nitro-enclaves-cli-1.2.2.x86_64.rpm
        sudo apt-get update && sudo apt-get install -y alien
        sudo alien -i aws-nitro-enclaves-cli-1.2.2.x86_64.rpm
        
    - name: Install attestation tools
      run: |
        # Install cosign
        go install github.com/sigstore/cosign/cmd/cosign@latest
        # Install syft for SBOM generation
        curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
        # Install trivy for vulnerability scanning
        sudo apt-get install wget apt-transport-https gnupg lsb-release
        wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
        echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
        sudo apt-get update && sudo apt-get install trivy
        
    - name: Generate requirements lock
      run: ./scripts/generate-requirements-lock.sh
      
    - name: Build reproducible image
      env:
        VERSION: ${{ github.ref_name }}
        COMMIT_SHA: ${{ github.sha }}
      run: ./scripts/build-reproducible.sh $VERSION $COMMIT_SHA
      
    - name: Generate SBOM
      env:
        VERSION: ${{ github.ref_name }}
      run: ./scripts/generate-sbom.sh ccc-enclave $VERSION
      
    - name: Scan for vulnerabilities
      env:
        VERSION: ${{ github.ref_name }}
      run: ./scripts/scan-vulnerabilities.sh ccc-enclave $VERSION
      
    - name: Extract PCR measurements
      env:
        VERSION: ${{ github.ref_name }}
      run: ./scripts/extract-pcr-measurements.sh ccc-enclave-$VERSION.eif $VERSION
      
    - name: Sign container image
      env:
        VERSION: ${{ github.ref_name }}
        COSIGN_PRIVATE_KEY: ${{ secrets.COSIGN_PRIVATE_KEY }}
      run: ./scripts/sign-container-image.sh ccc-enclave $VERSION
      
    - name: Create release artifacts
      env:
        VERSION: ${{ github.ref_name }}
      run: |
        mkdir release-$VERSION
        cp ccc-enclave-$VERSION.eif release-$VERSION/
        cp pcr-measurements-$VERSION.json release-$VERSION/
        cp kms-policy-template-$VERSION.json release-$VERSION/
        cp build-manifest-$VERSION.json release-$VERSION/
        cp sbom-$VERSION.*.json release-$VERSION/
        cp vulnerability-*.json release-$VERSION/
        cp signature-metadata-$VERSION.json release-$VERSION/
        
        # Create deployment guide
        cat > release-$VERSION/DEPLOYMENT.md << EOF
        # CCC Enclave Deployment Guide v$VERSION
        
        ## PCR Measurements
        - PCR0: \$(jq -r '.measurements.PCR0' pcr-measurements-$VERSION.json)
        - PCR1: \$(jq -r '.measurements.PCR1' pcr-measurements-$VERSION.json)  
        - PCR2: \$(jq -r '.measurements.PCR2' pcr-measurements-$VERSION.json)
        
        ## Quick Deployment
        \`\`\`bash
        # Configure KMS policy
        aws kms put-key-policy --key-id \$KMS_KEY_ID --policy file://kms-policy-template-$VERSION.json
        
        # Deploy enclave
        nitro-cli run-enclave --eif-path ccc-enclave-$VERSION.eif --memory 1024 --cpu-count 2
        \`\`\`
        
        ## Verification
        \`\`\`bash
        # Verify image signature
        cosign verify --key signing-key.pub ccc-enclave:$VERSION
        
        # Verify PCR measurements
        nitro-cli describe-eif --eif-path ccc-enclave-$VERSION.eif
        \`\`\`
        EOF
        
    - name: Upload release artifacts
      uses: actions/upload-artifact@v4
      with:
        name: ccc-enclave-${{ github.ref_name }}
        path: release-${{ github.ref_name }}/
        
    - name: Create GitHub Release
      uses: softprops/action-gh-release@v1
      with:
        files: release-${{ github.ref_name }}/*
        body_path: release-${{ github.ref_name }}/DEPLOYMENT.md
```

---

## Integration Checklist for CCC Project

### **Phase 1 Implementation (Local Development):**
- [ ] Create reproducible Dockerfile with pinned versions
- [ ] Generate requirements lock file
- [ ] Set up basic reproducible build script
- [ ] Add PCR extraction automation

### **Phase 2 Enhancements (Attestation):**
- [ ] Add Docker buildx attestation
- [ ] Generate SBOM for supply chain security
- [ ] Implement container image signing
- [ ] Add vulnerability scanning

### **Phase 3 Production (Full Pipeline):**
- [ ] Create complete CI/CD pipeline
- [ ] Add PCR validation across environments
- [ ] Implement release artifact generation
- [ ] Add deployment automation

### **Key Files to Create:**
1. `Dockerfile.reproducible` - Deterministic enclave builds
2. `scripts/build-reproducible.sh` - Reproducible build automation
3. `scripts/extract-pcr-measurements.sh` - PCR extraction
4. `scripts/generate-sbom.sh` - Software Bill of Materials
5. `.github/workflows/build-release.yml` - CI/CD pipeline

---

## Expected Outcomes

### **Reproducible Build Results:**
- **Consistent PCR measurements** across all environments
- **Identical Docker image digests** for same source code
- **Deterministic EIF files** for enclave deployment
- **Verifiable build provenance** through attestation

### **Security Benefits:**
- **Supply chain security** through SBOM generation
- **Vulnerability management** through automated scanning  
- **Image integrity** through digital signatures
- **Deployment confidence** through PCR validation

### **Operational Benefits:**
- **Automated PCR extraction** eliminates manual errors
- **Template KMS policies** reduce deployment complexity
- **Release artifacts** provide complete deployment packages
- **Documentation generation** ensures consistent deployment

---

## References

**Docker Documentation:**
- [Docker Buildx Attestation](https://docs.docker.com/buildx/working-with-buildx/#attestations)
- [Docker Content Trust](https://docs.docker.com/engine/security/trust/)
- [Reproducible Builds](https://reproducible-builds.org/)

**AWS Nitro Enclaves:**
- [Nitro CLI Reference](https://docs.aws.amazon.com/enclaves/latest/user/nitro-cli.html)
- [PCR Measurements](https://docs.aws.amazon.com/enclaves/latest/user/set-up-attestation.html)

**Security Tools:**
- [Cosign](https://github.com/sigstore/cosign) - Container signing
- [Syft](https://github.com/anchore/syft) - SBOM generation  
- [Trivy](https://github.com/aquasecurity/trivy) - Vulnerability scanning
