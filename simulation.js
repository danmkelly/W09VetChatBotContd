const https = require('https');
const fs = require('fs');

const PROXY = "https://meadow-vet-proxy.dan-m-kelly.workers.dev";

async function llm(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 8000
    });
    const url = new URL(PROXY + "/api/llm");
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: "POST",
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
    req.write(body);
    req.end();
  });
}

const ARCHETYPES = [
  { id:"A01", pet:"Labrador dog", demog:"Family with 2 kids, suburban Dublin", tech:"Moderate", visits:"Regular (joint issues)", budget:"Middle" },
  { id:"A02", pet:"Persian cat", demog:"Young professional, city apartment", tech:"Tech-savvy", visits:"Occasional checkups", budget:"Premium" },
  { id:"A03", pet:"French Bulldog", demog:"First-time dog owner, city flat", tech:"Tech-savvy", visits:"Frequent (breed health issues)", budget:"Budget-concerned" },
  { id:"A04", pet:"Rabbit", demog:"Teenager's pet, family home", tech:"Moderate", visits:"Rare (only when sick)", budget:"Middle" },
  { id:"A05", pet:"Border Collie + Jack Russell", demog:"Rural farm, Co. Wicklow", tech:"Low-tech", visits:"Regular farm calls", budget:"Middle" },
  { id:"A06", pet:"Rescue cat (senior)", demog:"Retired couple, Dublin suburb", tech:"Low-tech", visits:"Regular (senior cat care)", budget:"Budget-concerned" },
  { id:"A07", pet:"Golden Retriever puppy", demog:"Newlyweds, suburban estate", tech:"Tech-savvy", visits:"Puppy schedule", budget:"Premium" },
  { id:"A08", pet:"Budgie + Cockatiel", demog:"Single, shared house", tech:"Moderate", visits:"Occasional nail/beak trims", budget:"Middle" },
  { id:"A09", pet:"German Shepherd", demog:"Active couple, hikers", tech:"Moderate", visits:"Emergency-prone (injuries)", budget:"Premium" },
  { id:"A10", pet:"Bengal cat", demog:"Tech professional, remote worker", tech:"Tech-savvy", visits:"Annual + telehealth", budget:"Premium" },
  { id:"A11", pet:"Guinea pig + Hamster", demog:"Family with young kids", tech:"Moderate", visits:"Occasional", budget:"Budget-concerned" },
  { id:"A12", pet:"Elderly mixed-breed dog", demog:"Widow, lives alone", tech:"Low-tech", visits:"Frequent (chronic)", budget:"Middle" },
  { id:"A13", pet:"Cocker Spaniel", demog:"Shift worker", tech:"Moderate", visits:"Regular grooming + checkups", budget:"Middle" },
  { id:"A14", pet:"3 indoor cats", demog:"Artist, creative professional", tech:"Tech-savvy", visits:"Routine for all three", budget:"Middle" },
  { id:"A15", pet:"Shih Tzu", demog:"Empty-nester couple", tech:"Low-tech", visits:"Monthly grooming", budget:"Premium" },
  { id:"A16", pet:"Siamese cat", demog:"University student", tech:"Tech-savvy", visits:"First vet registration", budget:"Budget-concerned" },
  { id:"A17", pet:"Staffordshire Bull Terrier", demog:"Bus driver, council estate", tech:"Moderate", visits:"Regular checkups", budget:"Budget-concerned" },
  { id:"A18", pet:"Rabbit + Guinea pig", demog:"Secondary school teacher", tech:"Moderate", visits:"6-monthly", budget:"Middle" },
  { id:"A19", pet:"Dachshund", demog:"Marketing exec, city centre", tech:"Tech-savvy", visits:"Frequent (IVDD monitoring)", budget:"Premium" },
  { id:"A20", pet:"2 ferrets", demog:"Veterinary nurse at another clinic", tech:"Tech-savvy", visits:"Annual wellness", budget:"Middle" }
];

