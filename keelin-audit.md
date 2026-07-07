# QA Audit -- Meadow Vet Care Chatbot (MeadowBot)

**Auditor:** Keelin O'Sullivan, QA Specialist  
**Date:** 7 July 2026  
**Product:** `index.html` (single-page application, ~909 LOC)  
**Methodology:** Manual code review, static analysis, dynamic flow tracing  

---

## FINDINGS SUMMARY

| ID   | Title                                                       | Severity |
|------|-------------------------------------------------------------|----------|
| F01  | Unreachable human-escape path in consent block              | Critical |
| F02  | Stored XSS via addSugg / recentSearches (user input)        | High     |
| F03  | EnrichLinks injects unescaped user data into onclick        | High     |
| F04  | CSV parser fails on doubled-quote escaping inside fields    | Medium   |
| F05  | loadMemory increments visits for non-consenting users       | Medium   |
| F06  | send() lacks try-catch -- typing indicator may persist      | Medium   |
| F07  | fetchServices has no retry or exponential-backoff          | Medium   |
| F08  | Service-search results overwritten by hard-coded species   | Low      |
| F09  | TTS speakMsg may never fire audio on first invocation       | Low      |
| F10  | activeSpecies filter-buttons out of sync after search       | Low      |

---

## FUNCTIONAL BUGS

---

### F01 -- Unreachable Human-Escape Path in Consent Block

**Severity:** Critical  
**Location:** `index.html`, line 768 (inside `send()`)  
**Category:** Logic / Control flow  

#### Details
The `send()` function uses three sequential state-machine phases:
1. `expectingHumanBot` (lines 737-751)
2. `expectingConsent` (lines 753-773)
3. `expectingName` (lines 775-788)

In phase 1, the variable `hb` is assigned:

```javascript
if(expectingHumanBot){
    var hb=S(txt);   // line 738 -- assigned ONLY in this block
    ...
}
```

In phase 2, the consent block, the developer attempted to provide a human-escape:

```javascript
if(hb==="human"){expectingConsent=false;hideTyping();showHuman();return}  // line 768
```

**Problem:** Although `var hb` is hoisted to function scope by JavaScript, the *assignment* at line 738 never executes when `expectingHumanBot` is `false`. When phase 2 is active (`expectingConsent===true`, `memory.consent===""`), `hb` is `undefined`. The comparison `undefined==="human"` is always false, so line 768 is **dead code** -- the intended human-escape path is unreachable.

#### Reproduction
1. Open the chatbot fresh (no localStorage).
2. When asked "Bot or Human?", reply with "Bot".
3. When asked for consent ("would you like me to remember you?"), reply with "human".
4. **Expected:** The chatbot shows human contact details.
5. **Actual:** The chatbot re-prompts: "Just a simple yes or no..." (line 770). The user is trapped in the consent screen.

#### Fix
Replace line 768 with the correct variable (`txt` is already available in scope):

```javascript
if(S(txt)==="human"){expectingConsent=false;hideTyping();showHuman();return}
```

Or, equivalently, rely on the global escape-hatch at line 809 which already checks `S(txt)==="human"` -- but that line is never reached because the consent block returns on line 772. The simplest fix is to check `txt` directly at line 768 instead of referencing `hb`.

---

### F02 -- Stored XSS via addSugg / recentSearches

**Severity:** High  
**Location:** `index.html`, lines 409 (addSugg), 867 (storage), 893 (retrieval)  
**Category:** Security / Injection  

#### Details
The `addSugg()` function renders clickable suggestion chips using `innerHTML`:

```javascript
function addSugg(arr){
  ...
  d.innerHTML='<div class="chat-sugg">'+arr.map(function(x){
    return'<span class="chat-sugg-btn" onclick="qa(\''+x.replace(/'/g,"\\'")+'\')">'+...x...+'</span>'
  }).join("")+'</div>';
}
```

The text body (inner content of the span) is HTML-escaped (`&`, `<`, `>`), but the **onclick attribute** only escapes single quotes (`'` -> `\'`). This is insufficient because inside a JavaScript string, `\'` is an *escape sequence* for a literal quote -- it does **not** prevent string termination. An attacker can inject a second `'` to break out of the `qa('...')` call.

