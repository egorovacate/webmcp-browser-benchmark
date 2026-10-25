import { chromium } from '@playwright/test';

export const BENCHMARK_VIEWPORT = Object.freeze({ width: 1440, height: 900 });

const toolDefinitions = [
  { name: 'dom', description: 'Return the current page DOM as HTML.', inputSchema: { type: 'object' } },
  {
    name: 'click',
    description: 'Click a page element using a CSS selector.',
    inputSchema: {
      type: 'object',
      properties: { selector: { type: 'string' } },
      required: ['selector'],
    },
  },
  {
    name: 'type',
    description: 'Fill a page input using a CSS selector.',
    inputSchema: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } }, required: ['selector', 'text'] },
  },
  {
    name: 'press',
    description: 'Press a key on a page element selected by CSS selector.',
    inputSchema: { type: 'object', properties: { selector: { type: 'string' }, key: { type: 'string' } }, required: ['selector', 'key'] },
  },
  {
    name: 'scroll',
    description: 'Scroll the current browser viewport by pixel deltas.',
    inputSchema: {
      type: 'object',
      properties: { deltaX: { type: 'number' }, deltaY: { type: 'number' } },
      required: ['deltaY'],
    },
  },
];

export async function createVisualRuntime({
  targetUrl,
  browserLauncher = chromium,
  viewport = BENCHMARK_VIEWPORT,
  headless = true,
} = {}) {
  if (!targetUrl) throw new Error('visual runtime requires a target URL');
  if (viewport.width !== BENCHMARK_VIEWPORT.width || viewport.height !== BENCHMARK_VIEWPORT.height) {
    throw new Error('visual benchmark viewport must be 1440x900');
  }
  const browser = await browserLauncher.launch({ channel: 'chrome', headless });
  const page = await browser.newPage({ viewport });
  await page.goto(targetUrl);

  return {
    toolDefinitions: structuredClone(toolDefinitions),
    tools: {
      dom: async () => ({ html: await page.content() }),
      click: ({ selector }) => page.locator(selector).click(),
      type: ({ selector, text }) => page.locator(selector).fill(text),
      press: ({ selector, key }) => page.locator(selector).press(key),
      scroll: ({ deltaX = 0, deltaY }) => page.mouse.wheel(deltaX, deltaY),
    },
    async close() {
      await page.close();
      await browser.close();
    },
  };
}
