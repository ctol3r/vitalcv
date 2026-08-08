import * as React from 'react';

/**
 * Safe Markdown-like rendering for Workbench notes — CC-08 / WB-04.
 *
 * The entire pipeline is string → React elements. There is no HTML parsing,
 * no dangerouslySetInnerHTML, and no URL auto-linking (so the javascript:
 * vector does not exist here). Anything that looks like markup renders as
 * the literal text the clinician typed — the XSS corpus test pins that no
 * element or handler can be smuggled through a note body.
 *
 * Supported, deliberately small:
 *   - paragraphs (blank-line separated)
 *   - `- ` bullet lists
 *   - **bold**, *italic*, `code`
 *   - [[typed reference]] → a distinct, inert card-styled span. Resolution
 *     and the picker are CC-09; until then the reference renders as what it
 *     is — text the clinician wrote, visibly different from prose.
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\]\])/g;

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const parts = text.split(INLINE);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('[[') && part.endsWith(']]') && part.length > 4) {
      return (
        <span
          key={key}
          data-ref-card
          className="mz-mono"
          style={{
            border: '1px solid var(--rule, #ccc)',
            borderRadius: 2,
            padding: '0 4px',
            fontSize: '0.85em',
          }}
        >
          {part.slice(2, -2)}
        </span>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export function renderNoteBody(body: string): React.ReactNode {
  const lines = body.split('\n');
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(' ');
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(text, `p-${blocks.length}`)}</p>);
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {bullets.map((b, i) => (
          <li key={i}>{renderInline(b, `li-${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushBullets();
    } else if (trimmed.startsWith('- ')) {
      flushParagraph();
      bullets.push(trimmed.slice(2));
    } else {
      flushBullets();
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  flushBullets();

  return <div data-note-preview>{blocks}</div>;
}
