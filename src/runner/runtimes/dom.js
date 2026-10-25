import { chromium } from '@playwright/test';

const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string' };
export const domToolDefinitions = [
  { name: 'open_page', description: 'Open the benchmark URL in a new isolated Chrome tab and read its rendered DOM.', inputSchema: object() },
  { name: 'dom', description: 'Read the rendered DOM, including text and interactive elements. Optionally scope the read to a CSS selector. Scripts, styles, hidden elements and SVG internals are omitted.', inputSchema: object({ selector: string }) },
  { name: 'click', description: 'Click one visible element identified by a CSS selector.', inputSchema: object({ selector: string }, ['selector']) },
  { name: 'type', description: 'Fill an input identified by a CSS selector.', inputSchema: object({ selector: string, text: string }, ['selector', 'text']) },
  { name: 'select', description: 'Select an option in a dropdown by its value.', inputSchema: object({ selector: string, value: string }, ['selector', 'value']) },
  { name: 'press', description: 'Press a key on an element identified by a CSS selector.', inputSchema: object({ selector: string, key: string }, ['selector', 'key']) },
  { name: 'scroll', description: 'Scroll the page by pixel deltas.', inputSchema: object({ deltaY: { type: 'number' }, deltaX: { type: 'number' } }, ['deltaY']) },
];

// Generic DOM serialization only. No store imports, task logic, AX snapshots or WebMCP calls.
export async function createDomRuntime({ targetUrl } = {}) {
  if (!targetUrl) throw new Error('DOM runtime requires a target URL');
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=WebMCP'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(15000);
  let opened = false;
  const readDom = async ({ selector = 'body' } = {}) => {
    if (!opened) throw new Error('Call open_page before reading or interacting with the page');
    const dom = await page.locator(selector).evaluate((root) => {
      const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
      const omitted = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'SVG', 'PATH']);
      const attributes = ['id', 'class', 'name', 'type', 'href', 'for', 'placeholder', 'title', 'alt', 'role', 'aria-label', 'aria-expanded', 'data-testid'];
      function visit(node) {
        if (node.nodeType === Node.TEXT_NODE) return escape(node.textContent.replace(/\s+/g, ' '));
        if (node.nodeType !== Node.ELEMENT_NODE || omitted.has(node.tagName)) return '';
        const style = getComputedStyle(node);
        if (node.hidden || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return '';
        const tag = node.tagName.toLowerCase();
        let attrs = attributes.filter((name) => node.hasAttribute(name)).map((name) => ` ${name}="${escape(node.getAttribute(name))}"`).join('');
        if (['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(node.tagName)) attrs += ` value="${escape(node.value)}"`;
        if (node.checked) attrs += ' checked';
        if (node.selected) attrs += ' selected';
        if (node.disabled) attrs += ' disabled';
        const content = [...node.childNodes].map(visit).join('').trim();
        if (!content && !attrs && !['input', 'br', 'hr'].includes(tag)) return '';
        return ['input', 'img', 'br', 'hr'].includes(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>${content}</${tag}>`;
      }
      return visit(root);
    });
    return { url: page.url(), dom: dom.slice(0, 100000), truncated: dom.length > 100000 };
  };
  const action = (perform) => async (input) => {
    if (!opened) throw new Error('Call open_page first');
    await perform(input);
    return { ok: true };
  };
  return {
    toolDefinitions: domToolDefinitions,
    tools: {
      open_page: async () => {
        await page.goto(targetUrl, { waitUntil: 'networkidle' });
        opened = true;
        return readDom();
      },
      dom: readDom,
      click: action(({ selector }) => page.locator(selector).click()),
      type: action(({ selector, text }) => page.locator(selector).fill(text)),
      select: action(({ selector, value }) => page.locator(selector).selectOption(value)),
      press: action(({ selector, key }) => page.locator(selector).press(key)),
      scroll: action(({ deltaX = 0, deltaY }) => page.mouse.wheel(deltaX, deltaY)),
    },
    close: () => browser.close(),
  };
}
