export const VERSION='youth-apa-v2.0.0';
export const MODEL='gpt-5.6-sol';
export const DOMAINS=[{id:'sport',label:'Sport'},{id:'training',label:'Training'},{id:'mindset',label:'Warrior Mindset'},{id:'school',label:'School'}];
export const ROLES=['current_course','emerging_future','better_future','bold_future','downside_future'];
export const ROLE_LABELS=['Current course','Already beginning','A better path','Your stretch','A risk to avoid'];
export const QUESTIONS=[
'What sport are we focusing on right now?',
'What would you love to achieve in your sport, and why does it matter to you?',
'What feels strongest about the way you are performing right now?',
'What part of your performance would you most like to improve?',
'What would make the next six to eight weeks feel successful in your sport?',
'What does a normal training week look like for you?',
'What do you most want your training to help you do better?',
'Which part of your training seems to be helping most?',
'Which part feels confusing, hard to keep up with, or not useful?',
'What would make your training week work better for you?',
'When you are playing with confidence, what is different about you?',
'When the pressure goes up, what usually happens for you?',
'After a mistake or a bad performance, what helps you get back into it?',
'What would you most like to handle better mentally in your sport?',
'What do you need from the people around you to compete at your best?',
'How is school going for you right now?',
'Which parts of school feel strongest, and which need help?',
'What would you like to achieve in school this term?',
'Where would you like school to lead for you?',
'How are school and sport fitting together in your week?'
].map((text,i)=>({id:`A${String(i+1).padStart(2,'0')}`,domain:DOMAINS[Math.floor(i/5)].id,text}));
export const HELP=[
'Your position or event, level, and where you are in the season. If you play several sports, choose the focus for now.',
'A big dream or simply enjoying it more. Not knowing yet is fine.',
'A recent practice or competition moment can help.',
'What happened in a recent moment you would like to handle differently?',
'What would you notice? Use your next event if that makes more sense.',
'Practices, individual work, days off. A rough week is enough.',
'Your purpose: skill, speed, consistency, enjoyment, or something else.',
'What have you noticed changing? It is okay not to know yet.',
'Include changes you already tried and what happened.',
'Time, energy, rest, access, and help from other people.',
'Your focus, decisions, communication, or freedom to play.',
'Think about a recent moment and what you did next.',
'If nothing helps yet, say so.',
'Trust, courage, focus, or recovering after a mistake. Your choice.',
'What helps? What becomes distracting or too much?',
'Your year or course and your own view. Not in school is a valid answer.',
'Subjects, assignments, understanding, or keeping up. Exact grades are optional.',
'A grade, finishing work, understanding a subject, or another goal.',
'College, a trade, work you are curious about, or still exploring.',
'What gets squeezed? What already works? What help would matter?'
];
export const WEIGHTS={simple_language:.20,immediate_clarity:.20,coverage:.25,personal_specificity:.15,useful_action:.15,reading_navigation:.05};

export const dateLabel=iso=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-US',{month:'long',day:'numeric',timeZone:'UTC'});
