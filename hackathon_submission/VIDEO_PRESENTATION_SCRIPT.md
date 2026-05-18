# Blitz TraceGrid Video Presentation Script

Recommended video length: 4 to 5 minutes.

Goal: make judges conclude that Blitz TraceGrid turns invisible software behavior into visible, explainable, auditable execution intelligence.

## Setup Before Recording

- Open the deployed Vultr URL in a clean browser tab.
- Use dark mode default UI.
- Keep the repository field ready with either `__demo__` or a public GitHub URL.
- Keep typed voice mode enabled as the reliable voice option.
- Do not show source code during the main demo.
- If live microphone fails over HTTP, say: "For judged reliability, I am using the typed voice mode; the Speechmatics live microphone path is wired and requires HTTPS in production browsers."

## 0:00-0:20 - Opening Hook

On screen: app open, graph empty or ready state.

Say:

"AI can now write software faster than humans can audit it. But the real enterprise problem is no longer just generating code. It is understanding what the software actually does when it runs."

Pause.

"Blitz TraceGrid turns invisible execution into a visible causal graph."

Action:

Point briefly to the empty graph area and the Static Causal Reconstruction label.

## 0:20-0:55 - Graph Reveal

Action:

Click `Analyze Repository`.

What judges should see:

- Nodes and edges appear.
- System map becomes visible.
- Tags such as UI, API, backend, security, database, dependency appear.

Say:

"This is not a documentation view. TraceGrid analyzes the repository and reconstructs a graph of how the system is connected across UI, API, backend, security, and data layers."

"Today this is graph-grounded static causal reconstruction. That is deliberate: it gives us a safe hackathon demo today, and a clean path toward runtime tracing after the hackathon."

## 0:55-1:35 - Click Moment / Trace Target

Action:

Use `Trace Target` or click the high-value target selected by the graph. For the demo fixture, use `LoginButton` or click `Run AI Investigation`.

What judges should see:

- The graph narrows into a focused trace slice.
- The primary replay path becomes visible.
- The timeline updates.

Say:

"Now we stop looking at the whole map and ask a more useful question: what happens next from this exact point?"

"TraceGrid separates two ideas: the trace slice shows connected context, and the primary replay path shows the ordered path selected for animation."

For the login fixture:

"This turns one user action into a visible execution story: LoginButton, click handler, API route, auth handler, middleware, database query, token service, and session store."

## 1:35-2:15 - Run AI Investigation

Action:

Click `Run AI Investigation`.

What judges should see:

- TraceGrid analyzes or uses the current graph.
- It picks the riskiest or most connected entry point.
- AI Investigation Verdict appears.

Say:

"This is the autonomous agent workflow. TraceGrid analyzes the graph, chooses the most important investigation target, creates a trace slice, runs specialized agents, and produces one verdict."

Read the verdict labels:

"Root Cause. Attack Surface. Primary Replay Path. Recommended Fix. Confidence."

Key line:

"The agents are not free-floating chatbots. They are grounded in the same execution graph."

## 2:15-2:55 - Agent Reasoning

Action:

Scroll or point to Agent Reasoning.

What judges should see:

- Architecture Agent.
- Security Agent.
- Execution Agent.
- Explainer Agent.
- Brief explanation blocks.

Say:

"Each agent explains a different layer of the same graph. The Architecture Agent explains structure. The Security Agent looks for exposed or sensitive paths. The Execution Agent reconstructs the replay route. The Explainer Agent converts the graph into plain language."

"We added brief explanations because enterprise users are not always compiler engineers. The system has to explain itself."

## 2:55-3:35 - Security Moment

Action:

Click `Highlight Security` or point to risk labels and the Security Agent.

What judges should see:

- Risk tags: none, low, medium, high.
- Security findings.
- Risk reasoning in plain language.

Say:

"This is where execution intelligence becomes security intelligence."

"TraceGrid does not just say something is risky. It shows where the risk sits in the flow and explains why it matters in plain language."

"A high-risk API boundary, an auth middleware step, or a database identity lookup becomes visible inside the causal graph."

## 3:35-4:10 - Voice And Replay

Action:

Use typed voice command:

`Trace what happens when a user logs in`

Then click `Replay Execution`.

What judges should see:

- Voice intent is parsed.
- Replay target label updates.
- Timeline/graph replay animates the path.

Say:

"Developers and security teams can interrogate the system in natural language."

"Then Replay turns the selected path into a software film: step by step, causally ordered, and explainable."

Key line:

"We turned software into something you can watch, not just debug."

## 4:10-4:45 - Hackathon Alignment And Close

Action:

Leave the final graph and AI Investigation verdict visible.

Say:

"This is aligned with the AI Agent Olympics because it is an autonomous enterprise agent workflow deployed as a real web app. It uses Vultr for deployment, Featherless for real inference when configured, and Speechmatics for voice-driven agent interaction."

"The current system is honest: static causal reconstruction today, runtime causal tracing tomorrow."

Final close:

"Blitz TraceGrid does not just analyze code. It reconstructs how software behaves: visibly, causally, and reproducibly."

## Failure Protection Lines

If GitHub ingestion is slow:

"For timing, I will use the deterministic demo fixture. The same analyzer also accepts public GitHub URLs."

If live voice fails:

"Browsers require HTTPS for public-IP microphone access, so I am using typed voice mode for judged reliability. The Speechmatics realtime path is wired behind the backend proxy."

If AI inference is slow:

"TraceGrid keeps graph-grounded local reasoning as a fallback, so the demo remains deterministic even without a live model response."

If challenged on runtime tracing:

"Correct. This version is static causal reconstruction, not runtime tracing. That is the credible hackathon milestone. The runtime roadmap is OpenTelemetry, browser instrumentation, and eBPF-backed event capture."

## Slide Presentation Talk Track

Use this if presenting from slides before the live app.

1. Title: "Blitz TraceGrid makes software execution visible."
2. Problem: "AI creates code faster than teams can inspect behavior."
3. Category: "We are not a code summarizer. We are a causal software intelligence layer."
4. Demo architecture: "Repository ingestion becomes AST-lite evidence, graph construction, trace slicing, replay, and agents."
5. Product proof: "The user can analyze a repo, choose a target, replay a path, ask agents, and inspect risk."
6. AI Investigation: "This is the autonomous workflow judges should remember."
7. Security: "Attack surfaces become visible inside the execution path."
8. Hackathon alignment: "Vultr, Featherless, Speechmatics, enterprise utility, agentic workflows."
9. Roadmap: "Static causal reconstruction today; runtime instrumentation after the hackathon."
10. Close: "Software becomes observable behavior."
