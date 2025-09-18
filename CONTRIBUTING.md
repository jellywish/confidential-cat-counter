# Contributing to Confidential Cat Counter

Thank you for your interest in contributing to the Confidential Cat Counter! This document provides guidelines for contributing to this privacy-preserving ML reference architecture.

## Quick Start for Contributors

```bash
# 1. Fork and clone
git clone https://github.com/jellywish/confidential-cat-counter.git
cd confidential-cat-counter

# 2. Set up development environment
./setup.sh --dev

# 3. Run tests
./scripts/test.sh --all

# 4. Make changes and test
# ... your changes ...
./scripts/test.sh --unit
```

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Code Style and Standards](#code-style-and-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Security Considerations](#security-considerations)

## Development Environment Setup

### Prerequisites

- **Docker** 20.10+ with Docker Compose
- **Node.js** 18+ or 20+
- **Python** 3.9+ or 3.11+
- **Git** for version control

### Local Development

```bash
# Clone and set up
git clone https://github.com/jellywish/confidential-cat-counter.git
cd confidential-cat-counter

# Install dependencies
cd src/web-client && npm install
cd ../ml-service && pip install -r requirements.txt

# Start development services
./setup.sh --dev

# Verify setup
curl http://localhost:3000/health
curl http://localhost:8000/health
```

See [Local Development Guide](docs/how-to/deployment/local-development.md) for detailed setup instructions.

## Code Style and Standards

### JavaScript/Node.js

**Linting and Formatting:**
```bash
cd src/web-client

# Check code style
npm run lint
npm run format:check

# Auto-fix issues
npm run lint:fix
npm run format
```

**Standards:**
- **ESLint**: Airbnb configuration with security plugins
- **Prettier**: 2-space indentation, single quotes, trailing commas
- **JSDoc**: Document all public functions and classes
- **Error Handling**: Always use try-catch for async operations
- **Security**: No `eval()`, `innerHTML`, or other dangerous patterns

**Example:**
```javascript
/**
 * Validates an image file using magic byte detection
 * @param {string} filePath - Path to the image file
 * @param {string} mimeType - Claimed MIME type
 * @returns {Promise<ValidationResult>} Validation result with detected type
 * @throws {ValidationError} When file cannot be read
 */
async function validateImageFile(filePath, mimeType) {
  try {
    const buffer = await fs.readFile(filePath);
    const detectedType = detectImageType(buffer);
    
    return {
      isValid: detectedType !== null,
      detectedType,
      claimedType: mimeType,
      securityFlags: []
    };
  } catch (error) {
    throw new ValidationError(`Cannot read file: ${error.message}`);
  }
}
```

### Python

**Linting and Formatting:**
```bash
cd src/ml-service

# Check code style
black --check .
flake8 .

# Auto-fix formatting
black .
```

**Standards:**
- **Black**: Code formatting with 88-character line length
- **Flake8**: Linting with security and complexity checks
- **Type Hints**: Use type annotations for all function signatures
- **Docstrings**: Google-style docstrings for all public functions
- **Error Handling**: Specific exception types, not bare `except:`

**Example:**
```python
def preprocess_image(image_path: str, target_size: Tuple[int, int] = (640, 640)) -> np.ndarray:
    """Preprocess image for YOLO model inference.
    
    Args:
        image_path: Path to the input image file
        target_size: Target dimensions for model input (width, height)
        
    Returns:
        Preprocessed image array ready for model inference
        
    Raises:
        ImageProcessingError: When image cannot be processed
        ValueError: When target_size is invalid
    """
    if target_size[0] <= 0 or target_size[1] <= 0:
        raise ValueError(f"Invalid target_size: {target_size}")
        
    try:
        image = cv2.imread(image_path)
        if image is None:
            raise ImageProcessingError(f"Cannot load image: {image_path}")
            
        # Resize and normalize
        resized = cv2.resize(image, target_size)
        normalized = resized.astype(np.float32) / 255.0
        
        return np.transpose(normalized, (2, 0, 1))[np.newaxis, ...]
    except Exception as e:
        raise ImageProcessingError(f"Preprocessing failed: {e}")
```

## Testing Requirements

### Test Coverage

All contributions must maintain or improve test coverage:

- **Unit Tests**: Minimum 80% line coverage
- **Integration Tests**: All new API endpoints
- **Security Tests**: All crypto operations and input validation

### Running Tests

```bash
# Run all tests
./scripts/test.sh --all

# Run specific test types
./scripts/test.sh --unit
./scripts/test.sh --integration
./scripts/test.sh --security

# Run tests with coverage
cd src/web-client
npm run test:coverage
```

### Writing Tests

**Unit Test Example:**
```javascript
describe('Image Validation', () => {
  test('should detect JPEG files correctly', async () => {
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    const result = detectImageType(jpegBuffer);
    
    expect(result).toBe('image/jpeg');
  });
  
  test('should reject non-image files', async () => {
    const textBuffer = Buffer.from('Not an image', 'utf8');
    const result = detectImageType(textBuffer);
    
    expect(result).toBeNull();
  });
  
  test('should handle empty buffers gracefully', async () => {
    const emptyBuffer = Buffer.alloc(0);
    
    expect(() => detectImageType(emptyBuffer)).not.toThrow();
    expect(detectImageType(emptyBuffer)).toBeNull();
  });
});
```

**Integration Test Example:**
```javascript
describe('Upload API', () => {
  test('should process valid image upload', async () => {
    const imageBuffer = fs.readFileSync('tests/fixtures/real_cat.jpg');
    
    const response = await request(app)
      .post('/upload')
      .attach('image', imageBuffer, 'test.jpg')
      .expect(200);
    
    expect(response.body).toHaveProperty('jobId');
    expect(response.body.jobId).toMatch(/^job_\d+_[a-f0-9]+$/);
  });
});
```

## Pull Request Process

### Before Submitting

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Run the full test suite**:
   ```bash
   ./scripts/test.sh --all
   ```

3. **Check code quality**:
   ```bash
   cd src/web-client && npm run lint && npm run format:check
   cd ../ml-service && black --check . && flake8 .
   ```

4. **Update documentation** if needed

5. **Add tests** for new functionality

### PR Requirements

**PR Title Format:**
- `feat: add new YOLO model support`
- `fix: resolve crypto chunking memory issue`
- `docs: update API documentation`
- `test: add integration tests for upload flow`
- `security: implement rate limiting for uploads`

**PR Description Template:**
```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Security improvement

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Security tests pass
- [ ] Manual testing completed

## Security Considerations
- [ ] No new security vulnerabilities introduced
- [ ] Crypto operations follow best practices
- [ ] Input validation implemented
- [ ] No sensitive data in logs

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests added for new functionality
- [ ] Documentation updated
- [ ] No breaking changes without migration guide
```

### Review Process

1. **Automated Checks**: GitHub Actions will run all tests and security scans
2. **Code Review**: At least one maintainer review required
3. **Security Review**: Required for crypto/security-related changes
4. **Documentation Review**: Required for API or architecture changes

### Merge Requirements

- ✅ All automated checks pass
- ✅ At least one approving review
- ✅ No merge conflicts
- ✅ Branch is up to date with main

## Issue Reporting

### Bug Reports

Use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md):

