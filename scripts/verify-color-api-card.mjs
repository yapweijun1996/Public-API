import fs from 'node:fs';
import assert from 'node:assert/strict';
import { browser, evidence, root } from './lib/pages-origin-browser.mjs';

const requestUrl = 'https://www.thecolorapi.com/id?hex=24B1E0';
const wrongColor = {
  hex: { value: '#FF0000', clean: 'FF0000' },
  name: { value: 'Red', exact_match_name: true, closest_named_hex: '#FF0000' },
  rgb: { value: 'rgb(255, 0, 0)' },
  hsl: { value: 'hsl(0, 100%, 50%)' },
  hsv: { value: 'hsv(0, 100%, 100%)' },
  cmyk: { value: 'cmyk(0, 100, 100, 0)' },
  XYZ: { value: 'XYZ(41, 21, 2)' },
  contrast: { value: '#FFFFFF' },
};

const report = { origin: 'https://yapweijun1996.github.io', cases: [] };
console.log('Evidence directory:', evidence);

const accessibilityCheck = async (b) => {
  const ax = await b.call('Accessibility.getFullAXTree');
  return ax.nodes.filter((node) => !node.ignored && ['button', 'combobox', 'textbox', 'spinbutton', 'searchbox', 'tab', 'radio', 'link'].includes(node.role?.value) && !(node.name?.value || '').trim());
};

const responsiveCheck = async (b) => {
  const results = [];
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 780]]) {
    await b.viewport(width, height);
    results.push({
      viewport: [width, height],
      documentOverflow: await b.ev('document.documentElement.scrollWidth > document.documentElement.clientWidth + 1'),
      shellOverflow: await b.ev('document.querySelector(".demo-preview").scrollWidth > document.querySelector(".demo-preview").clientWidth + 1'),
      cardOverflow: await b.ev('document.querySelector("[data-domain-card]").scrollWidth > document.querySelector("[data-domain-card]").clientWidth + 1'),
    });
  }
  for (const result of results) assert.equal(result.documentOverflow || result.shellOverflow || result.cardOverflow, false, JSON.stringify(result));
  return results;
};

async function liveCase() {
  const b = await browser(root + '/dist');
  try {
    await b.nav('color-api');
    const requestedInput = await b.ev('document.querySelector("#parameter-hex").value');
    const result = await b.run();
    assert.equal(result.ok, true, `Live The Color API request unresolved: ${result.error || 'unknown error'}`);
    const semantic = await b.ev(`(()=>{const card=document.querySelector('[data-domain-card="color-swatch"]');return {state:card?.dataset.resultState||'',requestedHex:card?.dataset.requestedHex||'',providerHex:card?.dataset.providerHex||'',requestBound:card?.dataset.requestBound||'',identityMatch:card?.dataset.identityMatch||'',contractValid:card?.dataset.contractValid||'',swatch:card?.querySelector('[role="img"]')?.getAttribute('aria-label')||'',endpoint:document.querySelector('.endpoint-box code')?.textContent||''}})()`);
    assert.equal(semantic.state, 'ready');
    assert.equal(semantic.requestedHex, result.data.hex.value.toUpperCase());
    assert.equal(semantic.providerHex, result.data.hex.value.toUpperCase());
    assert.deepEqual({ requestBound: semantic.requestBound, identityMatch: semantic.identityMatch, contractValid: semantic.contractValid }, { requestBound: 'true', identityMatch: 'true', contractValid: 'true' });
    assert.equal(semantic.swatch, `Color swatch ${result.data.hex.value.toUpperCase()}`);
    assert(semantic.endpoint.includes('/id?hex='), `Unexpected displayed endpoint: ${semantic.endpoint}`);
    await b.ev(`(()=>{const input=document.querySelector('#parameter-hex');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'FFFFFF')})()`);
    assert.equal(await b.ev('document.querySelector("[data-domain-card=\\"color-swatch\\"]").dataset.requestedHex'), semantic.requestedHex, 'Semantic card changed with mutable form DOM after execution');
    const unnamedControls = await accessibilityCheck(b);
    assert.deepEqual(unnamedControls, []);
    report.cases.push({ kind: 'live-provider', requestedInput, responseHex: result.data.hex.value, semantic, viewports: await responsiveCheck(b), unnamedControls: unnamedControls.length, fixtureRequests: b.fixtureRequests.length, blockedProviders: b.blockedProviders });
  } finally {
    await b.close();
  }
}

async function syntheticMismatchCase() {
  const b = await browser(root + '/dist', { fixtures: new Map([[requestUrl, { body: wrongColor }]]) });
  try {
    await b.nav('color-api');
    const result = await b.run();
    assert.equal(result.ok, true, `Synthetic HTTP-200 fixture did not reach the semantic adapter: ${result.error || 'unknown error'}`);
    const semantic = await b.ev(`(()=>{const card=document.querySelector('[data-domain-card="color-swatch"]');return {state:card?.dataset.resultState||'',requestedHex:card?.dataset.requestedHex||'',providerHex:card?.dataset.providerHex||'',requestBound:card?.dataset.requestBound||'',identityMatch:card?.dataset.identityMatch||'',contractValid:card?.dataset.contractValid||'',swatch:Boolean(card?.querySelector('[role="img"]')),message:card?.querySelector('p')?.textContent||''}})()`);
    assert.deepEqual(semantic, { state: 'invalid', requestedHex: '#24B1E0', providerHex: '#FF0000', requestBound: 'true', identityMatch: 'false', contractValid: 'false', swatch: false, message: 'The provider color does not match the color in the executed The Color API request.' });
    assert.equal(b.fixtureRequests.filter((request) => request.url === requestUrl && request.method === 'GET').length, 1);
    const unnamedControls = await accessibilityCheck(b);
    assert.deepEqual(unnamedControls, []);
    report.cases.push({ kind: 'synthetic-wrong-identity-http-200', responseHex: result.data.hex.value, semantic, viewports: await responsiveCheck(b), unnamedControls: unnamedControls.length, fixtureRequests: b.fixtureRequests });
  } finally {
    await b.close();
  }
}

try {
  await liveCase();
  await syntheticMismatchCase();
  report.verdict = 'PASS';
} catch (error) {
  report.verdict = 'UNRESOLVED_OR_FAIL';
  report.error = String(error);
  console.error(error);
}
fs.writeFileSync(`${evidence}/color-api-verification.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.verdict === 'PASS' ? 0 : 1);
