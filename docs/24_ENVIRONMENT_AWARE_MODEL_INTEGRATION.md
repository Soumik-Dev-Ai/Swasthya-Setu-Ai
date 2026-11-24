# Document 24 — Environment-Aware Fine-Tuned Model Integration

**The rule this document implements:** the fine-tuned edge model may be loaded by (a) your local dev machine, for testing/demo purposes, or (b) the end-user's phone, via ONNX, in production. It must **never** be loaded by the cloud-deployed backend process, under any environment configuration, even by accident. This isn't a capability limit — a paid cloud tier could technically run it — it's a deliberate architectural boundary: the cloud backend's job is the online Reasoning Engine, full stop.

---

## CLAUDE CODE PROMPT — build the environment-aware guard

```
Add an environment-aware guard that structurally prevents the fine-tuned edge
model from ever loading in the cloud-deployed backend, while still allowing
it to load in local development for testing.

1. Add an explicit environment flag (e.g., DEPLOYMENT_TARGET=local_dev |
   cloud_production) to the environment variable catalog
   (03_SYSTEM_ARCHITECTURE.md §13) and .env.example. Default to
   cloud_production if unset — the safer default is "don't load the model,"
   not "load it unless told not to."

2. Wrap any code path that could load the fine-tuned model (model file
   loading, ONNX runtime initialization, any local-testing endpoint that
   exercises the offline backend) in an explicit check against this flag.
   If DEPLOYMENT_TARGET=cloud_production, that code path must raise a clear,
   descriptive error rather than silently failing or silently falling back —
   "fine-tuned model loading is disabled in cloud_production by design, see
   24_ENVIRONMENT_AWARE_MODEL_INTEGRATION.md" is the kind of error message
   that saves someone a confused hour later.

3. Add a startup-time check: when the backend process starts with
   DEPLOYMENT_TARGET=cloud_production, explicitly log that the fine-tuned
   model path is disabled and confirm no model weight files are present in
   the deployed container/environment at all — not just that the code won't
   call them, but that the weight files themselves aren't shipped to Render
   in the first place. Add a .renderignore or equivalent so model weight
   files never get included in what's actually deployed to the cloud
   environment, regardless of what's in the local dev repo.

4. Add a test (09_QA_TEST_PLAN.md-style) that explicitly asserts: with
   DEPLOYMENT_TARGET=cloud_production set, any attempt to invoke the offline
   backend path raises the expected error, and no ONNX runtime or model
   loading library call is ever made. This should be a real automated test,
   not just a code review checklist item — the same discipline as every
   other safety-relevant boundary in this project.

5. Confirm the online Reasoning Engine backend (hosted cascade) remains the
   only backend the cloud deployment ever uses for triage refinement — this
   should already be true given the original architecture, this step is
   confirming it, not changing it.

Report: which files were touched, the test result for item 4, and confirm
via a dry-run deploy check (or equivalent) that no model weight files are
present in what would actually ship to Render.
```

## What stays true regardless of this guard

- Your local dev machine can load and test the fine-tuned model freely — that's the whole point of `23_COMPLETE_FINETUNING_TRAINING_GUIDE.md`'s local training path.
- The real production deployment of the fine-tuned model is the mobile app's on-device ONNX bundle (`23_COMPLETE_FINETUNING_TRAINING_GUIDE.md` §8) — a client-side concern, not something either your local machine or Render "serves" to users.
- If a funded pilot or institutional deployment later justifies paid cloud GPU hosting, that's a real, buildable future option — but it would be a deliberate architecture change with its own design doc, not something that happens by a flag silently flipping.
