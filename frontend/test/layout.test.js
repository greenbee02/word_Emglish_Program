import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../src/layout.js';
test('imported labels and identifiers cannot escape HTML attributes', () => {
  assert.equal(escapeHtml('\" onfocus=\"alert(1)\" <script>\'&'), '&quot; onfocus=&quot;alert(1)&quot; &lt;script&gt;&#39;&amp;');
});
