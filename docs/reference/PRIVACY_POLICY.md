# Privacy Policy - Confidential Cat Counter Reference Architecture

**Last Updated**: September 12, 2025  
**Effective Date**: September 12, 2025

## Overview

The Confidential Cat Counter is a **reference architecture and educational demonstration** of privacy-preserving machine learning techniques. This privacy policy explains how data is handled in this open-source software.

## Important Notice: Local-Only Operation

**🔒 This application operates entirely on your local system. No data is transmitted to external servers.**

- ✅ All processing happens on your local machine
- ✅ No data leaves your computer
- ✅ No external API calls for ML inference
- ✅ No user tracking or analytics
- ✅ No cookies or persistent identifiers

## Data Processing

### What Data Is Processed
- **Images**: Photos you upload for cat detection
- **Processing Metadata**: File size, type, upload timestamp
- **ML Results**: Detection results (cat count, confidence scores)

### How Data Is Processed
1. **Client-Side Encryption**: Images can be encrypted in your browser before processing
2. **Local ML Inference**: Machine learning runs entirely on your local Docker containers
3. **Temporary Storage**: Uploaded files are stored temporarily in local Docker volumes
4. **Automatic Cleanup**: Files are automatically deleted based on retention policies

### Data Retention
- **Uploaded Images**: Stored temporarily in `./data/uploads/` directory
- **Processing Results**: Stored temporarily in `./data/results/` directory  
- **Default Retention**: 24 hours (configurable)
- **Manual Cleanup**: Available via `scripts/cleanup.sh`

## Technical Privacy Features

### Encryption
- **Client-Side Encryption**: AWS Encryption SDK implementation for browser
- **Encryption Context**: Metadata-only (no PII)
- **Key Management**: Local raw AES keys (not cloud-based)

### Data Minimization
- **No PII Collection**: No personally identifiable information required
- **Filename Anonymization**: Original filenames are not stored in logs
- **Metadata Only**: Only technical metadata is logged

### Security Measures
- **Magic-Byte Validation**: Only image files accepted
- **Rate Limiting**: Prevents abuse (100 uploads per 15 minutes)
- **Input Sanitization**: All uploads validated before processing
- **Error Handling**: No sensitive data in error messages

## No External Data Sharing

This application **DOES NOT**:
- ❌ Send data to external APIs
- ❌ Connect to cloud ML services
- ❌ Upload files to remote servers
- ❌ Share data with third parties
- ❌ Use tracking pixels or analytics
- ❌ Store data in external databases

## Developer and Deployment Responsibilities

### For Developers Using This Code
If you modify or deploy this reference architecture:

1. **Review Dependencies**: Ensure all dependencies maintain privacy standards
2. **Local-Only Promise**: Maintain the local-only operational model
3. **Encryption Standards**: Follow established encryption patterns
4. **Data Minimization**: Continue PII-free design principles

### For Production Deployments
If adapting this reference for production use:

1. **Privacy Impact Assessment**: Conduct thorough privacy review
2. **Regulatory Compliance**: Ensure compliance with GDPR, CCPA, etc.
3. **Security Audit**: Professional security review recommended
4. **User Consent**: Implement appropriate consent mechanisms
5. **Data Governance**: Establish data retention and deletion policies

## Technical Logging

### What Is Logged
- **Application Events**: Startup, processing, errors
- **Performance Metrics**: Processing times, file sizes
- **Security Events**: Rate limiting, validation failures

### What Is NOT Logged
- ❌ Original filenames
- ❌ File contents or image data
- ❌ Personal information
- ❌ IP addresses (in reference implementation)
- ❌ User identifiers

## Your Rights and Control

### Data Control
- **Full Control**: You maintain complete control over your data
- **Local Access**: All data remains on your local system
- **Easy Deletion**: Simple cleanup scripts provided
- **No Account Required**: No registration or authentication needed

### Transparency
- **Open Source**: All code is publicly available for review
- **Documentation**: Comprehensive technical documentation provided
- **Audit Trail**: Processing logs available for review

## Educational and Research Use

This software is designed for:
- ✅ Educational demonstrations
- ✅ Privacy research
- ✅ Architecture reference
- ✅ Development learning

It is **NOT intended** for:
- ❌ Production data processing without modification
- ❌ Processing sensitive or personal data without review
- ❌ Commercial use without proper privacy assessment

## Contact and Support

### For Privacy Questions
- **GitHub Issues**: [Repository Issues Page]
- **Documentation**: See `docs/` directory for technical details
- **Community**: Open-source community support only

### For Legal or Compliance Questions
This is open-source educational software. For legal or compliance questions related to your specific use case, consult with appropriate legal counsel.

## Changes to This Policy

This privacy policy may be updated as the reference architecture evolves. Changes will be:
- Documented in version control
- Announced in release notes
- Maintained in this document

## Compliance Framework

This reference architecture is designed with privacy principles:
- **Privacy by Design**: Built-in privacy protections
- **Data Minimization**: Collect only necessary data
- **Purpose Limitation**: Data used only for stated purposes
- **Storage Limitation**: Automatic data cleanup
- **Transparency**: Open documentation and code

---

## Summary

**The Confidential Cat Counter prioritizes your privacy through:**
- 🔒 **Local-only operation** - no external data transmission
- 🛡️ **Client-side encryption** - data protection in your browser
- 🧹 **Automatic cleanup** - no permanent data retention
- 📖 **Open source** - complete transparency and auditability
- 🎓 **Educational focus** - designed for learning, not production data processing

**Your data never leaves your computer.**

---

*This privacy policy applies to the reference implementation as provided. If you modify or deploy this software, you are responsible for ensuring your implementation maintains appropriate privacy protections and complies with applicable laws.*