The attack vector:
1. User types a malicious message, e.g.: `'); alert(document.cookie); //`
2. Line 867 stores it: `memory.recentSearches.unshift(txt.slice(0,40))`
3. On next page load (line 893), `memory.recentSearches` is passed to `addSugg()`.
4. The resulting HTML renders:
   ```
   onclick="qa('\''); alert(document.cookie); //'')"
   ```
5. The browser parses this JavaScript as:
   ```javascript
   qa('\'');   // ' and ') close the string; ) closes qa()
   alert(document.cookie);  // executes
   ```
   The `//` comments out the trailing `')`.

#### Reproduction
1. Open browser DevTools.
2. Type: `'); alert('XSS'); //` and press Send.
3. Refresh the page.
4. Observe the suggestion chips -- click the chip containing the payload.
5. The injected `alert()` executes.

#### Fix
Do not place user-controlled data in JavaScript event handlers. Refactor `addSugg` to use DOM event listeners:

```javascript
function addSugg(arr){
  var d=document.createElement("div"); d.className="msg bot";
  var wrap=document.createElement("div"); wrap.className="chat-sugg";
  arr.forEach(function(x){
    var btn=document.createElement("span");
    btn.className="chat-sugg-btn";
    btn.textContent=x;           // safe: textContent, not innerHTML
    btn.addEventListener("click",function(){qa(x)});
    wrap.appendChild(btn);
  });
  d.appendChild(wrap);
  chatMsgs.appendChild(d); sc();
}
```

This completely removes the injection surface.

---

### F03 -- enrichLinks Injects Unescaped Content into onclick

**Severity:** High  
**Location:** `index.html`, lines 565-575  
**Category:** Security / Injection (dormant)  

#### Details
The `enrichLinks()` function wraps known names in clickable spans:

```javascript
html=html.replace(rx,function(m,p1,p2){
  return p1+'<span class="chat-link" onclick="qa(\''+p2.replace(/'/g,"\\'")+'\')">'+p2+'</span>'
});
```

This suffers from the exact same escape-insufficiency as F02: the `p2` value goes into an `onclick` attribute with only single-quote escaping. If `knownNames` were ever populated from user-supplied data, the same XSS exploit would apply.

Currently `knownNames` is declared as `[]` (line 565) and never assigned, so the vulnerability is dormant. However, it is a ticking bomb for any future feature that populates `knownNames` from user input (e.g., pet names, user names).

#### Fix
Same approach as F02: avoid inline event handlers. Use `addEventListener` with properly-scoped data, or at minimum use `encodeURIComponent()` + double-escape approach if inline handlers are absolutely required.

---

### F04 -- CSV Parser Fails on Doubled-Quote Escaping Inside Quoted Fields

**Severity:** Medium  
**Location:** `index.html`, lines 480-490 (`parseCSVLine`)  
**Category:** Data Integrity  

#### Details
The `parseCSVLine` function handles quoted fields by toggling a boolean:

```javascript
if(c==='"'){inQuotes=!inQuotes}
```

RFC 4180 specifies that a literal double-quote inside a quoted field is escaped by doubling it: `"field with ""quotes"""`. The parser treats every `"` as a toggle, so it would break on:

```
S012,Specialist Consultation,"Includes ""Meet & Greet"" session",45,85
```

This field would be split incorrectly at the doubled quotes, producing garbled data.

Additionally, the parser does **not** handle:
- Leading/trailing whitespace inside quoted fields being significant (the `.trim()` at line 488 strips it regardless).
- Malformed CSV with an odd number of quotes in a field, which would cause all subsequent lines to be mis-parsed until the next even-quote line.

#### Reproduction
Add a row to the Google Sheet with a description containing double-quotes: `"This includes a ""special"" exam"` and observe that the service card displays garbled text.