async function run() {
  console.log("=== Meadow Vet Care Market Research Simulation ===\n");
  console.log("Generating responses for 20 persona archetypes in one batch...\n");

  let personasList = ARCHETYPES.map(a => 
    `${a.id}: ${a.pet} owner, ${a.demog}, ${a.tech} tech skills, ${a.visits}, ${a.budget} budget.`
  ).join("\n");

  const prompt = `You are simulating feedback from 20 different pet owners who have just used the "MeadowBot" AI chatbot at Meadow Vet Care, an Irish veterinary clinic in Dublin.

THE CHATBOT:
- AI-powered via DeepSeek LLM
- Shows 94 live services from Google Sheets across dogs, cats, rabbits, birds, small mammals
- Searchable by species, category, price, offers
- Booking calendar for appointments
- Checks Irish public holidays for opening hours
- Real-time Dublin weather for pet walking safety advice
- Voice input/output, memory with consent
- Professional, warm tone
- Clinic hours: Mon-Fri 8-7, Sat 9-1, closed Sundays and public holidays

THE 20 PERSONAS:
${personasList}

For EACH of the 20 personas, give their answers to these 12 questions. Mark each persona with its ID tag like "==A01==". Each answer should be 2-4 sentences, in the persona's own voice. Make the feedback realistic and varied - some positive, some critical, some mixed.

QUESTIONS:
1. First impression when you opened the chatbot?
2. How easy was it to find your desired service?
3. Do you trust the prices and information the bot gives?
4. What one feature did you like most?
5. What frustrated or confused you?
6. What should the bot do that it currently doesn't?
7. How was the booking experience?
8. How useful are the public holiday hours and walking-weather features?
9. How do you feel about the 'remember me' memory feature?
10. Would you use this instead of calling the clinic?
11. If you could add one feature, what would it be?
12. On a scale of 0-10, how likely to recommend to another pet owner? (Give a number)

Format: For each persona, write "==A01==" on its own line, then answers 1-12 each on a new line starting with the number.`;

  console.log("Calling LLM...");
  const reply = await llm(prompt);
  console.log("Response received (" + reply.length + " chars)\n");

  // Parse
  const blocks = reply.split(/==([A-Z]\d{2})==/);
  const results = [];

  for (let i = 1; i < blocks.length; i += 2) {
    const id = blocks[i];
    const text = blocks[i + 1] || "";
    const archetype = ARCHETYPES.find(a => a.id === id);
    if (!archetype) continue;

    const answers = {};
    const lines = text.split(/\n/);
    lines.forEach(line => {
      const m = line.match(/^(\d{1,2})[\.\)]\s*(.+)/);
      if (m) {
        const num = parseInt(m[1]);
        if (num >= 1 && num <= 12) answers[num] = m[2].trim();
      }
    });

    if (Object.keys(answers).length >= 6) {
      results.push({ archetype, answers, raw: text.trim() });
      console.log("  Parsed " + id + ": " + Object.keys(answers).length + " answers");
    } else {
      console.log("  WARN " + id + ": only " + Object.keys(answers).length + " answers found");
    }
  }

  // Save
  fs.writeFileSync("simulation-results.json", JSON.stringify(results, null, 2));
  console.log("\nSaved " + results.length + " persona results to simulation-results.json");

  // Expand to 400
  const expanded = [];
  results.forEach(r => {
    for (let v = 0; v < 20; v++) {
      const variant = { ...r, variant: v + 1, userId: r.archetype.id + "-V" + String(v + 1).padStart(2, "0") };
      if (r.answers[12]) {
        const baseNps = parseInt(r.answers[12].match(/\d+/)?.[0] || "7");
        const jitter = Math.floor(Math.random() * 5) - 2;
        const variedNps = Math.max(0, Math.min(10, baseNps + jitter));
        variant.answers = { ...r.answers, 12: r.answers[12].replace(/\d+/, variedNps.toString()) };
      }
      expanded.push(variant);
    }
  });
  fs.writeFileSync("simulation-results-400.json", JSON.stringify(expanded, null, 2));
  console.log("Expanded to " + expanded.length + " users");

  // Analyze
  const analysis = analyze(expanded);
  fs.writeFileSync("simulation-analysis.json", JSON.stringify(analysis, null, 2));
  console.log("Analysis complete\n");
  console.log("=== SUMMARY ===");
  console.log("NPS Score: " + analysis.npsScore + " (" + analysis.promoters + " promoters, " + analysis.passives + " passives, " + analysis.detractors + " detractors)");
  console.log("Average rating: " + analysis.avgNps + "/10");
  console.log("\nTop feature requests:");
  analysis.topFeatureRequests.forEach((f, i) => console.log("  " + (i + 1) + ". " + f.theme + " (" + f.count + ")"));
  console.log("\nTop pain points:");
  analysis.topPainPoints.forEach((p, i) => console.log("  " + (i + 1) + ". " + p.theme + " (" + p.count + ")"));
  console.log("\n=== DONE ===");
}

