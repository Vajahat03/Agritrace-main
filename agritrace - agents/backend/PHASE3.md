# Phase 3 farmer workflow

The authenticated farmer workspace uses Supabase PostgreSQL through the `AuthStore` and workspace identity. New endpoints are `/farms`, `/produce`, `/scans`, and `/dashboard`. Farm, produce and scan lookups are scoped by the authenticated user and workspace; hidden navigation is not an authorization boundary.

## Scan lifecycle and files

`POST /scans` accepts multipart form data with `farm_id`, `produce_id`, an image, and optionally all five V1-only inputs (`freshness_score`, `temperature_c`, `humidity_rh`, `harvest_age_days`, `storage_type`). It validates decoded JPEG, PNG or WebP content, limits uploads to 8 MiB and 20 megapixels, and writes to a generated object key under the private `agritrace-scans` Supabase Storage bucket. The client filename is ignored. Responses expose only `image_id`, never an object path.

The new scan starts as `created`. `POST /scans/{scan_id}/analyze` changes it to `processing`, calls the repository's existing vision pipeline, then records `completed` or `failed`; a failed scan may be analyzed again. Results keep the existing vision model version and inference time. `GET /scans`, `GET /scans/{scan_id}`, and `/results` return only records in the active workspace. Scan filters support `farm_id`, `produce_id`, and `status`.

## Shelf-life and recommendation rules

Vision inference supplies quality and defect probability. The existing V1 model also requires an explicitly supplied development freshness score, temperature, humidity, harvest age, and one of its exact storage categories. If that complete set is omitted, no shelf-life value is shown or inferred. V1 training ranges are validation ranges for this development model; they are not universal physiological limits. The model has not been externally validated, and using it here does not make it production-ready.

When the complete caller inputs are present but a vision-derived V1 feature falls outside the wrapper's documented training range, the scan retains the vision result, marks Shelf-Life V1 as `not_run` with the wrapper's validation reason, and makes no prediction. Vision outputs are never clipped to force compatibility.

Produce records may also use the existing vision-only classes Bell Pepper and Strawberry. They remain scannable, but V1 is explicitly marked `not_run` for those produce types because they are not V1 learned categories; no name mapping is applied.

Recommendations are deterministic and centralized in `backend/workflow.py`: V1 estimate at or below 2 days produces **URGENT SALE**; at or below 5 days with quality below 60 produces **PRIORITIZE SALE**; vision defect probability at or above 0.35 produces **INSPECT / SORT**; otherwise the action is **NORMAL STORAGE** when V1 ran or **NORMAL HANDLING** when it did not. The response includes priority and a reason based on the recorded outputs. These are handling suggestions, not food safety decisions.

PostgreSQL schema changes are additive. Scan images are private objects in Supabase Storage. The existing Phase 2 `/api/workspaces/.../farms` routes remain for compatibility.