```markdown
**Bug Description**
Clear description of the bug.

**Steps to Reproduce**
1. Start the application
2. Upload image file
3. Check result
4. See error

**Expected Behavior**
What should have happened.

**Environment**
- OS: [macOS 14.1]
- Docker: [24.0.5]
- Browser: [Chrome 119]

**Logs**
```
docker logs ccc-web-client
```

**Security Impact**
Does this bug have security implications?
```

### Feature Requests

Use the [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md):

```markdown
**Feature Description**
Clear description of the requested feature.

**Use Case**
Why is this feature needed?

**Proposed Solution**
How should this be implemented?

**Alternatives Considered**
What other approaches were considered?

**Additional Context**
Any other relevant information.
```

### Security Issues

**DO NOT** open public issues for security vulnerabilities.

Report vulnerabilities via GitHub Security Advisories:
- https://github.com/jellywish/confidential-cat-counter/security/advisories/new
- Allow 90 days for coordinated disclosure

## Security Considerations

### Crypto Code Guidelines

**Key Management:**
- Never hardcode keys or secrets
- Use proper random number generation
- Implement secure key derivation
- Follow AWS Encryption SDK patterns

**Input Validation:**
- Validate all inputs at boundaries
- Use magic byte detection for file types
- Sanitize all user-provided data
- Implement proper rate limiting