#### Fix
```javascript
function parseCSVLine(line){
  var result=[], current="", inQuotes=false;
  for(var i=0;i<line.length;i++){
    var c=line[i];
    if(c==='"'){
      if(inQuotes && line[i+1]==='"'){
        current+='"'; i++;  // doubled quote = literal quote
      }else{
        inQuotes=!inQuotes;
      }
    }else if(c===',' && !inQuotes){
      result.push(current.trim()); current="";
    }else{
      current+=c;
    }
  }
  result.push(current.trim());
  return result;
}
```

---

### F05 -- loadMemory Increments Visits for Non-Consenting Users

**Severity:** Medium  
**Location:** `index.html`, lines 351-367 (`loadMemory`)  
**Category:** Privacy / Logic  

#### Details
```javascript
function loadMemory(){
  try{...memory=p...}catch(e){}
  memory.consent=memory.consent||"";
  if(memory.consent!=="no"){          // line 354
    memory.visits=(memory.visits||0)+1;  // always increments on first load
    memory.lastVisit=new Date().toISOString();
    ...
  }
}
```

On a brand-new user (no localStorage), `memory.consent` is `""`. The condition `"" !== "no"` is true, so visits are incremented and `lastVisit` is set -- even for users who have never been asked for consent or who will later decline. This contradicts the privacy disclosure in the "What I store" modal (lines 314-319) which states data is "stored on your device... never sent to a server."

Only when consent is explicitly `"yes"` should visit tracking occur (the subsequent guard at line 361 already enforces `saveMemory()` only for `"yes"`, but the counter still ticks).

#### Reproduction
1. Clear localStorage.
2. Load the page -- do not interact.
3. Check DevTools Application > Local Storage -- the `meadow_memory` key is not yet saved, but in-memory `memory.visits` is already 1 and `memory.lastVisit` is populated.
4. When the bot says "visits" in a preamble (via `getMemoryPreamble()`), it could report a visit count before consent.

#### Fix
Change line 354:

```javascript
if(memory.consent==="yes"){
```

This ensures visit tracking only begins after explicit opt-in.

---

### F06 -- send() Lacks try-catch; Typing Indicator May Persist

**Severity:** Medium  
**Location:** `index.html`, lines 730-873 (`send()`)  
**Category:** Robustness  

#### Details
The `send()` function calls `showTyping()` at line 732 and then performs synchronous operations (keyword extraction, service filtering, rendering) that could throw:

```javascript
showTyping();
// ... many sync operations that could throw ...
hideTyping();  // may never execute
```

Potential exception sources:
- `extractKeywords()` -- regex operations on user input (unlikely to throw but theoretically possible with crafted regex input).
- `renderServices()` -- string concatenation, could fail if service data is malformed.
- `allServices.filter()` -- if array is somehow corrupted.
- The `speechSynthesis.cancel()` call in `speakMsg()` (called from `addMsg`) could throw in some browser environments.

While `chatLLM()` has its own try-catch, the synchronous code in `send()` does not. Any uncaught exception leaves the typing-dots animation visible indefinitely with no error feedback.

#### Reproduction
Hard to trigger in production with current clean data, but defensive coding is appropriate. A unit test injecting malformed `allServices` entries could trigger it.

#### Fix
Wrap the body of `send()` (after `showTyping()`) in a try-catch:

```javascript
async function send(){
  var txt=chatInput.value.trim(); if(!txt)return;
  addMsg(txt,"user"); chatInput.value=""; showTyping();
  try{
    // ... existing logic ...
  }catch(e){
    console.error("[Bot] send() crash:", e);
    hideTyping();
    addMsg("Something went wrong on my end. Could you try again, or type human to speak to our team?", 'bot');
  }
}
```

---

### F07 -- fetchServices Has No Retry or Exponential Backoff

**Severity:** Medium  
**Location:** `index.html`, lines 491-506  
**Category:** Reliability / Resilience  

#### Details
```javascript
async function fetchServices(){
  ...
  try{
    var r=await fetch(SHEET_CSV);
    if(!r.ok)throw new Error("HTTP "+r.status);
    ...
  }catch(e){
    ...addMsg("I'm having trouble loading... Please try refreshing...");
    return false;
  }
}
```

