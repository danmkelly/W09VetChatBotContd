# Meadow Vet Care Chatbot: design specification

> **Team:** The Five Innovators at Meadow Vet Care
> **Client:** Meadow Vet Care (14 Greenfield Road, Dublin 6, D06 VX92)
> **Brief:** Build a customer-facing AI chatbot ("MeadowBot") that answers real service questions from the clinic's live Google Sheets service catalogue using the MCP pattern -- live data, LLM brain, browser delivery.

---

## Project overview

Meadow Vet Care is a modern Irish veterinary clinic serving dogs, cats, rabbits, small mammals, and birds. They offer 94 services across 13 categories (Consultations, Preventive, Nutrition, Vaccination, Microchip and ID, Dental, Surgery, Diagnostics, Grooming, Behaviour, Emergency, End-of-Life, and Home Visits). Their differentiator is compassionate, personal care for every animal and owner.

MeadowBot is their AI chatbot, powered by DeepSeek LLM, that gives pet owners instant access to the clinic's service catalogue, answers questions about services and prices, surfaces special offers, and guides them through booking an appointment. The bot runs entirely in the browser, fetches live service data from a Google Sheets CSV endpoint (the MCP pattern: live data as the single source of truth), routes LLM calls through a Cloudflare Worker proxy for API key security, and persists personalisation data in localStorage with explicit consent.

---

## Team structure

| Innovator | Handle | Role | Domain ownership |
|-----------|--------|------|-----------------|
| Cormac Quinn | `@Cormac` | Manager / Orchestrator | Task decomposition, specialist dispatch, quality gates, cross-framework synthesis, delivery management |
| Fionn Grogan | `@Fionn` | Researcher / Domain Expert | Veterinary service catalogue research, taxonomy building, intent-to-service mapping, domain boundary enforcement |
| Siobhan O'Curran | `@Siobhan` | Designer | Conversational UI design, service card layout, two-panel widget, booking modal, brand visual identity, mobile responsiveness |
| Dara Bostwick | `@Dot` | Maker / Engineer | Chatbot conversation engine, MCP integration (Google Sheets CSV pipeline), intent routing (keyword + LLM hybrid), booking flow, localStorage memory, voice STT/TTS, recovery ladder |
| Niamh O'Brien | `@Niamh` | Backend / Infrastructure | Cloudflare Worker proxy for DeepSeek API key, CORS configuration, secrets management, GitHub Pages deployment, environment security |
| Keelin O'Sullivan | `@Keelin` | QA / Evaluator | Test plan design, bug tracking and triage, academic framework scoring (Taxonomy, CASA, Flow Anatomy, Grice), regression testing |

The scopes are non-overlapping: Fionn never builds, Siobhan never writes conversation logic, Dot never deploys infrastructure, Niamh never designs interfaces, Keelin never modifies features, and Cormac never does specialist work.

---

## Technical architecture

```
Browser (index.html)
  |-- Google Sheets CSV (live fetch, unauthenticated, public URL)
  |-- Cloudflare Worker proxy (/api/chat)
  |     `-- DeepSeek LLM (api.deepseek.com, key never in browser)
  |-- localStorage (consent-gated: name, visit count, search history, pet name)
  |-- Web Speech API (STT) and SpeechSynthesis API (TTS)
  `-- GitHub Pages (static hosting)
```

The architecture separates authenticated calls (DeepSeek LLM, through the Worker proxy) from unauthenticated calls (Google Sheets CSV, direct from browser). The Worker is a 52-line script that accepts POST requests from the browser, attaches the DeepSeek API key from `env.LLM_KEY`, forwards to `api.deepseek.com`, and returns the response. No key ever enters the browser.

---

## Key features

1. **MCP live data integration:** The bot fetches the service catalogue CSV from Google Sheets at runtime. Every service surfaced (name, species, category, price, duration, availability) comes from the live sheet. No stale embedded data.

2. **Two-stage intent routing:** Keyword extraction catches species, categories, and offer terms for fast high-confidence matches. The LLM handles ambiguous, conversational, or compound queries as a second-stage disambiguator.

3. **Service search and filter:** Pet owners can search by category ("dental"), species ("rabbit"), price range, or combined queries ("dental for rabbits under 50 euro"). Service cards render in the discovery panel with name, species, category, price, and bookability.

4. **Calendar booking flow:** A modal with day picker, time slot selector, and form fields (client name, pet name, pet species, phone) guides the user through booking one slot at a time.

5. **Voice input/output:** Web Speech API for STT (microphone button with listening state animation) and SpeechSynthesis for TTS (speaker icon on each bot message, cancel on re-click, auto-speak after voice input).

