# Repository Reorganization Plan

## Current Structure Analysis

### 🔍 **Issues Identified**

#### 1. Documentation Scattered
- ✅ Main docs in `/docs/` 
- ❌ Root-level docs: `README.md`, `PRFAQ.md`, `PHASE1_COMPLETION_SUMMARY.md`, `README_PM_FOCUSED.md`
- ❌ Multiple README files causing confusion

#### 2. Temporary Files Present
- ❌ `temp_yolo_nas/` - 67M parameters conda environment (should be removed)
- ❌ `temp_yolox/` - Failed installation attempt (should be removed)

#### 3. Model Files Duplicated
- ❌ `/models/yolov5s.onnx` (root level)
- ❌ `/src/ml-service/models/` (5 model files - correct location)

#### 4. Upload Directories Scattered
- ❌ `/data/uploads/` (51 files)
- ❌ `/src/ml-service/uploads/` 
- ❌ `/src/web-client/uploads/`

#### 5. Component Duplication
- ❌ `/src/web-client/components/CryptoLogDrawer.js`
- ❌ `/src/web-client/public/components/CryptoLogDrawer.js`
- ❌ `/src/web-client/styles/crypto-drawer.css`
- ❌ `/src/web-client/public/styles/crypto-drawer.css`

#### 6. Test File Duplication
- ❌ `/src/web-client/tests/day8-bundle-test.html`
- ❌ `/src/web-client/public/day8-bundle-test.html`

## 🎯 **Proposed Target Structure**

```
confidential-cat-counter/
├── README.md                 # Main project README
├── LICENSE                   # Apache 2.0 license
├── docker-compose.yml        # Main deployment
├── Makefile                  # Build automation
├── .gitignore               # Clean ignore rules
│
├── docs/                    # All documentation
│   ├── ARCHITECTURE.md       # Technical architecture 
│   ├── DEPLOYMENT.md         # Deployment guide
│   ├── DEVELOPMENT.md        # Developer setup
│   ├── API.md               # API documentation
│   ├── SECURITY.md          # Security considerations
│   ├── CONTRIBUTING.md      # Contribution guidelines
│   ├── CHANGELOG.md         # Version history
│   └── archive/             # Historical docs (kept as-is)
│
├── src/                     # All source code
│   ├── web-client/          # Frontend application
│   │   ├── public/          # Static assets & HTML
│   │   ├── components/      # React-like components
│   │   ├── utils/           # Utility functions
│   │   ├── styles/          # CSS files
│   │   ├── package.json     # Dependencies
│   │   ├── server.js        # Express server
│   │   └── Dockerfile       # Container definition
│   │
│   └── ml-service/          # Backend ML service
│       ├── models/          # ONNX model files
│       ├── app.py           # FastAPI application
│       ├── requirements.txt # Python dependencies
│       └── Dockerfile       # Container definition
│
├── tests/                   # Test suites
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   ├── e2e/               # End-to-end tests
│   └── fixtures/          # Test data
│
├── scripts/                # Utility scripts
│   ├── setup.sh           # One-command setup
│   ├── clean.sh           # Cleanup script
│   └── validate.sh        # Health check
│
├── examples/               # Usage examples
│   ├── basic/             # Basic usage
│   ├── advanced/          # Advanced configurations
│   └── tutorials/         # Step-by-step guides
│
└── infrastructure/         # Deployment configs
    ├── docker/            # Docker configurations
    ├── kubernetes/        # K8s manifests (if needed)
    └── cloud/            # Cloud-specific configs
```

## 📋 **Reorganization Steps**

### Phase 1: Cleanup (Safe Operations)
- [ ] **Remove temporary directories**
  ```bash
  rm -rf temp_yolo_nas/ temp_yolox/
  ```

- [ ] **Consolidate model files**
  ```bash
  rm models/yolov5s.onnx  # Already in src/ml-service/models/
  rmdir models/
  ```

- [ ] **Clean up upload directories**
  ```bash
  rm -rf data/uploads/*  # Clear old uploads
  rm -rf src/ml-service/uploads/*
  rm -rf src/web-client/uploads/*
  ```

### Phase 2: Documentation Consolidation
- [ ] **Consolidate README files**
  - Keep main `README.md`
  - Move `PRFAQ.md` → `docs/PRFAQ.md`
  - Archive `README_PM_FOCUSED.md` → `docs/archive/`
  - Archive `PHASE1_COMPLETION_SUMMARY.md` → `docs/archive/`

- [ ] **Reorganize docs structure**
  - Create `docs/ARCHITECTURE.md` (from TECHNICAL_DESIGN.md)
  - Create `docs/DEPLOYMENT.md` (from parts of implementation docs)
  - Create `docs/API.md` (extract from existing docs)
  - Create `docs/SECURITY.md` (from encryption patterns)

### Phase 3: Source Code Organization  
- [ ] **Fix component duplication**
  ```bash
  # Keep only src/web-client/public/ versions
  rm src/web-client/components/CryptoLogDrawer.js
  rm src/web-client/styles/crypto-drawer.css
  ```

- [ ] **Consolidate test files**
  ```bash
  # Move day*.html files to tests/e2e/
  mkdir -p tests/e2e/
  mv src/web-client/public/day*.html tests/e2e/
  ```

### Phase 4: New Structure Creation
- [ ] **Create examples directory**
  ```bash
  mkdir -p examples/{basic,advanced,tutorials}
  ```

- [ ] **Create infrastructure organization**
  ```bash
  # infrastructure/ already exists, just organize better
  ```

## ⚠️ **Safety Considerations**

### Before ANY changes:
1. **Create backup branch**: `git checkout -b pre-reorganization-backup`
2. **Commit current state**: `git add -A && git commit -m "Backup before reorganization"`
3. **Test current functionality**: Ensure docker-compose up works
4. **Document critical paths**: Note any hardcoded file paths in code

### During reorganization:
1. **One phase at a time**: Complete and test each phase
2. **Update references**: Fix any hardcoded paths in code
3. **Test after each phase**: Ensure nothing breaks
4. **Git tracking**: Use `git mv` instead of `mv` for tracked files

### Files requiring path updates:
- [ ] `docker-compose.yml` - volume mounts
- [ ] `Dockerfile` files - COPY paths  
- [ ] `server.js` - static file serving paths
- [ ] `app.py` - model loading paths
- [ ] Any import statements in JavaScript
- [ ] Test scripts and Makefile

## 🧪 **Validation Plan**

### After each phase:
```bash
# 1. Test Docker setup
docker-compose down && docker-compose up --build

# 2. Test web interface
curl http://localhost:3000/health

# 3. Test ML service
curl http://localhost:8000/health

# 4. Test file upload workflow
# (Manual test through web interface)
```

### Final validation:
- [ ] All services start successfully
- [ ] File upload and processing works
- [ ] Crypto logging functions
- [ ] ML inference completes
- [ ] No broken links in documentation
- [ ] All tests pass

## 📝 **Notes**

### Critical paths to update:
- `docker-compose.yml` volume mounts
- Dockerfile COPY commands
- Static file serving in server.js
- Model loading in app.py
- Any hardcoded imports

### Files to preserve exactly:
- All source code functionality
- Docker configurations (update paths only)
- Test fixtures and data
- Documentation content (reorganize only)

### Can be safely removed:
- Temporary conda environments
- Duplicate files
- Old upload data
- Cached build artifacts
