# VedaAI Implementation Notes

## Approach

VedaAI uses a three-stage document-processing pipeline:

1. The teacher uploads a question paper and a handwritten answer sheet through the Next.js frontend.
2. The FastAPI backend converts PDF or image uploads into page images, then sends the pages to a vision-capable AI model.
3. Extracted questions and answers are normalized and matched by question ID. Answers receive normalized bounding boxes so the frontend can highlight their locations on the answer-sheet page.
4. Matched answers are graded in a batch request. The results page displays questions, marks, feedback, unanswered or unmatched items, and an interactive answer-sheet viewer.

Processing progress is streamed from the backend to the frontend using Server-Sent Events (SSE). Sessions are stored in memory for the duration of the backend process.

## Handling and evaluation considerations

### Accuracy of question extraction

Question papers are sent as page images to Gemini's vision model with explicit instructions to preserve printed numbering, retain question order, split labelled sub-parts such as `11(a)` and `11(b)`, and extract maximum marks when visible. Empty or unreadable extraction results stop the pipeline with a clear processing error rather than producing an apparently valid empty result.

### Accuracy of answer mapping

Answers are identified by the question number written by the student, not by their physical order on the page. IDs are normalized before matching, so forms such as `Q1`, `1.`, `Ans 1`, and `1` can resolve to the same question. This supports answers written out of order. Questions without a matching answer are added as `unanswered`, while answers whose IDs do not match the question paper are retained as `unmatched`.

### Correct highlighting of answers

The model returns a bounding box and page index for each detected answer. The backend converts boxes from either normalized or `0..1000` coordinates into clamped normalized coordinates. The frontend applies those coordinates as overlays on the corresponding rendered answer-sheet page, supports multi-page answers, and automatically navigates to the first matching page and region when a question is selected.

### Handling of edge cases

The implementation includes handling for PDF and image inputs, empty documents, invalid or unreadable AI JSON, missing bounding boxes, unmatched answers, unanswered questions, out-of-order answers, multiple answer segments, model/API failures, quota fallback, upload-size limits, invalid page requests, and SSE reconnections. AI marks are also clamped to each question's valid maximum.

### Quality of implementation

The frontend uses TypeScript, reusable components, CSS Modules, memoized derived data, and lint/build validation. The backend uses typed Pydantic response models, bounded uploads, configurable CORS, context-managed PDF resources, background execution for blocking document/AI work, and in-memory task reuse to avoid duplicate processing after reconnects.

### Overall product experience

The product follows a focused upload → process → review flow. Teachers receive visible progress updates, clear error states, a question list ordered like the paper, score and feedback summaries, expandable AI feedback, unanswered/unmatched indicators, and an interactive answer-sheet viewer with page navigation, zoom, panning, and answer-region highlighting. AI marks and feedback are presented as review assistance and should be checked by a teacher before formal use.

## AI model and APIs

- **Primary AI API:** Google Gemini through the `google-genai` Python SDK.
- **Primary model:** `gemini-2.5-flash`.
- **Configured model fallback:** `gemini-3.6-flash`, attempted if the primary model/API call fails.
- **Optional text fallback:** OpenRouter using `nvidia/nemotron-3.5-lightning:free` when Gemini keys are unavailable and the request is text-only.
- **AI tasks:** printed question extraction, handwritten-answer OCR, answer-to-question mapping support, grading, and feedback generation.
- **Document processing:** PyMuPDF renders PDFs; Pillow decodes and normalizes image uploads before they are sent to the vision model.

Gemini API keys are read from environment variables beginning with `GEMINI_API_KEY`. The optional OpenRouter key is read from `OPEN_ROUTER_API_KEY`.

## Assumptions

- Each uploaded file is a readable PDF or a supported raster image.
- The question paper contains recognizable printed question numbers.
- Student answers generally include a recognizable leading question number, such as `1`, `Q2`, or `11(a)`.
- Bounding boxes returned by the model are either normalized to `0..1` or expressed on a `0..1000` scale; the backend normalizes and clamps them.
- The configured AI model can interpret the document language, handwriting style, and academic context.
- A question's maximum marks are visible or can be inferred from the question paper. If not, the value defaults to zero.

## Limitations

- AI extraction and grading are probabilistic. Poor scans, unusual handwriting, cropped pages, diagrams, tables, or mixed languages may reduce accuracy.
- Bounding boxes are model-generated estimates and may not perfectly cover every handwritten line.
- The current mapping relies primarily on normalized question IDs; unclear or missing IDs may be classified as unmatched.
- The application currently accepts one question paper and one answer sheet per session.
- Uploaded files and results are held in process memory. Restarting the backend loses all sessions, and the design is not suitable for multiple backend workers without shared storage.
- There is no authentication, authorization, database, retention policy, or persistent job queue. (as per requirement mentioned in notion)
- The 10 MB upload limit is enforced per file. Very large page counts or high-resolution images can still consume substantial memory during rendering and AI processing.
- AI availability depends on API credentials, model availability, rate limits, network access, and quota. The processing of documents take approximately 1 minute 30 seconds.
- AI-generated marks and feedback should be reviewed by a teacher before being used for formal assessment.
