export function cssPath(el: Element): string {
  const parts: string[] = [];
  let current = el;

  while (current && current.nodeType === 1 && current instanceof HTMLElement && current.tagName.toLowerCase() !== 'html') {
    // Prefer data-testid
    const testid = current.getAttribute('data-testid');
    if (testid) {
      parts.unshift(`[data-testid="${testid}"]`);
      break;
    }

    // Then id
    const id = current.getAttribute('id');
    if (id) {
      parts.unshift(`#${CSS.escape(id)}`);
      break;
    }

    // Otherwise use nth-of-type
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(e => e.tagName === current.tagName);
      const idx = siblings.indexOf(current) + 1;
      parts.unshift(`${tag}:nth-of-type(${idx})`);
      current = parent;
    } else {
      break;
    }
  }

  return parts.join(' > ');
}

/**
 * Suggest a stable data-testid for an element
 * Generates based on role, tag, and text content
 */
export function suggestTestId(el: Element): string {
  // Get element role or tag name
  const role = (el.getAttribute('role') || el.tagName).toLowerCase();

  // Get text content, sanitized
  const txt = (el.textContent || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  // Combine role and text (limit to 40 chars)
  const suggested = `${role}-${txt || 'target'}`.slice(0, 40);

  return suggested;
}

