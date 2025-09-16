# Documentation Reorganization Plan

## Current State Analysis
- **38 total markdown files** scattered across docs/
- **27 files in root docs/** (too many for easy navigation)
- **11 files in archive/** (good start but needs expansion)
- **Mixed document types** without clear categorization
- **Inconsistent naming** (CAPS vs lowercase, dates, etc.)

## Best Practices Framework: Diátaxis

Based on industry research, we'll implement the **Diátaxis framework** which organizes docs into four types:

### 📚 **Tutorials** (Learning-oriented)
*"Take me by the hand and teach me"*
- Step-by-step learning experiences
- For beginners getting started
- Complete, working examples

### 🔧 **How-to Guides** (Problem-oriented) 
*"Show me how to solve this specific problem"*
- Task-oriented instructions
- Assume some knowledge
- Focused on specific goals

### 📖 **Reference** (Information-oriented)
*"Tell me what this does"*
- Technical descriptions
- API documentation
- Complete, accurate information

### 💡 **Explanation** (Understanding-oriented)
*"Help me understand why"*
- Design decisions and context
- Architecture discussions
- Background and rationale

## Proposed New Structure

```
docs/
├── README.md                           # Main docs entry point
├── tutorials/                          # 📚 Learning-oriented
│   ├── getting-started.md             # Quick start guide
│   ├── first-encryption.md            # Basic crypto tutorial
│   └── model-integration.md           # ML model tutorial
├── how-to/                            # 🔧 Problem-oriented
│   ├── deployment/                    
│   │   ├── docker-setup.md
│   │   ├── aws-deployment.md
│   │   ├── cicd-testing.md           # CICD_STRATEGY ⭐
│   │   └── troubleshooting.md
│   ├── development/
│   │   ├── ui-fixes.md                # FILE_UPLOAD_BUTTON_ISSUE_RESOLUTION
│   │   ├── model-upgrades.md          # MODEL_ACCURACY_RESEARCH
│   │   └── crypto-implementation.md   # Crypto how-tos
│   └── testing/
│       ├── boundary-testing.md
│       └── performance-testing.md
├── reference/                         # 📖 Information-oriented
│   ├── api/
│   │   ├── web-client-api.md
│   │   └── ml-service-api.md
│   ├── patterns/
│   │   ├── encryption-sdk.md          # ENCRYPTION_SDK_PATTERNS
│   │   ├── nitro-enclaves.md         # NITRO_ENCLAVES_PATTERNS
│   │   ├── docker-attestation.md     # DOCKER_ATTESTATION_PATTERNS
│   │   └── attestation.md            # ATTESTATION_STRATEGY ⭐
│   └── specifications/
│       ├── technical-design.md        # TECHNICAL_DESIGN
│       └── phase2-implementation.md   # PHASE2_IMPLEMENTATION
├── explanation/                       # 💡 Understanding-oriented
│   ├── architecture/
│   │   ├── design-decisions.md        # Why we chose X over Y
│   │   ├── security-model.md          # Security explanations
│   │   └── performance-considerations.md
│   ├── security/
│   │   └── build-verification.md     # BUILD_VERIFICATION ⭐
│   ├── research/
│   │   ├── model-comparison.md        # MODEL_ALTERNATIVES_ANALYSIS
│   │   └── encryption-analysis.md     # Various analysis docs
│   └── lessons-learned.md             # LESSONS_LEARNED
├── planning/                          # 🚧 Current project work
│   ├── open-source-release-plan.md    # Active planning
│   ├── code-quality-assessment-plan.md
│   ├── phase1-execution-plan.md
│   └── repository-reorganization-plan.md
└── archive/                           # 📦 Historical/superseded
    ├── old-implementations/
    ├── abandoned-approaches/
    └── historical-analysis/
```

## Migration Plan

### Phase 1: Create New Structure
1. Create new directories (tutorials/, how-to/, reference/, explanation/)
2. Create category READMEs with navigation

### Phase 2: Categorize and Move
1. **Archive More Historical Docs** (15+ candidates)
2. **Consolidate Related Docs** (merge similar topics)
3. **Rename for Consistency** (clear, descriptive names)
4. **Create Missing Tutorials** (getting started guides)

### Phase 3: Create Navigation
1. Update main docs/README.md as hub
2. Add cross-references between related docs
3. Create quick-reference cards

## Benefits
- **🎯 Clear purpose** for each document
- **🧭 Easy navigation** by task type
- **📚 Progressive learning** path for new contributors
- **🔍 Findable information** when you need it
- **🚀 Professional appearance** for open source

## Documents to Archive (12+ candidates)
- All PHASE1/PHASE2_PROGRESS/IMPACT docs (superseded)  
- Outdated analysis (TOU_ENFORCEMENT, various _ANALYSIS.md from archive/)
- Week-specific summaries (WEEK4_TOU, etc.)
- Temporary planning docs once implemented
- OLD: ~~ATTESTATION, BUILD_VERIFICATION, CICD~~ → **KEEP - These are valuable!**

## Documents to Consolidate
- Model docs → Single model guide in how-to/
- Multiple pattern docs → Organized in reference/patterns/
- Various analysis → Consolidated explanations
- Multiple README variations → Single authoritative README

This reorganization will reduce the docs/ root from **27 files to ~5-7** main directories, making it dramatically easier to navigate and maintain.
