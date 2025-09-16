# Testing Guide

This guide covers testing strategies, tools, and procedures for the Confidential Cat Counter reference architecture.

## Overview

The testing strategy focuses on **free, open-source tools** suitable for single developers and reference architectures:

- ✅ **Unit Tests**: Jest for JavaScript, pytest for Python
- ✅ **Integration Tests**: End-to-end workflow validation
- ✅ **Security Scanning**: CodeQL, npm audit, safety (all free)
- ✅ **CI/CD**: GitHub Actions (2000 minutes/month free)

## Quick Start

### Run All Tests
```bash
# Use the unified test runner
./scripts/test.sh --all --verbose

# Or run specific test types
./scripts/test.sh --unit           # Unit tests only
./scripts/test.sh --integration    # Integration tests only
./scripts/test.sh --security       # Security scans only
```

### Manual Testing
```bash
# Web client tests
cd src/web-client
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Test Types

### Unit Tests

**Location**: `tests/unit/`

**Crypto Operations** (`crypto.test.js`):
- Base64 chunking validation
- Encryption context sanitization
- Error handling (fail-closed behavior)
- Boundary testing for large arrays

**API Endpoints** (`api.test.js`):
- Rate limiting enforcement
- File upload validation
- Error code consistency
- Security header verification

### Integration Tests

**Location**: `tests/integration/`

**Encryption Flow** (`encryption-flow.test.js`):
- End-to-end encryption pipeline
- Browser → ML service communication
- Redis job queue validation
- Error scenario handling

**Docker Deployment** (`docker-deployment.test.js`):
- Container build validation
- Health check verification
- Multi-platform support
- Resource constraint testing

### Security Testing

**Free Security Tools**:

1. **CodeQL** (GitHub Security Scanning)
   - Static analysis for JavaScript and Python
   - Automated vulnerability detection
   - SARIF report generation

2. **npm audit** (Built-in)
   ```bash
   cd src/web-client
   npm audit --audit-level=moderate
   ```

3. **Python safety** (Free tier)
   ```bash
   cd src/ml-service
   pip install safety
   safety check --short-report
   ```

4. **Dependabot** (Automated updates)
   - Weekly dependency scanning
   - Automatic security update PRs
   - License compliance monitoring

## CI/CD Pipeline

### GitHub Actions Workflows

**Main Test Pipeline** (`.github/workflows/test.yml`):
- Multi-platform testing (Linux, macOS, Windows)
- Node.js 18/20 and Python 3.9/3.11 matrix
- Docker container validation
- Integration test execution

**Security Pipeline** (`.github/workflows/security.yml`):
- CodeQL security analysis
- Container vulnerability scanning
- Secret detection with TruffleHog
- License compliance checking

### Cost-Effective Strategy

**Free Tier Limits**:
- GitHub Actions: 2000 minutes/month
- CodeQL: Unlimited for public repos
- Dependabot: Free for all repos

**Optimization Tips**:
- Use matrix exclusions to reduce redundant builds
- Cache dependencies aggressively
- Fail fast on critical issues
- Group similar dependency updates

## Local Development

### Pre-commit Testing
```bash
# Quick validation before committing
npm run lint
npm run format:check
npm run test:unit

# Full local testing
./scripts/test.sh --all
```

### Test Development

**Writing Unit Tests**:
```javascript
describe('Feature Name', () => {
  test('should handle normal case', () => {
    // Arrange
    const input = 'test input';
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe('expected output');
  });
  
  test('should handle error case', () => {
    expect(() => {
      functionUnderTest(null);
    }).toThrow('Expected error message');
  });
});
```

**Integration Test Pattern**:
```javascript
describe('End-to-End Feature', () => {
  beforeAll(async () => {
    // Setup test environment
    await startTestServices();
  });
  
  afterAll(async () => {
    // Cleanup
    await stopTestServices();
  });
  
  test('should complete full workflow', async () => {
    // Test complete user journey
  });
});
```

## Performance Testing

### Resource Usage Testing
```bash
# Monitor during tests
docker stats

# Memory usage validation
docker run --memory=256m test-image
```

### Confidentiality Testing

**Property-based Testing**:
- Verify no sensitive data leakage
- Validate encryption context filtering
- Test fail-closed behavior

```javascript
test('should never leak sensitive data', () => {
  const sensitiveData = 'user@email.com';
  const context = validateEncryptionContext({
    user_email: sensitiveData // Should be filtered
  });
  
  expect(JSON.stringify(context)).not.toContain(sensitiveData);
});
```

## Troubleshooting

### Common Issues

**Docker Tests Failing**:
```bash
# Check Docker availability
docker --version

# Clean up test containers
docker ps -a | grep test- | awk '{print $1}' | xargs docker rm -f
```

**Redis Connection Issues**:
```bash
# Start Redis for testing
docker run -d --name test-redis -p 6380:6379 redis:7-alpine

# Test connection
redis-cli -p 6380 ping
```

**Jest Memory Issues**:
```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

### Debug Mode

**Verbose Testing**:
```bash
# Detailed output
./scripts/test.sh --all --verbose

# Jest debug mode
npm test -- --verbose --detectOpenHandles
```

**Container Debugging**:
```bash
# Debug container startup
docker run -it test-image /bin/bash

# Check logs
docker logs container-name
```

## Best Practices

### Test Organization
- Keep tests close to code they test
- Use descriptive test names
- Test behavior, not implementation
- Include both happy path and error cases

### Security Testing
- Never commit real secrets to tests
- Use environment variables for test configuration
- Validate all input sanitization
- Test fail-closed behavior

### Performance
- Set appropriate timeouts
- Clean up resources in tests
- Use test doubles for expensive operations
- Monitor CI/CD usage to stay within free limits

### Maintenance
- Update dependencies regularly via Dependabot
- Review security scan results weekly
- Keep test documentation current
- Archive obsolete tests

## Reference

### Tool Documentation
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [GitHub Actions](https://docs.github.com/en/actions)
- [CodeQL](https://codeql.github.com/)
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Python safety](https://github.com/pyupio/safety)

### Project-Specific
- [Security Policy](../../reference/PRIVACY_POLICY.md)
- [Installation Guide](../installation/quick-start.md)
- [Troubleshooting](../troubleshooting/common-issues.md)
