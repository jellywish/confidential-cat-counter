#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install from https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Please authenticate: gh auth login" >&2
  exit 1
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Creating post-release issues in $REPO..."

# Ensure labels exist
ensure_label() {
  local name=$1; local color=$2; local desc=$3
  gh label create "$name" --color "$color" --description "$desc" 2>/dev/null || true
}

ensure_label enhancement a2eeef "New feature or request"
ensure_label security b60205 "Security-related work"
ensure_label supply-chain 0e8a16 "Software supply chain work"
ensure_label transparency fbca04 "Transparency and documentation artifacts"
ensure_label slsa 5319e7 "SLSA build provenance and hardening"
ensure_label provenance 0366d6 "Build/source provenance and attestations"
ensure_label vulnerability-management d93f0b "Vulnerability scanning and remediation"
ensure_label runtime-security 1d76db "Runtime hardening and policy enforcement"
ensure_label kubernetes 326ce5 "Kubernetes-related work"
ensure_label post-release 5319e7 "Tasks to do after public release"

create_issue() {
  local title=$1; shift
  local labels=$1; shift
  local body=$1; shift
  gh issue create --title "$title" --label "$labels" --body "$body"
}

create_issue "[SUPPLY CHAIN] Implement container signing with Cosign" \
  "enhancement,security,supply-chain,post-release" \
  $'- Use cosign with GitHub Actions to sign images\n- Document verification steps\n- Add verification to deployment guides\n\nTemplate: .github/ISSUE_TEMPLATE/post-release-enhancement.md'

create_issue "[SUPPLY CHAIN] Generate and publish Software Bill of Materials (SBOMs)" \
  "enhancement,security,supply-chain,transparency,post-release" \
  $'- Use Syft to generate SBOMs during CI\n- Attach SBOMs to releases\n- Document consumption/verification\n\nTemplate: .github/ISSUE_TEMPLATE/post-release-enhancement.md'

create_issue "[SUPPLY CHAIN] Implement SLSA build provenance attestation" \
  "enhancement,security,slsa,provenance,post-release" \
  $'- Generate build provenance attestations (SLSA)\n- Use GitHub OIDC for signing\n- Document verification procedure\n\nTemplate: .github/ISSUE_TEMPLATE/post-release-enhancement.md'

create_issue "[SUPPLY CHAIN] Advanced container vulnerability scanning and reporting" \
  "enhancement,security,vulnerability-management,post-release" \
  $'- Integrate Grype/Trivy scans\n- Publish SARIF to Security tab\n- Add alerting and thresholds\n\nTemplate: .github/ISSUE_TEMPLATE/post-release-enhancement.md'

create_issue "[SUPPLY CHAIN] Container runtime security policies and hardening" \
  "enhancement,security,runtime-security,kubernetes,post-release" \
  $'- Define runtime policies (seccomp, AppArmor)\n- NetworkPolicy examples\n- Admission controller integration\n\nTemplate: .github/ISSUE_TEMPLATE/post-release-enhancement.md'

echo "Done."