If the Google Sheets export endpoint returns a transient 429 (rate limit), 503 (overload), or if the user's network is briefly interrupted, the service catalogue silently fails. The user gets an error message and must manually refresh the page. No retry is attempted.

Industry best practice for transient failures is at least 2-3 retries with exponential backoff.

#### Fix
```javascript
async function fetchServices(retries){
  retries=retries||2;
  document.getElementById("loadingOverlay").classList.add("active");
  for(var attempt=0;attempt<=retries;attempt++){
    try{
      var r=await fetch(SHEET_CSV);
      if(!r.ok)throw new Error("HTTP "+r.status);
      var csv=await r.text();
      allServices=parseCSV(csv);
      filteredServices=allServices.slice();
      document.getElementById("loadingOverlay").classList.remove("active");
      return true;
    }catch(e){
      if(attempt===retries){
        document.getElementById("loadingOverlay").classList.remove("active");
        addMsg("I'm having trouble loading our service catalogue...",'bot');
        return false;
      }
      await new Promise(function(res){setTimeout(res,Math.pow(2,attempt)*1000)});
    }
  }
}
```

---

### F08 -- Service-Search Results Overwritten by Hard-Coded activeSpecies

**Severity:** Low  
**Location:** `index.html`, lines 851, 863  
**Category:** Logic / UX  

#### Details
When the user performs a service search (e.g., "dog services"), lines 851-854 correctly narrow `activeSpecies` to the species found in search results:

```javascript
activeSpecies=[];                                        // line 851
results.forEach(function(r){...activeSpecies.push(sp)}); // detect species
...
```

But line 863 immediately resets it:

```javascript
activeSpecies=["dog","cat","rabbit","small mammal","bird"];  // line 863
```

This undoes the species narrowing, making line 851-854 dead code. The filter-bar buttons all light up as active regardless of the actual search results. The rendered cards are correctly filtered (because `renderServices()` at line 858 already uses the search results as `filteredServices`), but the filter UI is misleading.

#### Fix
Remove line 863, or gate it so it only runs when no specific species search was performed:

```javascript
// Only reset to all species if the user didn't search for a specific species
if(kw.species.length===0){
  activeSpecies=["dog","cat","rabbit","small mammal","bird"];
}
```

Also remove lines 860-862 (the unconditional re-sync) and instead sync filter buttons based on the actual `activeSpecies`:

```javascript
document.querySelectorAll(".filter-chip").forEach(function(b){
  // re-sync each chip based on activeSpecies state
  var sp="";
  ["dog","cat","rabbit","small-mammal","bird"].forEach(function(s){
    if(b.classList.contains("species-"+s))sp=s.replace("-"," ");
  });
  if(sp)b.classList.toggle("active",activeSpecies.indexOf(sp)>-1);
});
```

---

### F09 -- TTS speakMsg May Silently Fail on First Invocation

**Severity:** Low  
**Location:** `index.html`, lines 440-466 (`speakMsg`)  
**Category:** Functionality / Browser compatibility  

#### Details
The code correctly handles the case where `getVoices()` returns an empty array on the first call by registering an `onvoiceschanged` listener (line 464). However, two edge cases exist:

1. **Timeout without fallback:** At line 463, a 4-second timeout removes the `speaking` CSS class but does **not** attempt to speak. If `onvoiceschanged` never fires (possible in some browser extensions or headless environments), the user sees the button flash briefly and then nothing happens -- with no error message.

