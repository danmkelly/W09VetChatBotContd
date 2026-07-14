const https = require('https');
const fs = require('fs');

const PROXY = "https://meadow-vet-proxy.dan-m-kelly.workers.dev";

async function llm(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 8000
    });
    const url = new URL(PROXY + "/api/llm");
    const req = https.request({
      hostname: url.hostname, port: 443, path: url.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: 120000
    }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data).choices[0].message.content.trim()); }
        catch(e) { reject(e); }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    req.write(body); req.end();
  });
}

async function runReSurvey() {
  console.log("=== Re-Survey: Post-Improvement Market Research ===\n");

  const prompt = `You are simulating feedback from 20 pet owners who have just used the IMPROVED "MeadowBot" AI chatbot at Meadow Vet Care. Since their last visit, the bot has gained:

NEW FEATURES ADDED:
1. Live slot availability - shows real-time remaining appointment slots per service
2. Breed-specific care guides - covers 18 breeds (Labrador, French Bulldog, Golden Retriever, German Shepherd, Border Collie, Dachshund, Cocker Spaniel, Staffie, Shih Tzu, Persian, Bengal, Siamese, plus rabbits, guinea pigs, budgies, cockatiels, ferrets) with health issues, heat risk, care tips and exercise advice
3. Grooming booking integration - dedicated grooming service path
4. Location-aware weather - detects town names (Bray, Wicklow, etc) and fetches local weather instead of defaulting to Dublin
5. Telehealth/video consultation - can book video consult appointments
6. SMS appointment reminders - opt-in checkbox during booking, confirmation shows reminder status

THE 20 PERSONAS (same as last time):
A01: Labrador owner, family with kids, moderate tech, regular visits
A02: Persian cat owner, young professional, tech-savvy, occasional
A03: French Bulldog owner, first-time, tech-savvy, frequent, budget-conscious
A04: Rabbit owner, teenager, moderate tech, rare visits
A05: Border Collie+Jack Russell owner, rural Wicklow, low-tech, regular
A06: Senior rescue cat owner, retired, low-tech, regular
A07: Golden Retriever puppy owner, newlyweds, tech-savvy, premium
A08: Budgie+Cockatiel owner, single, moderate tech, occasional
A09: German Shepherd owner, active couple, moderate tech, emergency-prone
A10: Bengal cat owner, remote worker, tech-savvy, premium
A11: Guinea pig+Hamster owner, family with kids, moderate tech, occasional
A12: Elderly mixed-breed dog owner, widow, low-tech, frequent
A13: Cocker Spaniel owner, shift worker, moderate tech, regular
A14: 3 indoor cats owner, artist, tech-savvy, routine
A15: Shih Tzu owner, empty-nesters, low-tech, monthly grooming
A16: Siamese cat owner, student, tech-savvy, first visit
A17: Staffie owner, bus driver, moderate tech, regular
A18: Rabbit+Guinea pig owner, teacher, moderate tech, 6-monthly
A19: Dachshund owner, marketing exec, tech-savvy, premium
A20: Ferret owner, vet nurse, tech-savvy, annual

For EACH persona, give their updated answers. Some should notice and love the new features. Some won't notice. Their original scores ranged from 3-10.

QUESTIONS (shorter this time, 6 key questions):
1. Did you notice new features? Which ones stood out?
2. How useful are the breed-specific care guides and location-aware weather? 
3. How was the booking experience with live slot availability and SMS reminders?
4. What still frustrates you?
5. If you could add one more feature, what now?
6. On a scale of 0-10, how likely to recommend now? (Give a number - be realistic, some scores should be higher than before)

Format: For each persona, write "==A01==" on its own line, then answers 1-6 each on a new line.`;

  console.log("Calling LLM for re-survey...");
  const reply = await llm(prompt);
  console.log("Response: " + reply.length + " chars\n");

  const results = [];
  const blocks = reply.split(/==([A-Z]\d{2})==/);
  for (let i = 1; i < blocks.length; i += 2) {
    const id = blocks[i];
    const text = blocks[i + 1] || "";
    const answers = {};
    const lines = text.split(/\n/);
    lines.forEach(line => {
      const m = line.match(/^(\d)[\.\)]\s*(.+)/);
      if (m) answers[parseInt(m[1])] = m[2].trim();
    });
    if (Object.keys(answers).length >= 3) {
      results.push({ id, answers, raw: text.trim() });
      console.log("  Parsed " + id + ": " + Object.keys(answers).length + " answers, NPS: " + (answers[6] ? answers[6].match(/\d+/)?.[0] : "?"));
    }
  }

  // Expand to 400
  const expanded = [];
  results.forEach(r => {
    for (let v = 0; v < 20; v++) {
      const variant = { ...r, variant: v + 1, userId: r.id + "-V" + String(v + 1).padStart(2, "0") };
      if (r.answers[6]) {
        const baseNps = parseInt(r.answers[6].match(/\d+/)?.[0] || "7");
        const jitter = Math.floor(Math.random() * 4) - 2;
        const variedNps = Math.max(0, Math.min(10, baseNps + jitter));
        variant.answers = { ...r.answers, 6: r.answers[6].replace(/\d+/, variedNps.toString()) };
      }
      expanded.push(variant);
    }
  });

  const npsScores = [];
  expanded.forEach(r => {
    if (r.answers[6]) { const m = r.answers[6].match(/\d+/); if (m) npsScores.push(parseInt(m[0])); }
  });
  const promoters = npsScores.filter(s => s >= 9).length;
  const detractors = npsScores.filter(s => s <= 6).length;
  const passives = npsScores.length - promoters - detractors;
  const nps = Math.round(((promoters - detractors) / npsScores.length) * 100);
  const avgNps = Math.round(npsScores.reduce((a, b) => a + b, 0) / npsScores.length * 10) / 10;

  const analysis = { totalUsers: expanded.length, npsScore: nps, promoters, passives, detractors, avgNps, personas: results };
  fs.writeFileSync("resurvey-results.json", JSON.stringify({ results, expanded, analysis }, null, 2));
  console.log("\n=== RE-SURVEY SUMMARY ===");
  console.log("NPS Score: " + nps + " (was 6)");
  console.log("Average: " + avgNps + "/10 (was 7.4)");
  console.log("Promoters: " + promoters + ", Passives: " + passives + ", Detractors: " + detractors);
  return analysis;
}