**Error Handling:**
- Fail closed on crypto errors
- Don't leak sensitive information in error messages
- Log security events appropriately
- Implement proper timeout handling

### Review Requirements

**High-Risk Changes** (require security review):
- Crypto operations
- Authentication/authorization
- Input validation
- Network communication
- File upload handling
- Docker/deployment configuration

**Security Checklist:**
- [ ] No secrets in code or logs
- [ ] Proper input validation
- [ ] Secure error handling
- [ ] Rate limiting implemented
- [ ] HTTPS/TLS enforced
- [ ] CSP headers configured
- [ ] Dependencies security-scanned

## Code Organization

### File Structure

```
src/
├── web-client/              # Node.js web application
│   ├── server.js           # Main server file
│   ├── utils/              # Utility modules
│   ├── public/             # Static files
│   └── tests/              # Test files
├── ml-service/             # Python ML service
│   ├── app.py              # Main application
│   ├── models/             # Model files
│   └── tests/              # Test files
tests/                      # Shared test resources
├── fixtures/               # Test data files
├── unit/                   # Unit tests
└── integration/            # Integration tests
docs/                       # Documentation
├── how-to/                 # Tutorials and guides
├── reference/              # API and technical reference
└── explanation/            # Architecture and concepts
scripts/                    # Build and utility scripts
```

### Naming Conventions

**Files and Directories:**
- `kebab-case` for files and directories
- `PascalCase` for class files
- `camelCase` for JavaScript variables/functions
- `snake_case` for Python variables/functions

**Functions and Variables:**
```javascript
// JavaScript
const sessionId = generateSessionId();
function validateImageFile(filePath) { }
class EncryptionManager { }
```

```python
# Python
session_id = generate_session_id()
def validate_image_file(file_path): pass
class EncryptionManager: pass
```

## Documentation Guidelines

### Documentation Types

Following the [Diátaxis framework](https://diataxis.fr/):

- **Tutorials** (`docs/tutorials/`): Learning-oriented
- **How-to Guides** (`docs/how-to/`): Problem-oriented
- **Reference** (`docs/reference/`): Information-oriented
- **Explanation** (`docs/explanation/`): Understanding-oriented

### Writing Style

- **Clear and Concise**: Use simple language
- **Code Examples**: Include working examples
- **Cross-References**: Link related documentation
- **Version-Specific**: Note version requirements
- **Accessible**: Consider all skill levels

### Documentation Updates

- **API Changes**: Update `docs/reference/api.md`
- **Architecture Changes**: Update `docs/explanation/architecture.md`
- **New Features**: Add how-to guides
- **Breaking Changes**: Update migration guides

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Git tag created
- [ ] Docker images built and pushed
- [ ] GitHub release created
- [ ] Security scan completed

## Getting Help

### Community Resources

- **Documentation**: Start with `docs/README.md`
- **Discussions**: [GitHub Discussions](https://github.com/jellywish/confidential-cat-counter/discussions)
- **Issues**: [GitHub Issues](https://github.com/jellywish/confidential-cat-counter/issues)

### Contact

- **General Questions**: GitHub Discussions
- **Bug Reports**: GitHub Issues
- **Security Issues**: Report via GitHub Security Advisories (link above)

## License

By contributing to this project, you agree that your contributions will be licensed under the Apache 2.0 License. See [LICENSE](LICENSE) for details.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Recognition

Contributors are recognized in:
- `CONTRIBUTORS.md` file
- GitHub contributor graphs
- Release notes for significant contributions

Thank you for contributing to the Confidential Cat Counter! 🐱
