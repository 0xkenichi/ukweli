# AI disclosure

Using AI is allowed in this hackathon. This file lists every AI tool used to build Ukweli, and what it was used for.

| Tool | Used for | Date |
|---|---|---|
| Claude (Anthropic, Claude Code) | Researching the hackathon brief, choosing the idea, and writing the first version of the code: MeTTa rules, the Python debate loop, the audit trail report, tests, sample data and this README | 2026-10-18 |
| Claude (Anthropic, Claude Code) | Adding learning from the owner's answers, the Swahili text (to be checked by a native speaker), and the live debate web page | 2026-10-18 |
| Claude (Anthropic, Claude Code) | Designing and building the 3D stage (three.js + GSAP): the balance scale, agent avatars, evidence tablets, rebuttal beams and the debate playback | 2026-10-18 |

## Inside the product

Ukweli's reasoning doesn't use an AI model. The agents' claims, evidence, rebuttals and decisions all come from the hand-written MeTTa rules in `metta/ukweli.metta`, run by the Hyperon MeTTa interpreter. If we add a language model later (for example to write explanations in Swahili), we'll list it here.
