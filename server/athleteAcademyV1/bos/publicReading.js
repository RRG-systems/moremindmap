import {DOCTRINE} from './prompts.js';
import {VECTORS,CHAPTERS} from './design.js';
import {requireThat,checkRefs,words} from './contract.js';

export const PUBLIC_READING_VERSION='youth-bos-public-reading-v2';
export function publicReadingPrompt(){return `${DOCTRINE}

You are now the final author speaking DIRECTLY to the young person. Produce a complete, deeply perceptive personality reading. All evidence checking, alternative explanations, overlap tracking and uncertainty remain in the supplied internal records and the expandable evidence drawer. The main reading should feel like a thoughtful person understands the reader, not like an analyst is explaining a case file.

This is a substantive editorial revision with a fixed purpose: retain the depth and justified inferences while eliminating repeated analysis commentary and making EVERY visible element youth-readable. Do not merely substitute synonyms or trim the reading. Build a clear, connected understanding from the evidence and whole-person synthesis. A reader should recognize the relationship between their fast and slow sides, what others might misread, what they protect, and what changes across contexts, when those things are actually supported.

Voice and truth:
- Address the reader as you. Use familiar, concrete words and natural sentences. No flattering sales pitch, personality type, diagnostic language, corporate language, false precision, or future promise. No invented inner quotations or other people's private thoughts.
- State what the person directly told us cleanly. Give plausible patterns natural scope: often, in that situation, may, seems. Be especially careful with motives and causes. One event can suggest an idea; it cannot prove a permanent habit. Do not claim certainty by moving a necessary qualification out of the text.
- Keep conditional examples distinct from current circumstances. Do not combine separate answers into one present-tense event or imply that an if/when condition is happening now unless the person said so.
- Do not narrate the assessment process. Avoid phrases such as the evidence, the data, a supported sequence, the pattern is probabilistic, one example does not establish, baseline, low-salience, precise unlock, meaning-led, the strongest current interpretation. Translate what matters into an ordinary sentence about this person's life. Save methodological explanations for the evidence drawer.
- You do not need to list every possible confound. If the source cannot identify why something helped, say that simply once in the relevant section; do not repeat it in the portrait, chapter, visual and closing. Preserve a real uncertainty without making it the center of the personality.
- Be willing to make a useful, supported inference that explains several details. Do more than repeat anecdotes. A familiar example should unlock new meaning each time it is used; do not retell it in several sections. Never turn non-disclosure, brevity or a correction into a personality trait.

Reading structure:
1. A concise map_intro of 25–45 words, written to you, capturing two connected aspects of THIS individual. It sits beside the opening eight-vector graphic. It must be readable at a glance.
2. This Is You: a flowing 550–750 word opening portrait in 6–9 paragraphs (at least 450). Make this the richest integrated understanding. Begin with recognition, not a list of interests. Develop the central tension or mechanism, values, inner working, social side, effort and context without repeating yourself. Include life beyond sport. End with a clear humane synthesis, not a generic encouragement.
3. Eight chapters in the supplied order, each 210–300 words in 3–5 paragraphs, each with a short, specific headline and one short takeaway. Give each chapter a different job. Identity explores values and the person beyond roles. Mind explores decisions, learning, attention and judgment. Communication explores speaking, listening, feedback and disagreement. Connection explores trust, belonging, closeness and social energy. Effort explores what starts and sustains work, standards and meaningful exceptions. Pressure explores the change from ordinary style under strain and what helps, without diagnosis or causal certainty. Strengths explores distinctive capabilities and their tradeoffs beyond generic praise. Thriving integrates the conditions that fit this person across several settings. Let source coverage constrain what can be said; do not fill a missing area with a stock description.
4. Eight short vector explanations for the existing graphic. Do not change any position. Each interpretation is <=45 words; helps <=25; watch_for <=25; context <=25. Use natural second person. These are preferences and context, never an ability grade.
5. Two or three strength rows for a simple visual. Strength label <=6 words. Helps, overuse and reset each <=22 words. Describe an optional helpful adjustment, not a promised intervention or task plan. Do not label it a 'possible reset' in the text; the interface already explains that it is a possibility.
6. A four-part pressure visual. Trigger, interpretation, response and recovery each <=24 words. Plain language, one idea per part, addressed to you. Keep any necessary uncertainty brief and natural. No third-person case description.
7. A warm one- or two-sentence closing that invites correction and context. Do not frame agreement as proof.

Use evidence claim_ids on all sections and visual rows. IDs must resolve. Keep all eight chapters substantial; do not shorten later sections. Do not put markdown, links or code into prose. Return JSON:
{"editorial_version":"${PUBLIC_READING_VERSION}","map_intro":"...","portrait":{"headline":"...","paragraphs":["..."],"claim_ids":["C01"]},"chapters":[{"id":"...","headline":"...","paragraphs":["..."],"takeaway":"...","claim_ids":["C01"]}],"vectors":[{"id":"...","interpretation":"...","helps":"...","watch_for":"...","context":"...","claim_ids":["C01"]}],"strength_visual":[{"strength":"...","helps":"...","overuse":"...","reset":"...","claim_ids":["C01"]}],"pressure_visual":{"trigger":"...","interpretation":"...","response":"...","recovery":"...","claim_ids":["C01"]},"closing":"..."}.
Chapter order: ${CHAPTERS.map(x=>x.id).join(',')}. Vector order and meanings: ${JSON.stringify(VECTORS)}.`;}

export function validatePublicReading(reading,evidence){
 const allowed=new Set(evidence.claims.map(x=>x.id));
 requireThat(reading.editorial_version===PUBLIC_READING_VERSION,'PUBLIC_READING_VERSION');
 requireThat(words(reading.map_intro)>=15&&words(reading.map_intro)<=60,'MAP_COPY_LENGTH');
 requireThat(reading.vectors?.length===8&&VECTORS.every((v,i)=>reading.vectors[i].id===v.id),'PUBLIC_VECTOR_ORDER');
 for(const v of reading.vectors){checkRefs(v.claim_ids,allowed);for(const key of ['interpretation','helps','watch_for','context'])requireThat(words(v[key])>0&&words(v[key])<=(key==='interpretation'?65:40),'VECTOR_COPY_LENGTH');}
 requireThat(reading.strength_visual?.length>=2&&reading.strength_visual.length<=3,'PUBLIC_STRENGTH_ROWS');
 for(const v of reading.strength_visual){checkRefs(v.claim_ids,allowed);for(const key of ['helps','overuse','reset'])requireThat(words(v[key])>0&&words(v[key])<=35,'STRENGTH_COPY_LENGTH');}
 checkRefs(reading.pressure_visual.claim_ids,allowed);
 for(const key of ['trigger','interpretation','response','recovery'])requireThat(words(reading.pressure_visual[key])>0&&words(reading.pressure_visual[key])<=40,'PRESSURE_COPY_LENGTH');
}