6. **Memory and personalisation:** localStorage stores client name, visit count, search history, and pet name -- all gated by an explicit consent flow (Yes/No prompt before any write). A "What I store" link and "Clear memory" button give full transparency and control.

7. **Recovery ladder:** A gibberish counter tracks consecutive unrecognised inputs. At failures 1-2 the bot rewords the question. At failures 3-4 it offers constrained suggestion chips and the human handoff path. At failure 4+ it auto-forces human handoff. Register shifts from helpful to concerned to definitive.

8. **Human handoff:** The "Prefer a real human?" bar is persistently visible at the bottom of the chat panel. Typing "human" returns the clinic's full contact details: phone (+353 1 800 5555), emergency (+353 1 800 9999), email (hello@meadowvetcare.ie), address, and opening hours.

---

## Academic frameworks applied

Four frameworks from the Customer Engagement and AI module are embedded in the chatbot's design, build, and evaluation:

| Framework | Source | Application | Domain owner |
|-----------|--------|-------------|-------------|
| Seven-Dimension Chatbot Taxonomy | Adamopoulou & Moussiades (2020) | Quality-gate checklist: knowledge domain, service provided, goals, response generation, channel, human-aid, permissions | Fionn (domain, service scope); Dot (goals, response gen, channel); Niamh (human-aid, permissions); Siobhan (channel presentation) |
| CASA (Computers Are Social Actors) | Reeves & Nass (1996) | Trust and ethics guardrail: disclosure, fake-human cues, register, frustration handling, chummy data extraction | Siobhan (disclosure design); Dot (frustration handling); Niamh (data governance); Fionn (register alignment); Keelin (CASA audit) |
| Conversation Flow Anatomy | Adamopoulou & Moussiades (2020) | Structural completeness: Opener, Intent, Slots, Recovery, Closer, Unexpected | Dot (recovery ladder, intents, slots); Siobhan (opener/closer UI); Cormac ("design the unexpected first" as sprint rule) |
| Gricean Maxims | Grice (1975) | Conversation quality: Quantity, Quality, Relation, Manner | Dot (Quantity, Quality -- response length and LLM grounding); Fionn (Relation -- domain guardrails); Siobhan (Manner -- clarity and brevity in UI) |

Keelin owns the cross-framework scoring rubric and produces a weighted design score from 22 academic findings (A01-A22). The current baseline design score is 4.0/5 (Grade B): 12 PASS, 9 PARTIAL, 1 N/A, 0 FAIL.

---

## Design principles

1. **Transparency-first:** The bot identifies itself as AI in the first conversational turn ("I'm MeadowBot, an AI chatbot"). Disclosure is visual (badge in header) and conversational (first spoken message), not hidden in a privacy modal.

2. **Consent-first:** No localStorage write occurs before explicit consent. The consent flow asks "Would you like me to remember you? Yes or No." before any name capture or data persistence. A "What I store" link is persistently visible.

3. **Recovery-first:** Failure paths are designed and scheduled before happy paths. Every phase plan starts with "what happens when the Sheet fails to load?" and "what happens when the user types gibberish four times?"

4. **Mobile-responsive:** The two-panel layout (chat left, services right) stacks vertically at 768px. Touch targets meet a 42px minimum. The services panel scrolls independently on mobile. Filter chips and booking buttons are thumb-friendly.

5. **Live data as truth:** The Google Sheet is the single source of truth. Every service surfaced by the bot must match the live sheet exactly. The bot does not hallucinate services, prices, or availability.

6. **Human-always-reachable:** The handoff path (phone, email, address, hours, emergency number) is available from every conversational state, including error states and proxy failure -- the handoff display is pure frontend HTML and survives Worker downtime.

---

## Delivery pattern

Cormac runs the following handoff sequence:

```
Fionn (catalogue research + domain boundary)
  -> Siobhan (interface design + service cards)
    -> Dot (conversation engine + MCP pipeline + booking + voice)
      -> Niamh (Cloudflare Worker proxy + secrets + deployment)
        -> Keelin (test plan + bug register + academic scoring)
          -> Cormac (synthesis + final deliverable)
```

Each handoff includes a contract: input (what the specialist receives), output format (what they deliver), success criteria (how it is judged), and handoff destination (who receives it next). Quality gates are mandatory at every stage.

---

## Clinic details

- **Address:** 14 Greenfield Road, Dublin 6, D06 VX92
- **Phone:** +353 1 800 5555
- **Emergency:** +353 1 800 9999
- **Email:** hello@meadowvetcare.ie
- **Hours:** Mon-Fri 08:00-19:00, Sat 09:00-17:00, Sun 10:00-14:00

---

*Meadow Vet Care Chatbot: designed and delivered by the Five Innovators team for the Customer Engagement and Artificial Intelligence module.*
