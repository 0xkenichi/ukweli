# AI disclosure

Using AI is allowed in this hackathon. This file lists every AI tool used to build Ukweli, and what it was used for.

| Tool | Used for | Date |
|---|---|---|
| Claude (Anthropic, Claude Code) | Researching the hackathon brief, choosing the idea, and writing the first version of the code: MeTTa rules, the Python debate loop, the audit trail report, tests, sample data and this README | 2026-10-18 |
| Claude (Anthropic, Claude Code) | Adding learning from the owner's answers, the Swahili text (to be checked by a native speaker), and the live debate web page | 2026-10-18 |
| Claude (Anthropic, Claude Code) | Designing and building the 3D stage (three.js + GSAP): the balance scale, agent avatars, evidence tablets, rebuttal beams and the debate playback | 2026-10-18 |
| Claude (Anthropic, Claude Code) | Building the owner's phone app, the 5-language MeTTa reader and the Gemini connection | 2026-10-18 |

## Inside the product

| Tool | Used for |
|---|---|
| Google Gemini (`gemini-2.5-flash`, optional) | Transcribing photos of the book and voice notes into text, word for word. It doesn't interpret anything. |
| The browser's speech-to-text (fallback) | Transcribing voice notes when no Gemini key is set |

Everything after transcription is MeTTa, run by the Hyperon interpreter: reading the words in 5 languages (`metta/reader.metta`), and the agents' claims, evidence, rebuttals and decisions (`metta/ukweli.metta`). No AI model makes any judgement.
