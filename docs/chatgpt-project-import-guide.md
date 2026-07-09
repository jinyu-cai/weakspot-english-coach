# ChatGPT Project Conversation Import Guide

This guide explains how a learner can import ChatGPT conversations into
WeakSpot English Coach so the app can extract English-learning weaknesses from
past messages, assistant corrections, and expression gaps.

## What This Import Does

The import analyzes conversations as learning evidence. It looks for:

- English mistakes in your own messages
- Places where you asked ChatGPT how to say something
- Assistant corrections, rewrites, vocabulary advice, and grammar explanations
- Recurring weak spots that should update your learning profile

After analysis, the website can update your Dashboard, Practice targets, History,
and Daily Wins data.

## Current Limitations

Current version:

- Supports ChatGPT data export ZIP files that contain `conversations.json`
- Supports uploading a standalone `conversations.json`
- Supports pasted transcripts in `User:` / `Assistant:` format
- Analyzes any number of selected conversations by splitting large imports into
  20-conversation batches
- Uses the latest 80 messages per selected conversation

Current version does not yet:

- Connect directly to your ChatGPT account
- Auto-sync future ChatGPT conversations
- Automatically detect only one ChatGPT Project from the full export
- Analyze unlimited conversations in one AI request

If your ChatGPT Project has more than 20 useful conversations, select them all
on the import page. The app processes them in batches automatically.

## Before You Start

Do not import private secrets, passwords, API keys, payment details, or sensitive
personal information. The import sends selected conversation text to the backend
and the configured LLM provider for analysis.

Make sure the website is running:

- Local mock UI only: `http://localhost:3000/import`
- Local full stack: frontend on `http://localhost:3000`, backend on
  `http://localhost:8000`
- Production: your deployed Vercel URL

If you are testing with the real backend, `NEXT_PUBLIC_API_BASE_URL` must point
to the backend URL.

## Option A — Import From ChatGPT Data Export

Use this when you want to import conversations from your ChatGPT account.

OpenAI's official export flow is documented here:

- [Exporting your ChatGPT history and data](https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data)

High-level steps:

1. Sign in to ChatGPT.
2. Open your profile menu.
3. Open Settings.
4. Open Data controls.
5. Choose Export data.
6. Confirm the export.
7. Wait for the export email or SMS.
8. Download the ZIP file before the link expires.

The downloaded ZIP should include `conversations.json`.

Then import into WeakSpot:

1. Open WeakSpot.
2. Go to `Import` in the sidebar.
3. Click `Upload export`.
4. Select the ChatGPT export ZIP file.
5. Wait for the page to show how many analyzable conversations were found.
6. Use the `Conversations` control to choose how many conversations to analyze.
   Large imports are processed in 20-conversation batches.
7. Choose `Quick` for a faster scan or `Deep` for a more detailed scan.
8. Click `Analyze conversations`.
9. Review the `Weakness harvest` result.

After the analysis finishes, open:

- `Dashboard` to see updated weak spots
- `Practice` to generate exercises from those weak spots
- `History` to see the imported chat analysis record
- `Daily Wins` to see activity from the import

## Option B — Import One ChatGPT Project Manually

Use this when you only want conversations from one ChatGPT Project and do not
want the app to scan unrelated ChatGPT conversations.

Because the current website does not automatically filter by ChatGPT Project,
the simplest user-friendly method is to paste the relevant project transcript.

Recommended transcript format:

```text
User: I want to say 我今天开会迟到了 in English.
Assistant: You can say, "I was late for the meeting today."

User: Yesterday I go to office and discuss about project.
Assistant: A more natural sentence is: "Yesterday I went to the office and discussed the project."
```

Steps:

1. Open the ChatGPT Project.
2. Open a conversation you want to analyze.
3. Copy the parts that contain your English, your questions, and ChatGPT's
   corrections.
4. Open WeakSpot.
5. Go to `Import`.
6. Paste the transcript into the text box.
7. Click `Use pasted text`.
8. Choose `Quick` or `Deep`.
9. Click `Analyze conversations`.

For a project with many conversations, you can paste or upload them together.
The import page splits selected conversations into batches before analysis.

## Option C — Import A Filtered `conversations.json`

Use this if you are comfortable preparing a smaller file before upload.

The website accepts either:

- An array of conversation objects
- An object with a `conversations` array

Each conversation should include user and assistant messages. The importer reads
ChatGPT export-style fields such as `title`, `mapping`, `messages`, `author.role`,
and `content.parts`.

Steps:

1. Download your ChatGPT data export.
2. Extract the ZIP.
3. Open `conversations.json`.
4. Copy only the conversations that belong to the ChatGPT Project you want.
5. Save them as a new JSON file, for example `my-project-conversations.json`.
6. Open WeakSpot `Import`.
7. Click `Upload export`.
8. Select the filtered JSON file.
9. Choose how many conversations to analyze. Large selections are split into
   20-conversation batches automatically.

## How To Choose Quick vs Deep

Use `Quick` when:

- You are testing the import flow
- You only need a fast summary
- You are importing a small batch

Use `Deep` when:

- You want more weakness categories
- The conversations include many corrections
- You are preparing a serious study plan from the import

## What To Check After Import

After import, check these pages:

1. `Dashboard`
   Confirm that weak skills and recent mistakes changed.

2. `Practice`
   Generate a practice session and confirm it targets imported weak spots.

3. `History`
   Confirm a chat import record exists.

4. `Daily Wins`
   Confirm the import appears as learning activity.

## Troubleshooting

If upload says it cannot find `conversations.json`:

- Make sure you uploaded the original ChatGPT export ZIP, not another ZIP.
- Or extract the ZIP and upload `conversations.json` directly.

If upload says no analyzable conversations were found:

- The file may not contain user/assistant messages.
- The file may not be in ChatGPT export format.
- Try pasted transcript import instead.

If the export does not arrive:

- OpenAI says exports can take up to 7 days.
- Check inbox, spam, promotions, or SMS.
- Request a new export if the download link expired.

If analysis fails locally:

- Make sure the backend is running on `http://localhost:8000`.
- Make sure frontend env has `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
- Check backend logs for the request ID.

If production analysis fails:

- Confirm the deployed backend has `/api/v1/chat-import/analyze`.
- Confirm Vercel has `NEXT_PUBLIC_API_BASE_URL` set to the HTTPS backend URL.
- Confirm backend `CORS_ORIGINS` includes the Vercel frontend domain.

## Recommended Workflow

For best results:

1. Export ChatGPT data.
2. Import only English-learning or English-writing conversations.
3. Start with `Quick`.
4. Review the result.
5. Run `Deep` on the most useful project conversations.
6. Practice the top weak spot immediately.
7. Revisit `Daily Wins` after practice.