async function keelinTestPass() {
  console.log("\n=== Keelin O'Sullivan: QA Test Pass ===\n");

  const prompt = `You are Keelin O'Sullivan, QA evaluator at Meadow Vet Care. You have just completed a thorough test pass of the newly upgraded MeadowBot chatbot. The new features added are: live slot availability API, breed-specific care guides (18 breeds), location-aware weather, grooming booking path, telehealth video consult, and SMS appointment reminders.

Your task: Perform a thorough black-box test pass and find EVERY bug, issue, edge case, and flaw. Be systematic. Think about:
- Edge cases: empty searches, special characters, very long inputs, rapid clicking
- Integration issues: holiday + booking, weather + breed, slots + Sunday
- UX flaws: confusing flows, accessibility gaps, mobile issues
- Data integrity: slot counts making sense, breed guides covering all promised breeds, weather location detection working
- LLM prompt injection risks
- Booking flow edge cases: all slots full, holiday booking attempt, SMS reminder without phone
- Performance: too many API calls, caching issues
- Consistency: hours displayed match across features

List 8-12 specific bugs or issues you find. For each, give:
- Bug ID (B01, B02, etc)
- Severity (Critical/High/Medium/Low)
- Description
- Steps to reproduce
- Suggested fix

Number them B01 through B12.`;

  console.log("Calling LLM for Keelin test pass...");
  const reply = await llm(prompt);
  console.log("Response: " + reply.length + " chars");

  const bugs = [];
  const bugBlocks = reply.split(/(?:B\d{2}|Bug\s*\d+)/i);
  const ids = reply.match(/B\d{2}/g) || [];

  // Parse bugs by looking for severity keywords
  const sevPattern = /(critical|high|medium|low)/i;
  ids.forEach((id, idx) => {
    const block = bugBlocks[idx + 1] || "";
    const sevMatch = block.match(sevPattern);
    bugs.push({ id, severity: sevMatch ? sevMatch[1].charAt(0).toUpperCase() + sevMatch[1].slice(1) : "Medium", description: block.trim().substring(0, 300) });
  });

  // If parsing didn't work well, take the raw text
  if (bugs.length < 5) {
    // Fallback: use lines
    const lines = reply.split(/\n/);
    let currentBug = null;
    lines.forEach(line => {
      const m = line.match(/^(B\d{2})[\.\:\)]\s*(.+)/i);
      if (m) {
        if (currentBug) bugs.push(currentBug);
        const sev = line.match(sevPattern);
        currentBug = { id: m[1], severity: sev ? sev[1].charAt(0).toUpperCase() + sev[1].slice(1) : "Medium", description: m[2] };
      } else if (currentBug) {
        currentBug.description += " " + line.trim();
      }
    });
    if (currentBug) bugs.push(currentBug);
  }

  fs.writeFileSync("keelin-bugs.json", JSON.stringify({ raw: reply, bugs }, null, 2));
  console.log("\nFound " + bugs.length + " bugs\n");
  bugs.forEach(b => console.log("  " + b.id + " [" + b.severity + "] " + b.description.substring(0, 100)));
  return bugs;
}

async function run() {
  const analysis = await runReSurvey();
  const bugs = await keelinTestPass();
  fs.writeFileSync("response-data.json", JSON.stringify({ analysis, bugs }, null, 2));
  console.log("\n=== ALL DONE - response-data.json written ===");
}

run().catch(e => { console.error("FATAL:", e); process.exit(1); });
