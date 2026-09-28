# Stocktake project working preferences

## Model selection and credit efficiency

- Use GPT-6 Astra (`gpt-6-astra`) for large-scale reasoning, architecture, and decisions spanning the whole project.
- Use Luna (`gpt-5.6-luna`) for simple, repetitive, and batch tasks. Use Terra (`gpt-5.6-terra`) or Sol (`gpt-5.6-sol`) when routine work needs more capability.
- Delegate concrete, independent routine subtasks to those lower-cost models when working under Astra. Keep the coordinator's work brief and focused on project-level decisions and integration.
- Minimize total credit use: batch related tasks, provide only relevant context, reuse results, and avoid duplicate agent work, unnecessary parallel agents, repeated checks, or excessive reasoning.
- Use the lowest reasoning effort appropriate to the task; escalate only when complexity, uncertainty, or failures justify it.
- These are routing instructions, not an automatic switch of the active task's model. If the requested model is unavailable, disclose that limitation rather than silently claiming it was used.

## Branch workflow

- Apply the next requested changes on `codex/stocktake-updates`, based on `main`.
- Do not include the unmerged `codex/archive-suppliers-products` work unless requested.
