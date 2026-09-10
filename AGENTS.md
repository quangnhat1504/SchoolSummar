# Wiki Agent Project Memory

This project uses the `wiki-agent` Codex skill as a persistent project memory base.

- Put immutable source material in `raw/`.
- Maintain derived knowledge in `wiki/`.
- Use `[[wikilinks]]` across source, entity, concept, and synthesis pages.
- Run the skill's health workflow after meaningful wiki edits.

For full schema details, see the global skill reference: `C:\Users\ADMIN\.codex\skills\wiki-agent\references\wiki-agent-schema.md`.

## Where the truth lives

- Wiki syntheses/log can lag reality: the freshest evidence is `verification.json` inside Kaggle output artifacts, with `.agent_scratchpad.md` as the working record. Re-read the artifact before reporting any metric (e.g. YOLO11m transfer acceptance 2026-08-13 is in artifacts, not yet in wiki).
- Verified head-only outputs: `benchmark/kaggle/verified/<family>-<dataset>/rag_*/verification.json`. YOLO transfer: `benchmark/kaggle/outputs_zero_shot_transfer_v1/*/zero_shot_transfer_v1/transfer/<model>/<dataset>/verification.json`.
- `benchmark/kaggle/verified/` holds the 12 accepted head-only outputs — these are ONE-epoch runs (2026-08-09). The head-only-10ep-v1 batch (2026-08-10) was never verified: only a Heron-DocBank `failure.json` exists locally, no `verification.json` anywhere under `*10ep*`. Do not label the verified numbers as 10-epoch.
- Acceptance = `verification_status: "artifact_ready"` with `epochs_completed` and `metrics.*` (`mAP50-95`, `latency_ms_per_page`, transfer adds precision/recall/F1/throughput/peak_vram_gb). API `COMPLETE` alone is never evidence.
- Metric derivations differ per source: wiki "raw macro mAP50-95" is not `oof_threshold_metrics.map50_95` in `pdf-ingestion-benchmark/artifacts/layout_model_benchmark.json`; do not mix them.

## Git and repo state

- Only ~53 files are tracked (src/, server/, tests/, docs/, database/, configs, README); everything else (benchmark/, data/, wiki/, raw/, tools/, *.pt, .venv-cuda/) is deliberately untracked, so `git add -A` stages gigabytes. .gitignore covers only data/raw, data/processed, benchmark/predictions, benchmark/kaggle/outputs*, benchmark/kaggle/verified.
- openpyxl is NOT installed in `.venv-cuda`, so `tools/create_benchmark_report_xlsx.py` (legacy Excel generator) cannot run there. The zero-dependency Node writer `tools/export_results_xlsx.mjs` (node:zlib + hand-rolled OOXML) works anywhere; run it from the repo root.

## Tooling quirks (this environment)

- The `write_file` tool can fail for any path (backend issue); workaround is chunked bash heredocs (`cat >` / `cat >>` with quoted delimiters), each chunk well under ~8 KB — one large heredoc got silently truncated.
- The shell pre-sets `PORT=49678`; `node --env-file` never overrides existing env vars (env wins), so boot tests must pass `PORT=` explicitly. `node --env-file` tolerates `[TEMPLATE]` headers and mixed CRLF/LF.
- Memory-mode boot is safe with empty `DATABASE_URL`/`S3_BUCKET` (store falls back to MemoryStore, object store to local); there is no Redis code in `server/`.
- No Google Drive integration exists here (no tool; no rclone/gcloud/gdrive installed); Drive uploads need rclone OAuth or Google Drive for Desktop as a local mount.
- `browser_check` is unavailable in this build.

## Kaggle orchestration (pipeline quirks)

- Kaggle CLI 2.x (2.2.4) ignores `KAGGLE_CONFIG_DIR` **and** `KAGGLE_USERNAME`/`KAGGLE_KEY`; it reads `Path.home()/.kaggle` only. Account rotation works via overriding `USERPROFILE` to a temp dir holding `.kaggle/kaggle.json` (see `selected_account` in `tools/manage_zero_shot_transfer.py`). Symptom of broken rotation: every probe authenticates as `ngquangnht` or `Permission 'kernels.get' was denied`.
- The in-process SDK (`kaggle.KaggleApi` + `KAGGLE_USERNAME`/`KAGGLE_KEY` env) DOES honor the env vars, so use the SDK for identity probes/API calls and the USERPROFILE override for CLI subprocesses.
- `subprocess.run(["python", ...])` on Windows resolves to the venv redirector (base interpreter, usually without kaggle), not the PATH python — always resolve an interpreter with a working `python -m kaggle` first (`kaggle_cli_python()` helper).
- Kaggle SDK 2.x removed `api.parse_kernel_string`; split `<owner>/<slug>` manually (see `tools/download_transfer_artifacts.py`).
- `kaggle kernels status` prints `<kernel_id> has status "KernelWorkerStatus.<STATE>"` — grep `KernelWorkerStatus\.[A-Z]*`. Pushes need `--accelerator NvidiaTeslaT4 --timeout <secs>`; CLI subprocesses take `-X utf8` for Windows encoding.
- `tools/manage_zero_shot_transfer.py` takes `--protocol <id>` resolving `benchmark/config/<id>.json`, `benchmark/kaggle/plan_<id>.json`, `kernels_<id>`, `run_manifests_<id>`, `outputs_<id>`; plan runs may omit `phase`/`execution_eligibility` (defaults to `head_only`).
- `tools/build_head_only_20ep_kaggle.py` imports code templates from `build_head_only_10ep_kaggle` (Heron) and `build_head_only_rtdetr_kaggle` (RT-DETR) and patches them via string replace — change notebook logic in the base builders, not the 20ep one. Heron sets epochs via an `EPOCHS = N` variable; RT-DETR via YAML `epoches: N` + audit `"epochs": N`, so validators must check per family (RT-DETR template originally lacked a T4 assert; added in the 20ep transform).

## User notes

- User communicates in Vietnamese; reply in Vietnamese.