2. **Event already dispatched:** On certain browser/OS combinations, `voiceschanged` may have already fired before `speakMsg` is called for the first time. If `getVoices()` returns 0 at line 462 (because the voices list hasn't populated yet) but `onvoiceschanged` never fires again subsequently, the doSpeak callback is never invoked.

#### Fix
In the 4-second timeout, attempt a fallback `doSpeak(text)` with whatever voices are available:

```javascript
var voiceTimeout=setTimeout(function(){
  btn.classList.remove("speaking");
  doSpeak(text);   // fallback -- use whatever voices are available by now
},4000);
```

---

### F10 -- Filter Button State Out of Sync After Service Search

**Severity:** Low  
**Location:** `index.html`, lines 853-862  
**Category:** Logic / UX  

#### Details
After a service search in `send()`, the filter chips are manipulated in a confusing sequence:

```javascript
offersOnly=false; bookableOnly=false;                                    // line 852
document.querySelectorAll(".filter-chip.species-offer,.filter-chip.species-book")
  .forEach(function(b){b.classList.remove("active")});                   // line 853-854
document.querySelectorAll(".filter-chip").forEach(function(b){
  b.classList.remove("active");                                           // line 855
  if(b.classList.contains("species-"+S(results[0].species).replace(/\s/g,'')))
    b.classList.add("active");                                            // line 856
});
renderServices();                                                          // line 858
document.querySelectorAll(".filter-chip").forEach(function(b){
  if(!b.classList.contains("species-offer")&&!b.classList.contains("species-book"))
    b.classList.add("active");                                            // line 861
});
activeSpecies=["dog","cat","rabbit","small mammal","bird"];              // line 863
```

Lines 855-856 activate only the chip matching the *first result's* species. Then lines 860-862 immediately reactivate ALL species chips. This is inconsistent: between lines 856 and 861, the UI briefly shows only one species active, and the final state is always "all active." If the user looks at the filter bar after a search, they see every species lit up even when results contain only dogs.

#### Fix
Remove lines 860-862 and line 863 (see F08); instead, after line 856, sync only the species that were actually detected:

```javascript
// Keep only the species actually found in results
document.querySelectorAll(".filter-chip").forEach(function(b){
  var found=false;
  activeSpecies.forEach(function(sp){
    if(b.classList.contains("species-"+sp.replace(/\s/g,''))){
      b.classList.add("active"); found=true;
    }
  });
  if(!found && !b.classList.contains("species-offer") && !b.classList.contains("species-book"))
    b.classList.remove("active");
});
```

---

## ACADEMIC FRAMEWORK FINDINGS (A-Level)

---

### A01 -- GDPR / Consent Fatigue (Privacy-by-Design Failure)

**Framework:** GDPR Article 7 (Conditions for Consent) + ISO/IEC 27701 Privacy Information Management

The consent flow (lines 753-773) presents a binary yes/no prompt for memory storage. However, the implementation has three compliance gaps:

1. **Consent not freely given:** Users who decline ("no") are nagged with `rememberMe` button (line 244, `style="display:none"` conditional logic at line 385), while those who accept cannot later granularly change individual memory items (visits, searches, categories, pet name are bundled).

2. **Data processed before consent:** As documented in F05, `memory.visits` is incremented and `memory.lastVisit` is set before the user has given any consent (line 354, `memory.consent!=="no"` matching `""`). This violates the GDPR principle that processing shall not begin until consent is obtained (Article 6(1)(a)).

3. **No consent withdrawal audit trail:** The `clearMemory()` function (line 369) deletes all data silently with no record of when/if consent was withdrawn, making a Subject Access Request (SAR) response impossible.

**Recommendation:** Implement a layered consent model: (a) essential visit counter that operates without consent (legitimate interest basis), (b) personalisation group (name, pet name, searches) requiring explicit opt-in, with granular toggles visible in the memory info modal.

---

### A02 -- Nielsen's Usability Heuristic Violations (Error Prevention & Visibility of System Status)

**Framework:** Nielsen's 10 Usability Heuristics (1994, updated 2020)

**H5: Error Prevention** -- The chatbot has no input validation or length limits on the chat input. A user can paste a 10,000-character message. While `recentSearches` slices at 40 chars (line 867), the raw input is still processed through `extractKeywords()` and sent to the LLM with no truncation. There is no character counter, no warning, and no guard against `chatInput.value` being extremely large.

**H1: Visibility of System Status** -- The typing indicator (three bouncing dots, lines 66-69) is the **only** loading-state feedback. There is no indication of:
- Whether the LLM call is in progress vs queued.
- Whether the service catalogue fetch is stale (cached from previous session).
- Whether `fetchServices()` silently failed (the error message at line 503 only appears for the initial load; subsequent failures go unnoticed).

**Recommendation:** Add a character counter to the input (visible at 200+ chars). Add a small status dot next to MeadowBot's badge that indicates: green (ready), yellow (thinking/LLM), red (error/offline).

---

### A03 -- WCAG 2.2 Accessibility Gaps (Perceivable & Operable)

**Framework:** Web Content Accessibility Guidelines (WCAG) 2.2, Levels A/AA

Seven accessibility violations identified:

| WCAG SC          | Issue                                                                          |
|------------------|--------------------------------------------------------------------------------|
| 1.1.1 Non-text   | Emoji-only buttons (mic 🔊 line 250, send → line 251, speak 🔊 line 89) have no `aria-label` or text alternative. The mic button has `aria-label="Voice input"` but the send button has only `aria-label="Send"` with an arrow emoji -- screen readers read the emoji plus the label. |
| 1.4.3 Contrast   | Service card species badges (line 142: `color:var(--text-dim)` on `rgba(255,255,255,0.06)` background) fail minimum 4.5:1 contrast. The `chat-clear-btn` (line 54: `color:var(--text-dim)` on transparent) likely fails. |
| 2.1.1 Keyboard   | The "Clear memory" and "Remember me" buttons (lines 243-244) are not focusable (no explicit tabindex). The filter chips use `onclick` on `<button>` which is focusable, but suggestion chips (`chat-sugg-btn`, line 72) are `<span>` elements with `onclick` and no `tabindex` or `role="button"`. |
| 2.4.7 Focus      | No visible focus ring on any interactive element (default browser outline is suppressed by the reset `*,*::before,*::after{...}` which sets `margin:0;padding:0` but doesn't define `:focus` styles). |
| 3.3.2 Labels     | The booking modal inputs (lines 671-674) have `<label>` elements associated with inputs, but the chat input (line 249) has no associated `<label>`. |
| 4.1.2 Name/Role  | Suggestion chips (`chat-sugg-btn`) are `<span>` elements with click handlers but no `role="button"` or `tabindex="0"`, making them invisible to assistive technology. |

**Recommendation:** Minimum: add `aria-label` to icon-only buttons, add `role="button" tabindex="0"` to clickable spans, add a visible focus ring via `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`, and run the page through axe DevTools or Lighthouse to catch remaining violations.

---

### A04 -- Conversational Design: Missing Context Preservation & Memory Transparency

**Framework:** Moore & Arar's Conversational UX Design Principles (2019) + Google PAIR People + AI Guidebook

Four conversational-design shortcomings:

1. **No context handoff between bot and human path:** When the user clicks "Human" (line 253) and sees contact details, the conversation history with the bot is completely lost. The user must re-explain their needs to the human team. A proper handoff would copy a conversation summary into the modal or offer to email it.

2. **One-shot amnesia on gibberish escalation:** After 4 consecutive gibberish messages (line 802), the bot escalates to human contact. But it does not preserve the 4 failed attempts as context. A human agent receiving the handoff has no visibility into what the user was trying to say.

3. **Memory opacity:** The "What I store" modal (lines 312-319) lists categories of stored data but does not show the user their *actual* stored data. The user cannot audit what the bot remembers. The memory is invisible and untouchable (except for full deletion via "Clear memory"). This creates a trust deficit.

4. **No fallback escalation path:** If the LLM returns null (line 816: "I'm having trouble connecting"), the user is not offered alternative channels (phone, email). They must know to type "human" themselves. An effective conversational design would proactively offer "Would you like to speak to our team instead?"

**Recommendation:** Add a `[View my data]` link in the memory info modal that renders the current `memory` object as formatted HTML. Add an automatic suggestion chip `["Speak to our team"]` after any LLM failure. In the human contact modal, append a 1-2 line summary of the conversation topic (derived from `currentQuery` and keyword extraction results).

---

## APPENDIX: File Check Results

```
$ git log --oneline -3
(pending first commit for this file)

$ Test-Path keelin-audit.md
True
```

---

*End of audit -- 10 functional bugs (F01-F10) + 4 academic framework findings (A01-A04).*
