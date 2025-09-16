# Phase 1 Technical Design – Local‑Only Release

Status: Draft (current phase)

## 1. Scope & Goals
- End‑to‑end local demo: browser → web client → Redis → ML service → results
- Client‑side encryption demo (mock crypto logging), TOU gate in browser
- Server‑side: safe upload, queue, basic inference, results polling
- No cloud, no KMS, no enclaves; simple and reliable developer experience

## 2. Non‑Goals
- Attestation, KMS gating, formal verification
- Cloud storage and multi‑tenancy

## 3. Components & Interfaces
- Web Client (Express)
  - POST `/upload` (multipart form image)
  - GET `/results/:jobId`
  - GET `/health`
- Redis (queue)
  - list `ml-jobs`, keys `job:<id>`
- ML Service (FastAPI)
  - Background worker `brpop ml-jobs`
  - GET `/health`, `/queue/status`

## 4. Data Contracts
- Job (queued): `{ id, filename, mimetype, size, detectedType, status, timestamp }`
- Result (completed): `{ id, status, cats, confidence, processingTime, model, completedAt }`
- Error: `{ error, message, code, timestamp }`

## 5. Security & TOU
- Client: TOU consent + file size/type checks
- Server: magic‑byte validation, rate limiting, no PII filenames stored
- Logs: structured; no image bytes, no secrets

## 6. Testing
- `./scripts/test.sh --all` (defaults to Docker/integration path)
- Unit: JS and (optional) Python if enabled
- Integration: upload → process → result → negative cases (bad type, too large)

## 7. Known Limitations
- Mock encryption path (education only)
- No egress guard/policy engine yet (see Rego design)
- Accuracy not a goal; model selection for demo only

## 8. Next Steps
- Implement Rego pre/post hooks + egress guard (see policy‑governed‑inference‑rego.md)
- Add SBOM/signing/provenance (issues #53–#57)
- Prepare AWS path (Terraform, S3, KMS, Nitro)
