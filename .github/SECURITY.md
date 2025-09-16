# Security Policy

## Reporting a Vulnerability

Please do not open public issues for security vulnerabilities.

- Email: security@[your-domain]
- Private advisory: https://github.com/jellywish/confidential-cat-counter/security/advisories/new

We will acknowledge receipt within 3 business days and work with you on a coordinated disclosure timeline.

## Supported Versions

We support the latest minor release line. Security fixes are backported on a best-effort basis.

## General Guidance

- No secrets in code or logs
- Strict input validation and fail-closed behavior
- CSP and CORS locked down by default
- Dependencies scanned regularly via Dependabot and CodeQL

