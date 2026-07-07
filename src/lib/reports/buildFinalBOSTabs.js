/** Customer-facing BOS tab definitions for production renderer. */

export const FINAL_BOS_TABS = [
  { id: 'overview', label: 'Overview', default: true },
  { id: 'scores-reveal', label: 'What Your Scores Reveal' },
  { id: 'visual-dna', label: 'Your Visual DNA' },
  { id: 'five-futures', label: 'Five Futures' },
  { id: 'one-move', label: 'One Move' },
  { id: 'team-fit', label: 'Team / Leadership Fit' },
  { id: 'how-to-use', label: 'How to Use This' },
  { id: 'advanced-source', label: 'Advanced Source', internal: true },
];

export const DEFAULT_BOS_TAB = 'overview';

export default FINAL_BOS_TABS;