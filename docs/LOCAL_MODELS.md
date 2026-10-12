# Local models & hardware profiles

ExamMate never calls a hosted inference API. A language model is **optional**. Without one,
ExamMate still provides:
- deterministic solving with verification,
- OCR,
- document Q&A with citations,
- every study feature,
- all 15 offline games.

The model is used only for:
- rephrasing a *verified* answer in simple words (the rephrasing is discarded if it changes any
  number),
- open-ended questions (always marked unverified),
- translation,
- rephrasing document answers (citations are validated against retrieved chunks).

## What was verified in this build
- The node-llama-cpp runtime (prebuilt llama.cpp from npm, CPU) loaded a GGUF file and
  generated tokens. The token limit was enforced, SHA-256 mismatches were refused, and
  missing/non-GGUF files reported errors cleanly (`src/test/agent.test.ts`).
- The fixture model is a tiny llama-architecture GGUF with **random weights**, built by
  `scripts/make_test_gguf.py`. It proves the runtime path, not answer quality.
- The `llama-server` adapter was tested against a local HTTP stub of the llama.cpp `/completion`
  protocol and refuses non-loopback URLs.
- **Not verified here:** answer quality with a real open-weight model. The build environment
  could not download model weights (HuggingFace was not reachable), so no real model was run.

## Installing a real model
1. Download a GGUF instruct model from a trusted source, for example from the official
   repositories of Qwen2.5-Instruct (0.5B / 1.5B / 3B / 7B), Llama 3.2 Instruct (1B / 3B) or
   Phi-3.5-mini. Pick the `Q4_K_M` quantisation unless you have the RAM for more.
2. Verify the SHA-256 against the publisher's checksum: `sha256sum model.gguf`.
3. Configure the server:
   ```
   LLM_MODE=node-llama-cpp
   LLM_MODEL_PATH=/srv/models/model.gguf
   LLM_MODEL_SHA256=<the published sha256>   # loading is refused on mismatch
   LLM_CONTEXT_TOKENS=4096
   LLM_MAX_OUTPUT_TOKENS=512
   LLM_GPU=auto                               # or off
   ```
   Or run llama.cpp's server on the same host and set `LLM_MODE=llama-server` and
   `LLM_SERVER_URL=http://127.0.0.1:8080`. Only loopback addresses are accepted.
4. Check `GET /api/agent/status` (`localModel.available`) and `GET /api/agent/hardware`.
5. Run `npm run eval` and compare with the previous run before enabling it for users.

## Deployment profiles
`GET /api/agent/hardware` measures RAM, CPUs and GPU and recommends a profile. These are
conservative guidelines; measure real speed on your hardware.

| Profile | Typical hardware | Recommendation |
|---|---|---|
| Lightweight | < 8 GB RAM, no GPU (incl. phones) | Deterministic tools + OCR only, or a ≤ 1B model at Q4 for short rephrasing. Do not run larger models on phones. |
| Standard | ≥ 8 GB RAM, CPU only | 1.5–3B instruct at Q4_K_M; context 4096; expect a few tokens/s on 4 cores. |
| High performance | GPU + ≥ 16 GB RAM | 7–8B instruct at Q4_K_M–Q6_K; longer context. LoRA fine-tuning is possible with external tooling (not implemented here). |

The mobile app does **not** run a language model on the device. Its on-device intelligence is
the deterministic solver, the classifier and the games from `@exammate/core`.
