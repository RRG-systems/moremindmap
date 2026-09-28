import React from 'react';
import { athleteTextSegments } from './athleteText.js';
import { athleteChatTextBlocks } from './chatText.js';
import './athlete-chat-text.css';

function Inline({ value }) {
  return athleteTextSegments(value).map((segment, index) => segment.kind === 'strong'
    ? <strong key={index}>{segment.text}</strong>
    : <React.Fragment key={index}>{segment.text}</React.Fragment>);
}

function Lines({ lines }) {
  return lines.map((line, index) => <React.Fragment key={index}>
    {index > 0 && <br/>}<Inline value={line}/>
  </React.Fragment>);
}

// Assistant conversation/history only. React escapes every saved/model string;
// there is deliberately no HTML, link, image, embed, or script interpretation.
export default function AthleteChatText({ value }) {
  return <div className="athlete-chat-text">{athleteChatTextBlocks(value).map((block, index) => {
    if (block.kind === 'paragraph') return <p key={index}><Lines lines={block.lines}/></p>;
    if (block.kind === 'heading') return React.createElement(
      `h${Math.min(4, Math.max(2, block.level))}`, { key: index }, <Inline value={block.text}/>);
    if (block.kind === 'code') return <pre key={index}><code>{block.text}</code></pre>;
    if (block.kind === 'table') return <div className="athlete-chat-table-scroll" key={index}
      role="region" aria-label="Comparison table" tabIndex={0}><table><thead><tr>
        {block.header.map((cell, cellIndex) => <th scope="col" key={cellIndex}><Inline value={cell}/></th>)}
      </tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>
        {row.map((cell, cellIndex) => <td key={cellIndex}><Inline value={cell}/></td>)}
      </tr>)}</tbody></table></div>;
    const items = block.items.map((item, itemIndex) => <li key={itemIndex}
      {...(block.kind === 'ordered' ? { value: item.number } : {})}><Lines lines={item.lines}/></li>);
    return block.kind === 'ordered' ? <ol key={index} start={block.items[0].number}>{items}</ol>
      : <ul key={index}>{items}</ul>;
  })}</div>;
}
