import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createDomRuntime } from '../src/runner/runtimes/dom.js';

test('DOM tools read rendered page content and operate controls without exposing source or hidden state', async () => {
  const server = createServer((_req, response) => response.end(`<!doctype html><html><body>
    <style>.hidden { display:none }</style>
    <script>window.privateState = 'INTERNAL_SECRET'</script>
    <div hidden>HIDDEN_SECRET</div><div class="hidden">CSS_SECRET</div>
    <h1>Visible catalog</h1><label>Name <input id="name" value="before"></label>
    <select id="category"><option value="all">All</option><option value="books">Books</option></select>
    <button id="go" onclick="document.querySelector('#result').textContent = document.querySelector('#name').value">Apply</button>
    <p id="result">Ready</p><svg><path d="SVG_SECRET"></path></svg>
  </body></html>`));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let runtime;
  try {
    runtime = await createDomRuntime({ targetUrl: `http://127.0.0.1:${server.address().port}` });
    const first = await runtime.tools.open_page({});
    assert.match(first.dom, /Visible catalog/);
    assert.match(first.dom, /id="name"/);
    assert.doesNotMatch(first.dom, /INTERNAL_SECRET|HIDDEN_SECRET|CSS_SECRET|SVG_SECRET|onclick|<script|<style/);
    await runtime.tools.type({ selector: '#name', text: 'changed' });
    await runtime.tools.select({ selector: '#category', value: 'books' });
    await runtime.tools.click({ selector: '#go' });
    const second = await runtime.tools.dom({});
    assert.match(second.dom, /<p id="result">changed<\/p>/);
    assert.match(second.dom, /value="changed"/);
    assert.match(second.dom, /value="books" selected/);
    const focused = await runtime.tools.dom({ selector: '#result' });
    assert.equal(focused.dom, '<p id="result">changed</p>');
    assert.equal(typeof runtime.tools.evaluate, 'undefined');
    assert.equal(typeof runtime.tools.search_products, 'undefined');
  } finally {
    await runtime?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});


