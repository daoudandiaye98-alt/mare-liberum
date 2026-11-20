// Mare Liberum · the Briefs: the missing half of every prompt.
// People rarely say everything an agent needs: who it is for, how long, in what form, what "good" means, what to check.
// A brief names the kind of task, lists what the request left out with a sensible default for each, the few questions
// worth asking, a proven method, the quality bar, the usual mistakes, the form of the result and the checks before handing over.
// review() reads a draft against the same bar. Pure functions; agents add tips, which are kept as data, never as instructions.

// what a request may leave out: [how to see it was given, the default when it was not, the question that settles it]
const SLOTS = {
  audience: [/\b(audience|zielgruppe|readers?|leser\w*|customers?|kunden|beginners?|anfänger\w*|experts?|kids|kinder\w*|investors?|investoren|managers?|developers?|entwickler\w*|students?|schüler\w*|studenten|clients?|team|boss|chef\w*|recruiters?|personaler\w*|users?|nutzer\w*)\b/i, 'a smart reader who does not know the subject', 'Who will read or use the result?'],
  goal: [/\b(so that|in order to|damit|goal|ziel\w*|to get|um zu|call to action|cta|purpose|zweck|want them to|sollen)\b/i, 'what the reader should know or do afterwards, stated in one line at the top of your plan', 'What should happen after someone reads or uses it?'],
  length: [/\b\d+\s*(words?|wörter\w*|zeichen|characters?|chars|pages?|seiten|slides?|folien|minutes?|minuten|sentences?|sätze\w*|lines?|zeilen|paragraphs?|absätze\w*)\b|\b(short|long|brief|kurz\w*|lang\w*|ausführlich\w*|one[- ]pager|tweet|headline)\b/i, 'as short as the job allows; state the length you chose', 'How long should it be?'],
  tone: [/\b(formal|informal|casual|friendly|professional|playful|serious|witty|funny|warm|locker\w*|förmlich\w*|freundlich\w*|seriös\w*|humorvoll\w*|sachlich\w*|duzen|siezen|tone|ton|stil|style)\b/i, 'clear, friendly and direct; no hype', 'What tone fits (formal, friendly, playful)?'],
  language: [/\b(english|englisch|german|deutsch|french|französisch|spanish|spanisch|italian|italienisch|turkish|türkisch|arabic|arabisch|in \w+ language|auf \w+)\b/i, 'the language of the request', 'In which language?'],
  format: [/\b(markdown|pdf|docx|word|excel|xlsx|csv|json|html|table|tabelle\w*|bullets?|list|liste|slides?|pptx|deck|email|e-mail|mail|post|thread)\b/i, 'Markdown: a one-line answer first, then short sections with headings', 'In what form should the result come (text, table, file)?'],
  deadline: [/\b(today|tomorrow|tonight|heute|morgen|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|bis (montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)|deadline|frist|asap|urgent|dringend|\d{1,2}\.\d{1,2}\.|\d{4}-\d{2}-\d{2})\b/i, 'no deadline given: finish in one pass now', 'Is there a deadline?'],
  budget: [/(\$|€|£|\beur\b|\busd\b|budget|preis\w*|price|kosten|cost|max(imal)?\.?)\s*\d|\d[\d.,]*\s*(€|\$|£|eur|usd|euro|dollar|k\b)|\b(cheap|günstig\w*|billig\w*|luxury|luxus|premium|budget)\b/i, 'no budget given: show a low, a middle and a high option', 'What may it cost at most?'],
  place: [/\b(in|nach|from|von|to|near|bei|around|um)\s+[A-ZÄÖÜ][a-zäöüß]{2,}|\b(near me|in der nähe|local|lokal\w*|online|remote)\b/, 'no place given: ask, or state the place you assume', 'Where (city, country, online)?'],
  stack: [/\b(python|javascript|typescript|node(\.js)?|react|next\.?js|vue|svelte|angular|java|kotlin|swift|go(lang)?|rust|php|laravel|ruby|rails|sql|postgres\w*|mysql|sqlite|bash|shell|powershell|c\+\+|c#|\.net|django|flask|fastapi|excel|google sheets|r\b)/i, 'the stack the project already uses; if none, the most common one for the job, named up front', 'Which language, framework and versions?'],
  source: [/\b(attached|anbei|beigefügt\w*|below|unten|above|oben|this (text|document|file|article|data|code|page)|diese[nrs]? (text|datei|dokument|artikel|daten|code|seite)|following|folgende\w*|here is|hier ist)\b|https?:\/\/\S+/i, 'no material given: say what you based the work on and mark anything you could not check', 'What material should it be based on?'],
  count: [/\b\d+\s*(ideas?|ideen|options?|optionen|examples?|beispiele?|posts?|items?|punkte?|points?|tips?|tipps?|names?|namen|variants?|varianten|versions?|versionen|questions?|fragen|slides?|folien|days?|tage)\b/i, 'a few strong items rather than many weak ones (3 to 7)', 'How many?'],
  dates: [/\b(\d{1,2}\.\s?\d{1,2}\.?|\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*|(jan|feb|mär|apr|mai|jun|jul|aug|sep|okt|nov|dez)\w*\s+\d|next (week|month|weekend)|nächste[nrs]? (woche|monat|wochenende)|this (week|weekend)|dieses wochenende|weekend|wochenende|\d+\s*(days?|tage|nights?|nächte|weeks?|wochen))\b/i, 'no dates given: ask; until then plan for the next plausible dates and say so', 'Which dates, and how flexible?'],
  people: [/\b\d+\s*(people|persons?|personen|guests?|gäste|adults?|erwachsene|kids|kinder|pax)\b|\b(for two|zu zweit|alone|allein\w*|solo|couple|paar|family|familie\w*|team of)\b/i, 'no group size given: one person; say so', 'For how many people?'],
  level: [/\b(beginner|anfänger\w*|intermediate|fortgeschritten\w*|advanced|expert|experte\w*|eli5|simple|einfach\w*|technical|technisch\w*|level|niveau|klasse \d+|grade \d+)\b/i, 'explain for a curious beginner; offer the expert depth at the end', 'At what level of knowledge?'],
};
const slot = (name, assume, ask) => ({ name, assume, ask });

// the universal bar: true for every kind of work
const UNIVERSAL = [
  'Put the answer or the result first; reasons and details after it.',
  'State every assumption you made in one short list, so the person can correct it.',
  'Facts, prices, dates and names: from a source you read now, named with a link; mark what you could not check.',
  'Compute numbers in code or a tool, never in your head.',
  'No placeholders ([name], TODO, lorem ipsum) in what you hand over.',
  'Answer in the language of the request unless asked otherwise.',
  'End with what was done, what is still open and the one best next step.',
];

// K(kind, title, words that name it (EN|DE), what it needs) — the library of task kinds
const LIB = [];
const K = (kind, title, keys, x) => LIB.push({ kind, title, keys: keys.split('|').map((k) => k.trim().toLowerCase()).filter(Boolean), ...x });

K('cold-email', 'Cold outreach email', 'cold email|outreach|potenzielle kunden|potentielle kunden|neukunden|kunden gewinnen|kundengewinnung|potential customers|potential clients|new customers|leads anschreiben|cold outreach|kaltakquise|akquise|akquisemail|sales email|vertriebsmail|prospecting|prospect|pitch email|reach out to', {
  outcome: 'A short email a stranger reads to the end and answers.',
  slots: [slot('audience', 'one named role at one company; if unknown, write for the decision maker and say so'), slot('goal', 'one small ask: a 15-minute call or a yes/no reply'), slot('length', '80–130 words; subject line under 45 characters'), 'tone', 'language'],
  ask: ['Who exactly receives it (role, company), and why them, why now?', 'What one thing should they do after reading?', 'What proof can be named (a customer, a number, a result)?'],
  steps: ['Find one specific, true reason this person should care now (their site, news, job posts).', 'Write the subject as that reason, not as your product.', 'First line about them; second about the problem; third the result you bring, with proof.', 'One ask that takes under a minute to answer.', 'Write two short follow-ups (day 3, day 8) that add something new each time.'],
  bar: ['Could only have been sent to this person', 'One idea, one ask', 'Readable on a phone without scrolling', 'No claims without proof'],
  pitfalls: ['Opening with yourself ("I am…", "We are a leading…")', 'Three asks at once', 'Attachments or many links in the first mail', 'Fake familiarity ("Hope you are well")', 'Sending to many people without a lawful basis (in the EU, cold B2C email needs consent)'],
  deliver: 'Subject line, the email as plain text, then the two follow-ups.',
  verify: ['Count the words', 'Read it as the recipient: would you answer?', 'Every claim backed by something you can link'],
  need: 'email finder company contacts',
  must: [['a subject line', /^(subject|betreff)\s*:/im], ['one clear ask', /\?|reply|antwort|call|termin|meeting|gespräch/i]],
});
K('email-reply', 'Email or message', 'write an email|schreib eine mail|schreibe eine mail|schreib eine e-mail|schreibe eine e-mail|e-mail an|mail an|email to|message to|nachricht an|reply to|answer this email|respond to|antwort auf|antworte|beantworte|auf die mail|reply email|response email|rückmeldung', {
  w: 0.5, // a general kind: a more specific kind named in the same request wins
  outcome: 'A message that settles the matter in as few rounds as possible.',
  slots: ['source', slot('goal', 'move the thread to a clear next step'), slot('tone', 'match the tone of the message you answer'), slot('length', 'shorter than the message you answer'), 'language'],
  ask: ['What do you want to happen next (agree, decline, propose, ask)?', 'Are there facts or dates the reply must contain?'],
  steps: ['Read the whole thread; list every question that was asked.', 'Answer each question, in order, plainly.', 'Propose the concrete next step with a date or an option to pick.', 'Cut every sentence that does not move the matter.'],
  bar: ['Every question in the thread is answered', 'Exactly one next step', 'Nothing in it the sender already knows'],
  pitfalls: ['Answering only the last question', 'Vague next steps ("let me know")', 'Committing to things the person did not approve'],
  deliver: 'The reply text, ready to send, plus one line on what it commits to.',
  verify: ['Tick off each question from the thread', 'Check names, dates and amounts against the thread'],
  must: [['a concrete next step', /\b(next|nächste|by|bis|on|am|propose|vorschlag|option|termin|date|datum)\b/i]],
});
K('newsletter', 'Newsletter', 'newsletter|mailing|rundmail|mailchimp|substack issue', {
  outcome: 'An issue people open, read and click once.',
  slots: ['audience', slot('goal', 'one main link people should click'), slot('length', '250–500 words'), 'tone', 'language'],
  ask: ['What is the one thing readers should do or remember from this issue?', 'What happened since the last issue that is worth telling?'],
  steps: ['Pick one main story; everything else is short.', 'Write a subject line that promises the main story (under 50 characters).', 'Open with the news, not with a greeting paragraph.', 'One clear button or link for the main story.', 'Close with one line and the way to answer.'],
  bar: ['One main story', 'Scannable in 30 seconds', 'Subject line and preview text written'],
  pitfalls: ['Five equal stories', 'Long intros', 'Images that carry the message (many mail apps block them)', 'Missing unsubscribe link'],
  deliver: 'Subject line, preview text, the issue in Markdown.',
  verify: ['Read it on a phone-width screen', 'Every link works'],
  must: [['a subject line', /^(subject|betreff)\s*:/im]],
});
K('blog-post', 'Article or blog post', 'blog|blogpost|blog post|article|artikel|beitrag|essay|aufsatz|story about|write about|schreibe über|ratgeber|guide to', {
  outcome: 'An article a reader finishes and remembers one idea from.',
  slots: ['audience', slot('goal', 'one idea the reader should take away'), slot('length', '900–1,400 words'), 'tone', 'language', 'source', 'level'],
  ask: ['Who is it for and what should they think or do afterwards?', 'Is there a point of view, experience or data of your own to include?'],
  steps: ['Write the one-sentence idea first.', 'Collect 3–6 facts or examples from sources you read now; keep the links.', 'Outline: hook, the idea, 3 supporting sections, what to do now.', 'Write plainly; one idea per paragraph; examples over adjectives.', 'Title last: specific, with the benefit or the surprise.'],
  bar: ['One idea, stated early', 'Every claim sourced or marked as opinion', 'Concrete examples', 'A title that says what is inside'],
  pitfalls: ['Generic intros ("In today\'s fast-paced world…")', 'Lists of obvious tips', 'Made-up statistics', 'Headings that do not say anything'],
  deliver: 'Title, a 1–2 sentence summary, the article in Markdown with headings, sources at the end.',
  verify: ['Count words', 'Open every source link', 'Read the headings alone: do they tell the story?'],
  need: 'statistics research sources',
  must: [['headings', /^#{1,3}\s|\n[A-Z][^\n]{3,60}\n/m], ['sources', /https?:\/\/|source|quelle/i]],
});
K('social-post', 'Social media post', 'linkedin|tweet|x post|twitter|instagram|caption|tiktok|facebook post|social media|social post|thread|posting|beitrag für', {
  outcome: 'A post that stops the scroll and says one thing.',
  slots: [slot('audience', 'the people who follow the account'), slot('format', 'the platform named, else LinkedIn'), slot('length', 'LinkedIn 600–1,200 characters; X under 280; Instagram caption under 150 words'), 'tone', 'language', 'count'],
  ask: ['Which platform and account?', 'What should people do: comment, click, share, buy?'],
  steps: ['First line: the claim, the number or the story moment (it is all most people see).', 'One idea; short lines; white space.', 'A concrete example or result.', 'End with a question or one clear action.', 'Two or three hashtags at most, only where the platform uses them.'],
  bar: ['The first line works alone', 'Fits the platform\'s length', 'Sounds like a person'],
  pitfalls: ['Emoji walls', 'Engagement bait', 'Links in the first line on LinkedIn', 'Copying the same text to every platform'],
  deliver: 'The post text per platform, ready to paste, with the character count.',
  verify: ['Count characters', 'Read only the first line: would you stop?'],
});
K('product-description', 'Product description or listing', 'product description|produktbeschreibung|listing|amazon listing|etsy|shopify product|produkttext|artikelbeschreibung', {
  outcome: 'A description that answers every question before a buyer asks it.',
  slots: [slot('audience', 'the typical buyer of this product'), 'source', slot('length', 'title under 80 characters; 5 bullet points; 100–200 words of text'), 'tone', 'language'],
  ask: ['What are the exact specs (size, material, weight, contents)?', 'Who buys it and what problem does it solve for them?'],
  steps: ['List the facts: specs, contents, care, shipping.', 'Turn each key feature into what it does for the buyer.', 'Title: product type + main feature + key spec, in the words buyers search.', 'Bullets: benefit first, then the fact.', 'Answer the top 3 doubts (size, quality, returns).'],
  bar: ['Every spec correct', 'Words buyers search for', 'No claims the product cannot prove'],
  pitfalls: ['"High quality" without saying why', 'Missing measurements', 'Keyword stuffing', 'Health or green claims without proof'],
  deliver: 'Title, 5 bullet points, description, a list of search keywords.',
  verify: ['Check every number against the source', 'Search the title words on the marketplace'],
  need: 'marketplace seller',
});
K('landing-page', 'Landing page or website copy', 'landing page|landingpage|website copy|webseite|homepage text|hero section|sales page|verkaufsseite|startseite|website text|seitentext', {
  outcome: 'A page where the right visitor knows in five seconds what it is and what to do.',
  slots: [slot('audience', 'one primary visitor type'), slot('goal', 'one primary action (sign up, buy, book)'), 'tone', 'language', 'source'],
  ask: ['Who is the visitor and where do they come from (ad, search, link)?', 'What one action should they take?', 'What proof exists (customers, numbers, reviews you may show)?'],
  steps: ['Hero: what it is, for whom, the result — and one button.', 'Problem in the visitor\'s words.', 'How it works in 3 steps.', 'Proof next to the claims it supports.', 'Answer objections (price, risk, effort) in a short FAQ.', 'Repeat the one action at the end.'],
  bar: ['Five-second test passes', 'One primary action, named the same everywhere', 'Every claim has proof nearby', 'Legal pages linked (imprint and privacy in the EU)'],
  pitfalls: ['Two equal buttons', 'Clever headlines that hide what it is', 'Invented reviews or numbers', 'Walls of features'],
  deliver: 'Copy section by section (hero, problem, how, proof, FAQ, close) with notes for images.',
  verify: ['Show only the hero: can someone say what it is and for whom?', 'Is every number real?'],
});
K('press-release', 'Press release', 'press release|pressemitteilung|pressetext|media release|announcement|ankündigung', {
  outcome: 'A release a journalist can turn into a story without calling you.',
  slots: ['audience', 'source', slot('length', '300–500 words'), 'language', 'dates'],
  ask: ['What is the news, in one sentence, and why does it matter now?', 'Who can be quoted (name, role)?'],
  steps: ['Headline: the news, active voice.', 'First paragraph: who, what, when, where, why.', 'A quote that adds opinion, not facts.', 'Details and numbers.', 'About section and press contact.'],
  bar: ['News in the first sentence', 'Every fact checkable', 'Contact given'],
  pitfalls: ['Superlatives', 'Burying the news', 'Quotes that repeat the facts'],
  deliver: 'Headline, subhead, dateline, body, quote, boilerplate, contact.',
  verify: ['Dates and names correct', 'Read only the first paragraph: is the story there?'],
});
K('summary', 'Summary of a text, document or meeting', 'summary|summarize|summarise|zusammenfassung|fasse zusammen|zusammenfassen|tl;dr|tldr|recap|key points|kernaussagen|digest', {
  outcome: 'The few points that matter, so nobody has to read the original.',
  slots: ['source', slot('audience', 'someone who will act on it'), slot('length', 'one line, then 3–7 bullets'), 'format', 'language'],
  ask: ['For whom and for what decision is the summary?'],
  steps: ['Read everything once without writing.', 'Write the one-line gist.', 'List decisions, numbers, dates, owners and open questions.', 'Keep the author\'s claims as claims ("the report says…").', 'Add what is missing or contradictory.'],
  bar: ['Faithful: nothing added, nothing distorted', 'Decisions and actions stand out', 'Much shorter than the original'],
  pitfalls: ['Summarising the introduction only', 'Losing numbers and dates', 'Mixing your opinion into the summary'],
  deliver: 'Gist line, bullets, then "Actions" and "Open questions".',
  verify: ['Each bullet traceable to a place in the source', 'Numbers copied exactly'],
  must: [['bullets or short points', /^\s*([-*•]|\d+\.)\s/m]],
});
K('meeting-notes', 'Meeting notes and minutes', 'meeting notes|protokoll|minutes|besprechung|meeting summary|call notes|gesprächsnotiz|transcript', {
  outcome: 'Notes from which everyone knows what was decided and who does what by when.',
  slots: ['source', 'audience', 'format', 'language'],
  ask: ['Who attended and who gets the notes?'],
  steps: ['Header: date, attendees, purpose.', 'Decisions, each in one line.', 'Actions: owner, task, date.', 'Open questions.', 'Short discussion notes only where they explain a decision.'],
  bar: ['Every action has an owner and a date', 'Decisions are explicit'],
  pitfalls: ['A transcript instead of notes', 'Actions without owners'],
  deliver: 'Markdown: Decisions, Actions (table), Open questions, Notes.',
  verify: ['Every action has owner + date'],
  must: [['actions with owners', /owner|verantwortlich|who|wer|@|\|/i]],
});
K('report', 'Report or analysis document', 'report|bericht|analysis report|analyse|whitepaper|white paper|status report|statusbericht|quarterly|quartalsbericht|findings', {
  outcome: 'A document a decision-maker can act on after reading the first page.',
  slots: ['audience', slot('goal', 'the decision the report should support'), 'source', 'length', 'format', 'language'],
  ask: ['What decision should this report support, and for whom?', 'What data or sources must it use?'],
  steps: ['Write the conclusion and recommendation first (executive summary).', 'Gather data; record each source with date.', 'One section per question the reader has.', 'Charts only where a number pattern matters; label units.', 'Risks, limits and what would change the conclusion.'],
  bar: ['Recommendation on page one', 'Every number sourced and computed', 'Limits stated'],
  pitfalls: ['Data dumps without a conclusion', 'Charts without units', 'Hiding uncertainty'],
  deliver: 'Executive summary, sections, appendix with data and sources.',
  verify: ['Recompute every number', 'Read the summary alone: is the decision clear?'],
  must: [['a summary or conclusion up front', /summary|zusammenfassung|conclusion|fazit|recommend|empfehl/i]],
});
K('research', 'Research and fact-finding', 'research|recherche|recherchiere|find out|finde heraus|look up|investigate|untersuche|what is the best|which is better|compare|vergleiche|vergleich|überblick|overview of', {
  outcome: 'An answer built only on sources read now, with the evidence shown.',
  slots: [slot('goal', 'the decision or question the research serves'), 'source', 'place', 'dates', 'format', 'language'],
  ask: ['What decision will this research feed?', 'How recent must the information be?'],
  steps: ['Turn the request into 3–6 precise questions.', 'Search each separately; prefer primary sources (official sites, papers, filings).', 'Read the pages, not only the snippets; note date and author.', 'Where sources disagree, say so and why.', 'Answer each question; give confidence per answer.'],
  bar: ['Every claim linked to a source read now', 'Dates on time-sensitive facts', 'Disagreements shown, not hidden', 'Clear answer, then evidence'],
  pitfalls: ['Answering from memory', 'One source only', 'Treating ads, forums or SEO pages as facts', 'Old data presented as current'],
  deliver: 'Answer first, then findings per question with sources, then open points.',
  verify: ['Open every link again', 'Check that each fact appears in its source'],
  need: 'official statistics database',
  must: [['sources with links', /https?:\/\//i]],
});
K('market-research', 'Market or competitor analysis', 'market research|marktanalyse|marktforschung|competitor|wettbewerb\w*|konkurrenz\w*|competitive analysis|market size|marktgröße|tam|sam som|industry analysis|branchenanalyse', {
  outcome: 'A clear picture of a market: who buys, who sells, at what price, where the gap is.',
  slots: [slot('place', 'the country of the request, else the EU and the US'), 'source', 'goal', 'format', 'language'],
  ask: ['Which market exactly (product, customer, region)?', 'What will you decide with it (enter, price, position)?'],
  steps: ['Define the market in one sentence (who buys what, where).', 'List 5–10 competitors with price, offer, audience, strength — from their own sites.', 'Size the market bottom-up (buyers × price), and cite any top-down figure.', 'Map gaps: needs nobody serves well.', 'Recommend with the reasons and risks.'],
  bar: ['Competitor facts from their own pages, dated', 'Market size computed and its inputs shown', 'A recommendation, not only a list'],
  pitfalls: ['Quoting one market-size report without method', 'Ignoring indirect competitors', 'Mixing regions'],
  deliver: 'Summary, competitor table, market size with the math, gaps, recommendation, sources.',
  verify: ['Recompute the market size', 'Spot-check three competitor prices'],
  need: 'company database startup funding',
});
K('fact-check', 'Fact check', 'fact check|faktencheck|is it true|stimmt es|stimmt das|verify claim|überprüfe|true or false|wahr oder falsch|hoax|fake news', {
  outcome: 'A verdict on a claim with the evidence that decides it.',
  slots: ['source', 'dates', 'language'],
  ask: ['Where does the claim come from (link, quote)?'],
  steps: ['State the exact claim, in its original wording.', 'Find the primary source (study, official data, original quote).', 'Check context: date, place, what was measured.', 'Look for the strongest evidence on both sides.', 'Verdict: true, mostly true, misleading, false, unproven — with reasons.'],
  bar: ['Primary sources', 'The exact claim is what was checked', 'Verdict matches the evidence strength'],
  pitfalls: ['Checking a weaker version of the claim', 'Citing other fact-checkers only', 'Ignoring the date of the claim'],
  deliver: 'Claim, verdict, three-sentence explanation, sources.',
  verify: ['Primary source opened and quoted correctly'],
  must: [['a verdict', /\b(true|false|misleading|unproven|wahr|falsch|irreführend|unbelegt)\b/i], ['sources', /https?:\/\//i]],
});
K('data-analysis', 'Data analysis', 'analyze data|analyse data|analysiere|daten analysieren|data analysis|datenanalyse|statistics|statistik|dataset|datensatz|csv|spreadsheet analysis|insights from|trend|kpi|metrics|kennzahlen', {
  outcome: 'Answers from the data, with the numbers computed and the method visible.',
  slots: ['source', slot('goal', 'the question the analysis must answer'), 'format', 'stack', 'language'],
  ask: ['Which question should the data answer?', 'What does each column mean, and are there known gaps?'],
  steps: ['Load the data in code; print shape, columns, types, missing values.', 'Clean: duplicates, units, dates, outliers — and log each change.', 'Answer the question with the simplest valid method.', 'Check the result another way (a second method or a sanity total).', 'Chart only what supports the answer; label axes and units.'],
  bar: ['All numbers computed in code', 'Cleaning steps listed', 'Caveats (sample size, missing data, correlation vs cause)'],
  pitfalls: ['Eyeballing numbers', 'Silent row drops', 'Claiming causes from correlations', 'Charts without units'],
  deliver: 'Answer, key numbers, chart(s), method and caveats, the code.',
  verify: ['Row counts before and after cleaning', 'Totals match the source'],
  must: [['numbers', /\d/]],
});
K('spreadsheet', 'Spreadsheet, budget or financial model', 'spreadsheet|excel|google sheets|tabelle|budget|haushaltsbuch|kalkulation|financial model|finanzplan|forecast|prognose|cash flow|businessplan zahlen|break-even|rentabilität', {
  outcome: 'A sheet where every number traces back to an input and a formula.',
  slots: ['source', slot('format', 'a sheet with an Inputs tab, a Calculations tab and a Summary tab'), 'dates', 'budget', 'language'],
  ask: ['What are the inputs you know (prices, volumes, costs, dates)?', 'Which question must the summary answer?'],
  steps: ['Inputs in one place, labelled with units and source.', 'Formulas only reference inputs or other formulas — no typed results.', 'Scenarios: low, base, high.', 'A summary that answers the question in one row or chart.', 'Check: totals, signs, units, dates.'],
  bar: ['No hard-coded numbers in formulas', 'Units on every column', 'Scenarios'],
  pitfalls: ['Typed totals', 'Mixed units (net/gross, months/years)', 'Circular references'],
  deliver: 'The workbook (.xlsx or sheet), plus a one-paragraph reading of the result.',
  verify: ['Change one input: does everything move as expected?'],
});
K('presentation', 'Presentation or slide deck', 'presentation|präsentation|slides|folien|deck|pitch deck|keynote|powerpoint|vortrag|talk', {
  outcome: 'A deck that makes one argument, one slide at a time.',
  slots: ['audience', slot('goal', 'the one thing the audience should agree to'), slot('length', 'one slide per minute of talk; 10–12 slides'), 'format', 'language'],
  ask: ['Who is in the room and what should they decide or remember?', 'How many minutes?'],
  steps: ['Write the argument as slide titles first (each title a full sentence).', 'One message per slide; the body proves the title.', 'Numbers as charts, with the takeaway in the title.', 'Speaker notes carry the detail.', 'End with the ask.'],
  bar: ['Titles alone tell the story', 'No slide with more than ~30 words of body', 'A clear ask'],
  pitfalls: ['Topic titles ("Market")', 'Text-wall slides', 'Charts that need explanation'],
  deliver: 'Slide titles, slide content, speaker notes (or the deck file).',
  verify: ['Read only the titles: is the argument complete?'],
});
K('code-feature', 'Write code or build a feature', 'write code|build a|implement|implementiere|programmiere|code for|feature|function that|funktion die|app that|tool that|script that|skript|component|komponente|endpoint|api for|website for|bot that|programm', {
  outcome: 'Working code that does the job, runs, and is checked.',
  slots: ['stack', 'source', slot('goal', 'the behaviour, as input → output examples'), slot('format', 'the files changed, the command to run, the test'), 'level'],
  ask: ['What should it do — 2–3 example inputs and the expected outputs?', 'Which stack, versions and existing code must it fit?', 'Where will it run?'],
  steps: ['Read the existing code and conventions first.', 'Write the examples as tests before the code.', 'Implement the smallest thing that passes.', 'Handle errors and edge cases (empty, huge, malformed, offline).', 'Run it; run the tests; read the output.'],
  bar: ['It ran — with the command and output shown', 'Tests cover the examples and an edge case', 'Follows the project\'s style', 'No secrets in code'],
  pitfalls: ['Code never executed', 'Inventing APIs or package versions', 'Rewriting code that worked', 'Swallowed errors'],
  deliver: 'The diff or files, how to run it, the test output.',
  verify: ['Run it', 'Run the tests', 'Check the API docs for every call you used'],
  need: 'api documentation',
  must: [['code', /```|\b(function|def |class |const |import |return)\b/]],
});
K('bug-fix', 'Fix a bug', 'bug|fix|fehler|error|exception|crash|stürzt ab|doesn\'t work|does not work|funktioniert nicht|geht nicht|broken|kaputt|stack trace|traceback|debug', {
  outcome: 'The cause found, the bug fixed, and proof it stays fixed.',
  slots: ['source', 'stack', slot('goal', 'the expected behaviour, stated next to the actual one')],
  ask: ['What exactly happens, and what should happen?', 'The full error message and how to reproduce it?'],
  steps: ['Reproduce it first; write the exact steps.', 'Read the full error and trace; find the first wrong value.', 'Name the cause before changing code.', 'Fix the cause, not the symptom.', 'Add a test that failed before and passes now; run the rest.'],
  bar: ['Cause named', 'Reproduced, then shown fixed', 'A regression test'],
  pitfalls: ['Guessing fixes', 'Catching and hiding the error', 'Fixing one call site of a shared bug'],
  deliver: 'Cause in one sentence, the fix, the test, the run output.',
  verify: ['The reproduction steps now pass', 'Full test suite passes'],
});
K('code-review', 'Code review', 'code review|review this code|review my code|pull request|pr review|überprüfe den code|code prüfen|audit code|security review', {
  outcome: 'The few findings that matter, each with where, why and how to fix.',
  slots: ['source', 'stack', slot('goal', 'correctness and security first, then clarity')],
  ask: ['What is the change supposed to do?'],
  steps: ['Understand the intent of the change.', 'Correctness: edge cases, errors, concurrency, data loss.', 'Security: input handling, secrets, auth, injection.', 'Clarity and tests.', 'Rank findings by severity; skip taste-only nits unless asked.'],
  bar: ['Each finding has file, line, failure scenario and fix', 'Severity ranked', 'No invented issues'],
  pitfalls: ['Style nits drowning real bugs', 'Findings without a concrete failure case'],
  deliver: 'Findings list, most severe first.',
  verify: ['Each finding reproduced or reasoned through concretely'],
});
K('tests', 'Write tests', 'write tests|unit test|tests for|testfälle|test cases|teste|integration test|e2e|test coverage', {
  outcome: 'Tests that would fail if the behaviour broke.',
  slots: ['source', 'stack'],
  ask: ['Which behaviour matters most, and what test framework does the project use?'],
  steps: ['List behaviours: normal, edge, error.', 'One test per behaviour, named after it.', 'Arrange–act–assert; no logic in tests.', 'Run them; break the code on purpose once to see a test fail.'],
  bar: ['They fail when the behaviour breaks', 'They run fast and alone'],
  pitfalls: ['Testing implementation details', 'Assertions that always pass'],
  deliver: 'Test files and the run output.',
  verify: ['Run; mutate the code once; see the failure'],
});
K('sql', 'SQL query or database work', 'sql|query|abfrage|database|datenbank|postgres|mysql|sqlite|bigquery|select from|join tables|schema|migration', {
  outcome: 'A correct query, checked against the real schema and data.',
  slots: ['stack', 'source', slot('goal', 'the question the query answers, in words')],
  ask: ['Which database and which tables/columns exist?', 'What should the result look like (one row per what)?'],
  steps: ['Read the schema; do not guess column names.', 'Write the query step by step (CTEs).', 'Check row counts at each step; watch joins that duplicate rows.', 'Handle NULLs and time zones.', 'For changes: run in a transaction, show what changes before committing.'],
  bar: ['Runs against the real schema', 'Row-count sanity checked', 'Destructive statements guarded'],
  pitfalls: ['Fan-out joins', 'Ignoring NULLs', 'UPDATE/DELETE without WHERE'],
  deliver: 'The query, a sample of the result, the row count.',
  verify: ['Run it; compare counts with a simple query'],
});
K('automation', 'Automation or workflow', 'automate|automatisiere|automation|automatisierung|workflow|zapier|make.com|n8n|cron|schedule|zeitplan|every day|jeden tag|integration|webhook|sync', {
  outcome: 'A process that runs by itself, safely, and says when it fails.',
  slots: ['stack', slot('goal', 'trigger → steps → result, written as one line'), 'deadline'],
  ask: ['What triggers it, what should happen, and how often?', 'Which accounts or tools are involved?'],
  steps: ['Write the flow as trigger → steps → output.', 'Do one manual run first.', 'Add error handling and a notification on failure.', 'Make it safe to run twice (idempotent).', 'Schedule it; watch the first runs.'],
  bar: ['Runs unattended', 'Failures are reported', 'Re-running does no harm'],
  pitfalls: ['Silent failures', 'Credentials in the workflow text', 'Duplicates on retries'],
  deliver: 'The workflow (config or code), how to switch it off, the first run log.',
  verify: ['A real run with real data', 'A forced failure sends the alert'],
});
K('scraping', 'Extract data from websites', 'scrape|scraping|crawl|extract data|daten extrahieren|daten auslesen|from website|von der webseite|collect data|sammle daten|price monitoring|preisüberwachung', {
  outcome: 'Clean, structured data from public pages, gathered politely.',
  slots: ['source', 'format', slot('count', 'the number of pages or items needed')],
  ask: ['Which sites and which fields exactly?', 'How often, and for what use?'],
  steps: ['Check for an API, feed, sitemap or search link first (the Atlas map of the site shows them).', 'Read robots.txt and the terms; respect them.', 'Fetch slowly; cache; identify your agent.', 'Parse into a fixed schema; validate every row.', 'Record source URL and time per row.'],
  bar: ['Allowed by robots.txt and terms', 'Schema-valid rows', 'Source and time per row'],
  pitfalls: ['Scraping what an API gives cleanly', 'Hammering a site', 'Personal data without a lawful basis'],
  deliver: 'Data file (CSV/JSON), schema, a log of sources.',
  verify: ['Spot-check 5 rows against the live page'],
});
K('translation', 'Translation or localization', 'translate|übersetze|übersetzung|translation|localize|lokalisier\w*|in english|ins englische|ins deutsche|auf englisch|auf deutsch', {
  outcome: 'A text that reads as if written in the target language.',
  slots: ['source', slot('language', 'the target language named; if unclear, ask'), 'audience', 'tone'],
  ask: ['Into which language and for which country (de-DE, de-AT, en-US, en-GB)?', 'Formal or informal address (Sie/du, vous/tu)?'],
  steps: ['Read the whole text first.', 'Keep meaning, tone and register; adapt idioms.', 'Keep names, numbers, links, code and formatting intact.', 'Adapt units, dates, currency only if asked.', 'Read the result alone, as a native reader.'],
  bar: ['Meaning complete', 'Natural, not literal', 'Numbers and names untouched'],
  pitfalls: ['Word-by-word translation', 'Translating names or code', 'Mixed formal/informal address'],
  deliver: 'The translation, plus notes on any choice the reader should know.',
  verify: ['Compare paragraph count and numbers with the source'],
});
K('editing', 'Edit, proofread or improve a text', 'proofread|korrektur|korrigiere|edit|redigiere|überarbeite|improve this text|verbessere|rewrite|umschreiben|formuliere um|kürze|shorten|polish|lektorat', {
  outcome: 'The same message, clearer and correct, in the author\'s voice.',
  slots: ['source', slot('goal', 'clarity and correctness; keep the author\'s voice and meaning'), 'tone', 'length', 'language'],
  ask: ['Light proofreading, or deeper rewriting allowed?'],
  steps: ['Read it all first; note the message.', 'Fix errors (spelling, grammar, facts you can check).', 'Cut repetition and filler; shorten long sentences.', 'Keep the author\'s voice and terms.', 'List the significant changes.'],
  bar: ['Meaning unchanged', 'Errors fixed', 'Voice kept'],
  pitfalls: ['Rewriting into your own style', 'Changing facts', 'Silent big changes'],
  deliver: 'The edited text and a short list of changes (or a tracked version).',
  verify: ['Diff against the original: nothing important lost'],
});
K('cv', 'CV or resume', 'cv|resume|résumé|lebenslauf|curriculum vitae', {
  outcome: 'A CV that gets the interview for one kind of job.',
  slots: [slot('goal', 'the target role (one job ad if possible)'), 'source', slot('length', '1 page (2 at most with 10+ years of experience)'), 'language', 'format'],
  ask: ['Which role or job ad is it for?', 'What are your results with numbers (sales, savings, users, grades)?'],
  steps: ['Match the job ad: list its 6–8 must-haves.', 'For each role: results, not duties ("cut costs 18%").', 'Order by relevance to the target role.', 'Skills section with the ad\'s words (for screening systems).', 'Clean layout; no photo unless the country expects it (often in DE).'],
  bar: ['Results with numbers', 'Fits the target role', 'Readable by screening systems'],
  pitfalls: ['Duty lists', 'Unprovable claims', 'Fancy layouts that break parsing'],
  deliver: 'The CV text in sections (or the file), plus 3 tailoring notes.',
  verify: ['Every must-have of the ad appears', 'Dates consistent'],
  need: 'job board',
});
K('cover-letter', 'Cover letter or application', 'cover letter|anschreiben|bewerbung|bewerbungsschreiben|motivationsschreiben|motivation letter|application letter', {
  outcome: 'A letter that shows why you, for this job, at this company.',
  slots: [slot('goal', 'the specific job ad'), 'source', slot('length', '250–350 words, one page'), 'tone', 'language'],
  ask: ['Which job ad (link or text)?', 'Which 2–3 experiences fit it best?'],
  steps: ['Read the ad and the company site; pick their 3 top needs.', 'Opening: the role and one strong reason you fit.', 'Two paragraphs: one proof each for their needs.', 'Why this company (specific, true).', 'Close: availability, ask for the interview.'],
  bar: ['Specific to company and role', 'Proof, not adjectives', 'One page'],
  pitfalls: ['Repeating the CV', 'Generic praise of the company', '"Hiermit bewerbe ich mich…" openings'],
  deliver: 'The letter, ready to send.',
  verify: ['Company and role names correct', 'Word count'],
});
K('trip-plan', 'Trip plan or itinerary', 'trip|reise|reisen|itinerary|reiseplan|vacation|urlaub|holiday|travel plan|städtereise|weekend in|wochenende in|road trip|backpacking|sightseeing', {
  outcome: 'A plan that fits the days, the people and the budget, with real places that are open.',
  slots: ['place', 'dates', 'people', 'budget', slot('goal', 'the kind of trip (relaxed, culture, food, nature, nightlife)'), 'language'],
  ask: ['Where and when (dates, how flexible)?', 'Who travels, and what do they love or avoid?', 'Budget per person?'],
  steps: ['Fix the frame: dates, arrival/departure times, base location.', 'Pick 2–3 anchors per day, grouped by area.', 'Check opening hours and booking needs for each.', 'Add travel times and a rest block.', 'Book-ahead list with links and prices.'],
  bar: ['Places verified open on those dates', 'Realistic travel times', 'Fits budget and pace'],
  pitfalls: ['Cramming', 'Closed places (Mondays, holidays)', 'Prices from memory'],
  deliver: 'Day-by-day plan, map links, a booking list, cost estimate.',
  verify: ['Opening hours checked on each place\'s own site'],
  need: 'train tickets hotel booking',
});
K('travel-booking', 'Book travel (flights, trains, hotels)', 'book a flight|flug buchen|flight|flug|flüge|train ticket|zugticket|bahnticket|hotel|unterkunft|airbnb|rental car|mietwagen|bus ticket|fähre|ferry', {
  outcome: 'The best option found and laid out for a yes — nothing paid without approval.',
  slots: ['place', 'dates', 'people', 'budget', slot('goal', 'what matters most: price, time, flexibility or comfort')],
  ask: ['From where to where, which dates and times, how flexible?', 'How many travellers, luggage, any cards or loyalty programmes?', 'Price limit and what matters most?'],
  steps: ['Search the operators\' own sites and one comparison site.', 'Compare total price (fees, luggage, seats) and conditions (refund, change).', 'Shortlist 3: cheapest, fastest, best value.', 'Show the choice with links; book only after explicit approval.'],
  bar: ['Total prices including fees', 'Conditions stated', 'Explicit approval before paying'],
  pitfalls: ['Base fares without fees', 'Ignoring transfer times', 'Paying without confirmation'],
  deliver: 'A comparison of 3 options with links, then the booking after a yes.',
  verify: ['Price and times re-checked right before booking'],
  need: 'train tickets flights hotel',
});
K('shopping', 'Buy something or compare products', 'buy|kaufen|kaufe|purchase|bestellen|which laptop|which phone|best price|bestpreis|cheapest|günstigste|gift|geschenk|recommend a product|produktempfehlung|online shop|onlineshop', {
  outcome: 'The right product at a fair price, from a trustworthy seller — bought only after a yes.',
  slots: ['budget', slot('goal', 'the use it is for and the one feature that matters most'), 'place', 'dates'],
  ask: ['What will it be used for, and what matters most?', 'Budget and delivery date?'],
  steps: ['Turn the use into 3–5 requirements.', 'Find candidates from independent reviews and the makers\' spec pages.', 'Compare price incl. shipping across 2–3 trustworthy shops.', 'Check the shop (imprint, returns, reviews).', 'Present a pick plus an alternative; buy only after a yes.'],
  bar: ['Requirements met', 'Total price compared', 'Seller checked', 'Explicit approval'],
  pitfalls: ['Sponsored "best of" lists as truth', 'Fake shops', 'Ignoring return terms'],
  deliver: 'Pick, alternative, price comparison with links.',
  verify: ['Price and stock re-checked', 'Shop has an imprint and return policy'],
  need: 'online shop',
});
K('event-plan', 'Plan an event', 'event|veranstaltung|party|feier|wedding|hochzeit|birthday|geburtstag|conference|konferenz|workshop|team event|teamevent|firmenfeier|meetup', {
  outcome: 'An event plan with venue, timeline, budget and a task list with owners.',
  slots: ['dates', 'people', 'place', 'budget', slot('goal', 'the purpose and the feel of the event')],
  ask: ['Date, number of guests, place and budget?', 'What should guests experience or take away?'],
  steps: ['Fix purpose, date, size, budget.', 'Shortlist venues with capacity, price, availability.', 'Run-of-show timeline.', 'Budget table (venue, food, tech, extras, 10% buffer).', 'Task list with owners and dates; invitations.'],
  bar: ['Venue availability confirmed', 'Budget with buffer', 'Every task has an owner and date'],
  pitfalls: ['Booking late', 'Forgetting accessibility and dietary needs'],
  deliver: 'Plan, timeline, budget, task list.',
  verify: ['Totals add up', 'Venue confirmed in writing'],
});
K('project-plan', 'Project plan or roadmap', 'project plan|projektplan|roadmap|plan for|plan für|milestones|meilensteine|timeline|zeitplan|launch plan|go-to-market|strategie|strategy|okr|businessplan|business plan', {
  outcome: 'A plan anyone on the team can execute: goals, steps, owners, dates, risks.',
  slots: [slot('goal', 'one measurable goal with a date'), 'deadline', 'budget', 'audience', 'format'],
  ask: ['What is the goal, measured how, by when?', 'Who is available and what are the constraints (money, time, tools)?'],
  steps: ['Goal and success measure.', 'Work backwards: milestones with dates.', 'Tasks per milestone with owners and dependencies.', 'Risks with a mitigation each.', 'First three actions for this week.'],
  bar: ['Measurable goal', 'Owners and dates', 'Risks named', 'A first step for today'],
  pitfalls: ['Activities without outcomes', 'No owners', 'Ignoring dependencies'],
  deliver: 'Goal, milestone table, task list, risks, next three actions.',
  verify: ['Dates add up; nothing depends on a later task'],
});
K('decision', 'Make a decision or compare options', 'should i|soll ich|decide|entscheid\w*|pros and cons|vor- und nachteile|vorteile und nachteile|option a or b|which option|welche option|choose between|wählen zwischen|trade-off', {
  outcome: 'A recommendation with the reasons, the risks, and what would change it.',
  slots: [slot('goal', 'what a good outcome looks like for the person'), 'budget', 'deadline', 'source'],
  ask: ['What matters most to you (rank 3 criteria)?', 'What can be undone later, and what not?'],
  steps: ['List the options (add one nobody named, if there is one).', 'Pick 3–5 criteria with weights from what the person said.', 'Score each option with facts, not impressions.', 'Name the irreversible parts and the worst case.', 'Recommend; say what new fact would flip it.'],
  bar: ['Criteria from the person, not invented', 'Facts sourced', 'Reversibility considered', 'A clear recommendation'],
  pitfalls: ['A list of pros and cons without a decision', 'Hidden assumptions', 'Advice outside your competence (legal, medical, financial) without a pointer to a professional'],
  deliver: 'Recommendation first, then a comparison table, risks, the flip condition.',
  verify: ['Scores traceable to facts'],
});
K('explain', 'Explain or teach something', 'explain|erkläre|erklär|what happens|was passiert|why do|why does|warum|wieso|how does|wie funktioniert|what is|was ist|teach me|bring mir bei|lerne|tutorial|eli5|understand|verstehen|lesson|lektion|nachhilfe', {
  outcome: 'Understanding that lasts: the idea, an example, and a way to check it.',
  slots: ['level', 'audience', 'length', 'language'],
  ask: ['What do you already know about it, and why do you want to know?'],
  steps: ['Start with the one-sentence idea.', 'One concrete example or analogy.', 'Then the mechanism, step by step.', 'Common misunderstandings.', 'Two questions the learner can answer to check themselves.'],
  bar: ['Correct', 'Right level', 'Example before abstraction'],
  pitfalls: ['Jargon without definitions', 'Analogies that mislead', 'Too much at once'],
  deliver: 'Explanation, example, misconceptions, check questions.',
  verify: ['Technical claims checked against a reliable source'],
});
K('study-plan', 'Learning or exam plan', 'study plan|lernplan|exam|exams|prüfung|klausur|abitur|test prep|vorbereitung auf|lernen für|curriculum|lehrplan|course outline|heilpraktiker', {
  outcome: 'A schedule that covers the material and builds recall before the date.',
  slots: ['dates', 'level', 'source', slot('goal', 'the exam or skill and the target result')],
  ask: ['Which exam or skill, by when, and how many hours per week?', 'What do you know already, what is weakest?'],
  steps: ['List the topics with weight and current level.', 'Spread them over the weeks; weakest and heaviest first.', 'Active recall and spaced repetition, not rereading.', 'Practice tests every 1–2 weeks.', 'Buffer week before the exam.'],
  bar: ['Covers all topics', 'Realistic hours', 'Built-in testing'],
  pitfalls: ['Rereading as studying', 'No buffer', 'Ignoring the exam format'],
  deliver: 'Week-by-week plan, daily routine, resources.',
  verify: ['Hours per week match what the person has'],
});
K('recipe', 'Recipe or meal plan', 'recipe|rezept|meal plan|essensplan|wochenplan essen|cook|kochen|backen|bake|dinner|abendessen|lunch|mittagessen|meal prep', {
  outcome: 'A dish or plan that works the first time with what the person has.',
  slots: ['people', slot('budget', 'everyday ingredients'), slot('level', 'a home cook'), slot('goal', 'diet, allergies and dislikes, if any'), 'language'],
  ask: ['For how many, and any allergies, diets or dislikes?', 'Time and equipment available?'],
  steps: ['Ingredients with exact amounts and units.', 'Steps in order, with times and temperatures.', 'Signs of doneness.', 'Swaps for common gaps.', 'Shopping list grouped by aisle.'],
  bar: ['Exact amounts', 'Times and temperatures', 'Allergies respected'],
  pitfalls: ['Vague amounts', 'Missing oven temperature', 'Ignoring stated allergies'],
  deliver: 'Recipe card (ingredients, steps, times), shopping list.',
  verify: ['Amounts scale correctly for the servings'],
});
K('image-prompt', 'Image or AI art prompt', 'image prompt|bild prompt|midjourney|dall-e|dalle|stable diffusion|flux|ai art|ki-bild|ki bild|generate an image|generiere ein bild|illustration|logo idea|poster design|thumbnail|visual for', {
  outcome: 'An image that matches the intent on the first or second try.',
  slots: [slot('goal', 'where the image will be used (size, aspect ratio)'), slot('tone', 'the mood and style in named terms (photo, flat illustration, watercolour…)'), 'format', 'count'],
  ask: ['Where will it be used (format, aspect ratio, text on it)?', 'Style references (era, medium, artist-free descriptions)?'],
  steps: ['Subject first: who/what, doing what, where.', 'Composition: framing, angle, focus.', 'Style: medium, lighting, colour palette, mood.', 'Technical: aspect ratio, resolution; negative prompt for what to avoid.', 'Make 3–4 variations; change one variable at a time.'],
  bar: ['Subject, composition, style, technical all specified', 'No real people or protected characters without rights', 'Aspect ratio fits the use'],
  pitfalls: ['Adjective soup', 'Text in images (models garble it — add text later)', 'Copying a living artist\'s style or a trademark'],
  deliver: 'The prompt, a negative prompt, aspect ratio, 2 variations.',
  verify: ['Look at the result at the size it will be used'],
  need: 'image generation',
});
K('video-script', 'Video or podcast script', 'video script|skript für video|youtube|reel|short|podcast|voiceover|drehbuch|storyboard|explainer video|erklärvideo', {
  outcome: 'A script that holds attention to the end and fits the time.',
  slots: ['audience', slot('length', '150 spoken words per minute; shorts under 60 seconds'), 'tone', 'format', 'language'],
  ask: ['Platform, length and who watches?', 'What should viewers do after?'],
  steps: ['Hook in the first 3 seconds (the promise or the surprise).', 'One idea per scene.', 'Write for the ear: short sentences.', 'Visual notes per scene.', 'Clear ending with the call to action.'],
  bar: ['Hook works alone', 'Fits the time when read aloud', 'Visuals noted'],
  pitfalls: ['Slow intros', 'Written-language sentences', 'No visual plan'],
  deliver: 'Two-column script (spoken | on screen), timings.',
  verify: ['Read aloud with a timer'],
});
K('seo', 'SEO or being found online', 'seo|search engine|suchmaschine|google ranking|ranking|keywords?|keyword research|meta description|backlinks|sichtbarkeit|found on google|ai search|geo|llms.txt', {
  outcome: 'Pages that answer what people search, readable by search engines and AI assistants.',
  slots: ['source', 'place', 'language', 'audience'],
  ask: ['Which site and which pages matter most?', 'Who should find it, searching for what?'],
  steps: ['Find the queries real customers use (search suggestions, competitors, tools).', 'Check the basics: title, description, headings, speed, mobile, indexing, robots.txt, sitemap.', 'One page per intent; answer it fully.', 'Structured data and llms.txt for AI assistants.', 'Measure; fix the biggest gap first.'],
  bar: ['Each page has one clear intent', 'Technical basics pass', 'Readable without JavaScript'],
  pitfalls: ['Keyword stuffing', 'Thin duplicate pages', 'Blocking crawlers by accident'],
  deliver: 'Findings ranked by impact, with the fix for each.',
  verify: ['Check the live page source, robots.txt and sitemap'],
  need: 'seo tools',
});
K('documentation', 'Documentation or README', 'readme|documentation|dokumentation|docs|handbuch|manual|user guide|anleitung|how-to guide|api docs|wiki', {
  outcome: 'Docs a newcomer can follow to success without asking anyone.',
  slots: ['audience', 'source', 'level', 'format'],
  ask: ['Who reads it (users, developers, admins) and what must they achieve?'],
  steps: ['Start with what it is and the quickest path to a first success.', 'Exact commands and expected output.', 'Reference after the tutorial.', 'Troubleshooting for the common errors.', 'Test every command on a clean setup.'],
  bar: ['Quickstart works copy-paste', 'Commands tested', 'Prerequisites listed'],
  pitfalls: ['Untested commands', 'Assumed knowledge', 'Outdated screenshots'],
  deliver: 'Markdown docs with quickstart, usage, reference, troubleshooting.',
  verify: ['Run the quickstart from scratch'],
  must: [['commands or examples', /```|`[^`]+`/]],
});
K('legal-text', 'Contract, terms or legal text (information, not advice)', 'contract|vertrag|terms|agb|nutzungsbedingungen|privacy policy|datenschutzerklärung|impressum|nda|legal|rechtlich|kündigung|widerspruch|abmahnung|dsgvo|gdpr', {
  outcome: 'Clear information on what the text says and means — with the points a lawyer should confirm.',
  slots: ['source', 'place', slot('goal', 'what the person wants to achieve or avoid')],
  ask: ['Which country\'s law applies?', 'What do you want to achieve (sign, terminate, object, publish)?'],
  steps: ['Identify the jurisdiction.', 'Summarise obligations, rights, deadlines, money, termination.', 'Flag unusual or one-sided clauses.', 'Quote the exact clause for each point.', 'Say clearly which points need a lawyer.'],
  bar: ['Quotes the clauses', 'Deadlines and amounts exact', 'States its limits: not legal advice'],
  pitfalls: ['Presenting information as legal advice', 'Wrong jurisdiction', 'Missing deadlines'],
  deliver: 'Plain-language summary, flagged clauses with quotes, questions for a lawyer.',
  verify: ['Every point traceable to a clause'],
  need: 'official law text',
});
K('support-reply', 'Customer support reply', 'customer support|kundenservice|support ticket|complaint|beschwerde|refund|erstattung|reklamation|customer question|kundenanfrage|kundenfrage|ticket', {
  outcome: 'A reply that solves the customer\'s problem in one message.',
  slots: ['source', slot('tone', 'calm, warm, specific'), 'language', slot('goal', 'solve it now or give an exact next step and time')],
  ask: ['What does policy allow (refunds, replacements, credits)?'],
  steps: ['Find the actual problem and what the customer wants.', 'Check the order/account facts.', 'Solve it, or give the exact next step and when.', 'Acknowledge briefly; no long apologies.', 'Make sure nothing is promised beyond policy.'],
  bar: ['Solves or gives a concrete next step', 'Facts checked', 'Within policy'],
  pitfalls: ['Template replies that ignore the question', 'Over-promising', 'Blaming the customer'],
  deliver: 'Reply text and an internal note of what was done.',
  verify: ['Order facts match'],
});
K('naming', 'Names, slogans or brainstorming', 'name for|namen für|naming|slogan|tagline|claim|brainstorm|ideas for|ideen für|business name|firmenname|brand name|markenname|title ideas', {
  outcome: 'A short list of strong options, checked for availability where it matters.',
  slots: ['audience', 'tone', 'count', slot('goal', 'what the name or line must make people feel or know'), 'language'],
  ask: ['What should it make people feel or understand?', 'Any constraints (length, language, domain, trademark)?'],
  steps: ['Write 30+ raw options across styles (descriptive, invented, metaphor, compound).', 'Cut to the best 5–8 with reasons.', 'Check pronunciation and meaning in the main languages.', 'Check domains and obvious trademark conflicts.', 'Recommend one.'],
  bar: ['Easy to say and spell', 'Fits the brand', 'Domain/trademark checked'],
  pitfalls: ['Names already taken', 'Unfortunate meanings in other languages'],
  deliver: 'Shortlist with reasons and availability notes, one recommendation.',
  verify: ['Domain lookup', 'Trademark search in the main register'],
  need: 'domain search trademark',
});
K('prompt', 'Write a prompt or instructions for an agent', 'prompt|system prompt|instructions for|anweisungen für|prompt engineering|write a prompt|schreibe einen prompt|agent instructions|gpt instructions|custom gpt', {
  outcome: 'A prompt that gets the same good result every time.',
  slots: [slot('goal', 'the result, with one example of excellent output'), 'audience', 'format', 'source'],
  ask: ['What does an excellent result look like (an example)?', 'What must never happen?'],
  steps: ['State the role, the goal and who the result is for.', 'Give context the model cannot know.', 'Specify the output form exactly.', 'Add 1–3 examples (good and bad).', 'Add the checks the model should run before answering; test on 5 inputs.'],
  bar: ['Goal and audience explicit', 'Output form exact', 'Examples', 'Tested'],
  pitfalls: ['Vague goals', 'Contradictory rules', 'No examples'],
  deliver: 'The prompt, plus the test inputs and results.',
  verify: ['Run it on varied inputs'],
});
K('job-search', 'Find jobs or freelance work', 'find a job|job search|jobsuche|stellenangebote|stelle finden|jobs in|jobs as|freelance work|aufträge finden|gigs|remote jobs|praktikum|internship|werkstudent', {
  outcome: 'A shortlist of open roles that fit, with how to apply to each.',
  slots: ['place', slot('goal', 'the role, level and must-haves (salary, remote, hours)'), 'dates', 'level'],
  ask: ['Which role, where (or remote), and what are the must-haves?'],
  steps: ['Search company career pages and 2–3 job boards.', 'Filter by the must-haves; check the post date.', 'For each: link, deadline, requirements, contact.', 'Rank by fit; note gaps.', 'Plan the applications (CV and letter per role).'],
  bar: ['Roles verified open', 'Links to the original posting', 'Fit explained'],
  pitfalls: ['Expired postings', 'Scam ads asking for money'],
  deliver: 'Table of roles with link, fit, deadline, next step.',
  verify: ['Every link opens a live posting'],
  need: 'job board careers',
});
K('health-info', 'Health or medical information', 'symptom|symptome|health|gesundheit|medical|medizinisch|medication|medikament|dosage|dosierung|diagnosis|diagnose|pain|schmerz|doctor|arzt', {
  outcome: 'Reliable information and when to see a professional — not a diagnosis.',
  slots: ['source', 'level', 'language'],
  ask: ['Is this about an urgent situation right now?'],
  steps: ['If anything sounds urgent, say so first and name the emergency number.', 'Use recognised sources (health authorities, guidelines).', 'Explain plainly; separate general information from the person\'s case.', 'Say when to see a doctor or pharmacist.'],
  bar: ['Recognised sources', 'Urgent signs named first', 'Clearly not a diagnosis'],
  pitfalls: ['Diagnosing', 'Doses from memory', 'Forums as sources'],
  deliver: 'Plain explanation, warning signs, when to get help, sources.',
  verify: ['Every medical fact against an official source'],
  need: 'health authority',
});
K('finance-info', 'Money, tax or investment questions (information, not advice)', 'invest|investieren|aktie|stock|etf|crypto|krypto|tax|steuer|steuern|loan|kredit|mortgage|baufinanzierung|savings|sparen|rente|pension|insurance|versicherung', {
  outcome: 'The facts and numbers to decide, computed correctly — not personal advice.',
  slots: ['place', 'budget', 'dates', 'source'],
  ask: ['Which country (tax and law differ)?', 'What is the goal and time horizon?'],
  steps: ['Identify the country and the rules that apply (official sources).', 'Compute with real numbers in code; show the formula.', 'Show options with costs, risks and fees.', 'Say what a professional should confirm.'],
  bar: ['Numbers computed', 'Current rules from official sources', 'Risks and fees shown', 'No personal recommendation to buy or sell'],
  pitfalls: ['Old tax rates', 'Ignoring fees and inflation', 'Telling people what to buy'],
  deliver: 'Facts, the math, options with risks, questions for an advisor.',
  verify: ['Recompute', 'Check the tax year of every rate'],
  need: 'official tax',
});

const norm = (s) => String(s || '').toLowerCase().replace(/[‘’]/g, "'");
const isDe = (t) => /[äöüß]/i.test(t) || (t.match(/\b(der|die|das|und|ich|für|mit|ein|eine|einen|nicht|bitte|mein|meine|meinen|unser|unsere|wie|was|soll|schreibe|schreib|erstelle|mach|als|bei|auf|zum|zur|vom|im|ist|sind|oder|auch|noch|nach|wir|uns|dem|den|des|für|über|mir|mich)\b/gi) || []).length >= 2;
// how strongly a kind is named: longer key phrases weigh more; a key may sit inside a German compound
function scoreKind(t, k) {
  let s = 0; const hit = [];
  for (const key of k.keys) {
    if (!key) continue;
    // short keys must be a whole word; longer ones may start a word (German compounds: bewerbung → bewerbungsschreiben)
    const q = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = new RegExp(key.length <= 5 ? `(^|[^\\p{L}\\p{N}])${q}($|[^\\p{L}\\p{N}])` : `(^|[^\\p{L}\\p{N}])${q}`, 'u').test(t);
    if (found) { s += 1 + Math.min(key.length, 24) / 8; hit.push(key); }
  }
  return { s: s * (k.w ?? 1), hit };
}
export const BRIEF_KINDS = LIB.map((k) => ({ kind: k.kind, title: k.title, outcome: k.outcome }));
export const briefKind = (kind) => LIB.find((k) => k.kind === kind) || null;

// the brief for a task: the kind, what was left out (with defaults), the questions worth asking, the method, the bar, the checks
export function briefFor(task, { base = 'https://mareliberum.dev', kind } = {}) {
  const raw = String(task || '').trim().slice(0, 2000), t = norm(raw);
  const ranked = LIB.map((k) => ({ k, ...scoreKind(t, k) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const k = (kind && briefKind(kind)) || ranked[0]?.k || null;
  const de = isDe(raw);
  const slots = k ? k.slots : ['audience', 'goal', 'length', 'format', 'language', 'source'];
  const given = [], missing = [];
  for (const sl of slots) {
    const name = typeof sl === 'string' ? sl : sl.name, def = SLOTS[name]; if (!def) continue;
    if (def[0].test(raw)) given.push(name);
    else missing.push({ slot: name, assume: (typeof sl === 'object' && sl.assume) || def[1], ask: (typeof sl === 'object' && sl.ask) || def[2] });
  }
  const words = raw.split(/\s+/).filter(Boolean).length;
  // ask only about what is missing, and only a little: a short request leaves the most out
  const ask = missing.filter((m) => m.slot !== 'language').map((m) => m.ask).slice(0, words < 12 ? 3 : 2);
  const b = {
    task: raw || undefined,
    kind: k?.kind || 'general', title: k?.title || 'General task',
    outcome: k?.outcome || 'A finished result the person can use as it is, with assumptions stated.',
    respondIn: de ? 'German (the request is in German)' : 'the language of the request',
    given, missing,
    ask, worthKnowing: k?.ask || [], askNote: 'Ask these only if the person is there and a wrong guess would be costly; otherwise go on with the assumptions and list them.',
    steps: k?.steps || ['Restate the goal in one line.', 'List what you assume where the request is silent.', 'Gather what you need from sources you read now.', 'Do the work in one pass.', 'Check it against the bar below.'],
    bar: [...(k?.bar || []), ...UNIVERSAL.slice(0, 3)],
    pitfalls: k?.pitfalls || ['Answering a different, easier question', 'Facts from memory', 'Hiding uncertainty'],
    deliver: k?.deliver || 'The result first; then assumptions, sources and open points.',
    verify: [...(k?.verify || []), 'Read it once as the person who asked: is anything they need missing?'],
    universal: UNIVERSAL,
    also: ranked.filter((x) => x.k !== k).slice(0, 2).map((x) => ({ kind: x.k.kind, title: x.k.title, brief: `${base}/brief/${x.k.kind}` })),
    help: {
      sites: `${base}/find?q=${encodeURIComponent(k?.need || raw.slice(0, 80) || '')}`,
      brain: `${base}/brain?q=${encodeURIComponent(raw.slice(0, 200))}`,
      review: `${base}/review (POST {"task": "...", "draft": "..."}) checks a draft against this bar`,
    },
    page: `${base}/brief/${k?.kind || 'general'}`,
  };
  b.prompt = promptOf(b);
  return b;
}
// the full prompt, as the person would have written it with time and practice
function promptOf(b) {
  const L = (h, xs) => (xs?.length ? `${h}\n${xs.map((x) => `- ${x}`).join('\n')}` : '');
  return [
    `Task: ${b.task || '(the task)'}`,
    `Kind of work: ${b.title}. Aim: ${b.outcome}`,
    `Respond in: ${b.respondIn}.`,
    L('Where the request is silent, assume (and list these assumptions at the end):', b.missing.map((m) => `${m.slot}: ${m.assume}`)),
    L('Method:', b.steps),
    L('Quality bar:', b.bar),
    L('Avoid:', b.pitfalls),
    `Deliver: ${b.deliver}`,
    L('Before handing over, check:', b.verify),
  ].filter(Boolean).join('\n\n');
}

// a draft read against the bar: placeholders, filler, missing parts, length, unsourced numbers, language
const FILLER = /\b(as an ai( language model)?|i hope this (email|message) finds you well|in today'?s fast[- ]paced world|delve into|it'?s important to note that|in conclusion,? it is clear|game[- ]changer|unlock (the|your) (full )?potential|seamless(ly)?|cutting[- ]edge|ich hoffe,? es geht ihnen gut|in der heutigen schnelllebigen welt|es ist wichtig zu beachten)\b/gi;
const PLACEHOLDER = /\[(insert|your|name|firma|company|date|datum|todo|xx+|tbd|placeholder|link|url|platzhalter)[^\]]{0,40}\]|\{\{[^}]{1,40}\}\}|\bTODO\b|\bTBD\b|lorem ipsum|\bXXX\b|<(your|insert)[^>]{0,30}>/gi;
export function reviewDraft(task, draft, opts = {}) {
  const b = briefFor(task, opts), d = String(draft || '');
  const issues = [], passed = [];
  const add = (ok, check, detail, fix) => (ok ? passed.push(check) : issues.push({ check, detail, fix }));
  const ph = d.match(PLACEHOLDER) || [];
  add(!ph.length, 'no placeholders', ph.length ? `found: ${[...new Set(ph)].slice(0, 5).join(', ')}` : '', 'Fill in or remove every placeholder.');
  const fl = d.match(FILLER) || [];
  add(!fl.length, 'no filler phrases', fl.length ? `found: ${[...new Set(fl.map((x) => x.toLowerCase()))].slice(0, 5).join(', ')}` : '', 'Cut the stock phrases; say the specific thing.');
  const sents = d.split(/(?<=[.!?])\s+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 30);
  const dup = sents.filter((s, i) => sents.indexOf(s) !== i);
  add(!dup.length, 'no repeated sentences', dup.length ? `${dup.length} repeated` : '', 'Remove the repetitions.');
  add(!/(\.\.\.|…|:)\s*$/.test(d.trim()) && d.trim().length > 0, 'finished', d.trim() ? 'the draft ends mid-thought' : 'the draft is empty', 'Finish the last part.');
  const words = d.split(/\s+/).filter(Boolean).length;
  const want = String(task || '').match(/\b(\d{2,5})\s*(words?|wörter)\b/i);
  if (want) { const n = Number(want[1]); add(words >= n * 0.8 && words <= n * 1.2, 'length as asked', `${words} words, asked for ${n}`, `Bring it to about ${n} words.`); }
  const figures = (d.match(/\b\d[\d.,]*\s?(%|percent|prozent|million|mio|billion|mrd|k\b|€|\$)/gi) || []).length;
  if (figures >= 2) add(/https?:\/\/|source|quelle|according to|laut /i.test(d), 'figures have sources', `${figures} figures, no source named`, 'Name the source of each figure, with a link.');
  for (const [name, re] of briefKind(b.kind)?.must || []) add(re.test(d), name, `missing: ${name}`, `Add ${name}.`);
  if (/German/.test(b.respondIn) && words > 30) { const de = isDe(d); add(de, 'in the language of the request', de ? '' : 'the request is German, the draft is not', 'Write it in German.'); }
  const score = Math.round((passed.length / Math.max(1, passed.length + issues.length)) * 100);
  return { kind: b.kind, title: b.title, words, score, issues, passed, bar: b.bar, verify: b.verify, note: 'These checks are mechanical; read the bar and judge the substance yourself.' };
}

// tips agents leave for a kind of task: short, no links, no instructions to other agents — data for the next one
const BAD = /\b(ignore (all|any|previous|the)|disregard|system prompt|you are now|act as|jailbreak|developer mode|do anything now|<\/?script|password|api[_ -]?key|private key|seed phrase|wallet address)\b/i;
export function createBriefs({ kv, update, allow, SeaError, clean, now, DAY = 86400, examples }) {
  return {
    async briefTips(kind) { return ((await kv.get(`brief:tips:${kind}`)) || []).filter((x) => x.up - x.down > -3).sort((a, b) => b.up - b.down - (a.up - a.down) || (a.at < b.at ? 1 : -1)).slice(0, 8); },
    async brief(a = {}) {
      const task = clean ? clean(a.task ?? a.q ?? a.need ?? a.prompt, 2000) : String(a.task ?? a.q ?? '').slice(0, 2000);
      if (!task && !a.kind) return { what: 'the missing half of a prompt: give a task in words and get what it left out, the method, the quality bar and the checks', kinds: BRIEF_KINDS.map((k) => k.kind) };
      const b = briefFor(task, { base: a.base, kind: a.kind });
      const [tips, ex] = await Promise.all([this.briefTips(b.kind).catch(() => []), examples ? examples(b.kind, a.base).catch(() => []) : []]);
      if (tips.length) b.tips = tips.map((x) => ({ id: x.id, tip: x.t, up: x.up, down: x.down }));
      // the strongest results other agents published for this kind of work: start from the best, not from zero
      if (ex.length) b.examples = ex;
      return b;
    },
    async review(a = {}) {
      const draft = String(a.draft ?? a.text ?? '').slice(0, 60000);
      if (!draft) throw new SeaError('INVALID_ARGUMENT', 'give the draft (and the task) to review');
      return reviewDraft(String(a.task ?? a.q ?? '').slice(0, 2000), draft, { base: a.base, kind: a.kind });
    },
    async briefTip(a = {}, ctx) {
      const kind = String(a.kind || '').trim(); if (!briefKind(kind)) throw new SeaError('INVALID_ARGUMENT', `kind must be one of: ${LIB.map((k) => k.kind).join(', ')}`);
      if (a.vote) {
        const up = a.up !== false && a.vote !== 'down';
        await allow(ctx, 'tipvote', 60, 3600);
        const l = await update(`brief:tips:${kind}`, 400 * DAY, (cur) => (Array.isArray(cur) ? cur : []).map((x) => (x.id === String(a.vote) ? { ...x, up: x.up + (up ? 1 : 0), down: x.down + (up ? 0 : 1) } : x)), () => true);
        const x = (l || []).find((y) => y.id === String(a.vote)); if (!x) throw new SeaError('NOT_FOUND', 'no tip with this id');
        return { kind, tip: x.t, up: x.up, down: x.down };
      }
      const t = String(a.tip || '').replace(/\s+/g, ' ').trim();
      if (t.length < 12 || t.length > 280) throw new SeaError('INVALID_ARGUMENT', 'a tip is one sentence, 12 to 280 characters');
      if (/https?:\/\/|www\.|\.(com|io|ai|net|org)\b/i.test(t)) throw new SeaError('INVALID_ARGUMENT', 'tips carry no links');
      if (BAD.test(t)) throw new SeaError('INVALID_ARGUMENT', 'tips describe how to do the work well; they are not instructions to other agents');
      await allow(ctx, 'tip', 10, 3600);
      const id = Math.random().toString(36).slice(2, 10), at = now ? now() : new Date().toISOString();
      await update(`brief:tips:${kind}`, 400 * DAY, (cur) => { const l = Array.isArray(cur) ? cur : []; if (l.some((x) => x.t.toLowerCase() === t.toLowerCase())) return l; return [{ id, t, up: 0, down: 0, at }, ...l].slice(0, 200); }, () => true);
      return { kind, id, tip: t, note: 'kept as data for the next agent on this kind of task; others vote it up or down' };
    },
  };
}
