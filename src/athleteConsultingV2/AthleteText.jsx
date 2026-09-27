import React from 'react';
import { athleteTextBlocks, athleteTextSegments } from './athleteText.js';
import './athlete-text.css';

function Lines({ lines }) {
  return lines.map((line, index) => <React.Fragment key={index}>
    {index > 0 && <br/>}
    {athleteTextSegments(line).map((segment, part) => segment.kind === 'strong'
      ? <strong key={part}>{segment.text}</strong> : <React.Fragment key={part}>{segment.text}</React.Fragment>)}
  </React.Fragment>);
}

// Limited paragraphs, line breaks, bullets, numbers and bold. No links, HTML,
// embeds or executable attributes can be supplied by saved/model text.
export default function AthleteText({ value, className = '' }) {
  return <div className={`athlete-text ${className}`.trim()}>{athleteTextBlocks(value).map((block, index) => {
    if (block.kind === 'paragraph') return <p key={index}><Lines lines={block.lines}/></p>;
    const items = block.items.map((item, itemIndex) => <li key={itemIndex}
      {...(block.kind === 'ordered' ? { value: item.number } : {})}><Lines lines={item.lines}/></li>);
    return block.kind === 'ordered' ? <ol key={index} start={block.items[0].number}>{items}</ol>
      : <ul key={index}>{items}</ul>;
  })}</div>;
}
