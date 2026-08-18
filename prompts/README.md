# Prompts

Personal prompt library for AI-assisted learning tools, consolidated from the
former `prompt-skills` repository.

The education section primarily focuses on TOEFL learning and responds in
Chinese. 教育部分的 Prompt 主要面向托福学习，并使用中文回复。

## Education

| Prompt | Purpose |
|---|---|
| [`learn-a-new-topic.md`](education/learn-a-new-topic.md) | Learn an unfamiliar subject systematically via knowledge map, sourced real-world case, staged explanations, and adaptive checks. |
| [`单词背诵.md`](education/单词背诵.md) | Deep memory cards for English vocabulary (analogy, etymology, context, cultural links, active recall). |
| [`单词背诵助手.md`](education/单词背诵助手(origin%20from%20cherry-studio).md) | Vocabulary breakdown with simple English, Chinese translation, and mnemonics. |
| [`answer-analyze.md`](education/answer-analyze.md) | TOEFL reading question analysis with per-option evidence from the passage. |
| [`extract-reading-for-practice.md`](education/extract-reading-for-practice.md) | Extract TOEFL reading passages + questions from PDF/images for study documents. |
| [`polishing-writing.md`](education/polishing-writing.md) | TOEFL essay error correction and polishing (150–225 words). |
| [`Speaking-task1-idea.md`](education/Speaking-task1-idea.md) | TOEFL Speaking Task 1 brainstorming: both directions, outline, and sample answers. |
| [`toefl-reading-translator.md`](education/toefl-reading-translator.md) | Sentence-by-sentence translation (literal + natural) and detailed explanation in Chinese. |
| [`toefl-writing-task1.md`](education/toefl-writing-task1.md) | TOEFL Writing Task 1 (integrated) error correction and polishing. |
| [`toelf-independWriting.md`](education/toelf-independWriting.md) | TOEFL independent writing polish (110–120 words). |

## Skills

The same workflows are also packaged as discoverable skills for agent
harnesses that implement the
[Agent Skills standard](https://agentskills.io/specification):

- [`../.pi/skills/programming-tutor/`](../.pi/skills/programming-tutor/) — Acts as a personal programming tutor.
- [`../.pi/skills/learn-new-topic/`](../.pi/skills/learn-new-topic/) — Teach a complete beginner any
  unfamiliar topic with a knowledge map, sourced case, staged explanations, and
  understanding checks. Includes `agents/openai.yaml` metadata for ChatGPT/Codex
  (OpenAI agent skills format).

Install for local use:

```bash
# Pi / Claude Code / Codex style skill location
cp -r .pi/skills/* ~/.pi/agent/skills/
```