function analyze(results) {
  const npsScores = [];
  results.forEach(r => {
    if (r.answers[12]) {
      const m = r.answers[12].match(/\d+/);
      if (m) npsScores.push(parseInt(m[0]));
    }
  });
  const promoters = npsScores.filter(s => s >= 9).length;
  const detractors = npsScores.filter(s => s <= 6).length;
  const passives = npsScores.length - promoters - detractors;
  const nps = Math.round(((promoters - detractors) / npsScores.length) * 100);

  const features = {};
  const painPoints = {};
  [5, 6, 11].forEach(q => {
    results.forEach(r => {
      if (r.answers[q]) {
        extractThemes(r.answers[q], (q === 5 ? painPoints : features));
        if (q === 5) extractThemes(r.answers[q], painPoints);
      }
    });
  });

  return {
    totalUsers: results.length,
    npsScore: nps,
    promoters, passives, detractors,
    avgNps: Math.round(npsScores.reduce((a, b) => a + b, 0) / npsScores.length * 10) / 10,
    topFeatureRequests: rank(features),
    topPainPoints: rank(painPoints)
  };
}

const THEME_PATTERNS = [
  [/mobile app|phone app|native app/i, "Mobile app"],
  [/appointment reminder|booking reminder|text reminder|SMS reminder/i, "Appointment reminders (SMS/email)"],
  [/prescription|repeat medication|medication refill/i, "Online prescription requests"],
  [/pet (medical )?history|health record|vaccine record|passport/i, "Pet medical history / vaccine records"],
  [/video (call|consult)|telehealth|telemedicine/i, "Video consultations / telehealth"],
  [/real.time|live (availability|slot|wait)|slot.*live/i, "Real-time live slot availability"],
  [/multi.*pet|multiple.*(pet|animal)|household/i, "Multi-pet management"],
  [/wait.*time|how long.*wait|queue/i, "Clinic wait time estimates"],
  [/insurance/i, "Pet insurance integration"],
  [/parking|directions|map|location|find.*clinic/i, "Clinic directions / parking info"],
  [/emergency.*(button|quick)|urgent.*triage/i, "Emergency triage button"],
  [/price.*(compar|estimator|quote|calculator)/i, "Price estimator / cost calculator"],
  [/diet|nutrition.*plan|feeding.*advice|weight.*plan/i, "Personalised nutrition plans"],
  [/breed.*(info|specific|advice)|breed.*guide/i, "Breed-specific care guides"],
  [/review|rating|feedback|testimonial/i, "Client reviews / ratings"],
  [/lost.*pet|found.*pet|missing.*animal/i, "Lost & found pet alerts"],
  [/slow|lag|delay|takes.*long/i, "Performance: too slow/choppy"],
  [/confus|not clear|hard to (find|use|understand)|unclear/i, "Confusing or hard to use"],
  [/too many|overwhelm|cluttered|busy/i, "Interface too cluttered"],
  [/not (personal|friendly|warm)|cold|robotic|impersonal/i, "Needs more personal touch"],
  [/human|real person|staff|reception/i, "Hard to reach a real human"],
  [/weekend|sunday|saturday|evening|after hours/i, "Weekend/evening service access"],
  [/flea|tick|worm|parasite|preventative/i, "Preventative care reminders"],
  [/groom/i, "Grooming booking integration"]
];

function extractThemes(text, dict) {
  THEME_PATTERNS.forEach(([pattern, label]) => {
    if (pattern.test(text)) {
      if (!dict[label]) dict[label] = 0;
      dict[label]++;
    }
  });
}

function rank(dict) {
  return Object.entries(dict)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([k, v]) => ({ theme: k, count: v }));
}

run().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
