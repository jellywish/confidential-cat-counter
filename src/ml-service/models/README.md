# Model Artifacts

This folder is intentionally empty in Git. Large model binaries are not committed to avoid repository bloat and GitHub's 100MB file limit.

## How to fetch a model locally

- Recommended minimal model (works out-of-the-box):

```bash
./scripts/cache-onnx-model.sh
```

This downloads `yolov5s.onnx` into `src/ml-service/models/` for local builds and Docker images. The ML service will detect the model automatically.

## Using other models

- Place your ONNX model(s) here, e.g. `yolo_nas_l.onnx`.
- The service prefers YOLO-NAS when present; otherwise falls back to YOLOv5s.
- See `docs/how-to/development/model-upgrades.md` for accuracy/perf trade-offs.

## Why ignore models in Git?

- Avoids hitting GitHub’s 100MB limit and keeps the repo fast to clone.
- Encourages reproducible, local caching or artifact registry use (future).
