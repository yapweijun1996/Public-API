import assert from 'node:assert/strict'
import { browser, root } from './lib/pages-origin-browser.mjs'
const endpoint='https://pokeapi.co/api/v2/pokemon/pikachu'
let b
try {
  b=await browser(`${root}/dist`)
  await b.nav('pokeapi')
  assert.equal(await b.ev(`document.querySelector('.endpoint-box code')?.textContent||''`),endpoint)
  const before=b.requestCount
  const r=await b.run()
  assert.equal(r.ok,true,r.error)
  assert.equal(b.requestCount-before,1)
  const dom=await b.ev(`(()=>{const s=document.querySelector('.demo-preview');const c=s?.querySelector('[data-domain-card="pokeapi-pokemon"]');return{layout:s?.dataset.previewLayout,state:c?.dataset.resultState,bound:c?.dataset.requestBound,id:c?.dataset.pokemonId,name:c?.dataset.pokemonName,types:c?.dataset.typeCount,abilities:c?.dataset.abilityCount,stats:c?.dataset.statCount,malformed:c?.dataset.malformedEvidenceCount,duplicates:c?.dataset.duplicateEvidenceCount,spriteGap:c?.dataset.spriteGap,text:c?.innerText||''}})()`)
  await b.viewport(390,844)
  const overflow=await b.ev(`document.documentElement.scrollWidth>document.documentElement.clientWidth+1||document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1`)
  const ax=await b.call('Accessibility.getFullAXTree')
  const unnamed=ax.nodes.filter(n=>!n.ignored&&['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(n.role?.value)&&!(n.name?.value||'').trim()).length
  console.log(JSON.stringify({ok:true,liveRequests:b.requestCount-before,provider:{id:r.data?.id,name:r.data?.name,types:r.data?.types?.length,abilities:r.data?.abilities?.length,stats:r.data?.stats?.length,corsReadable:true},dom,overflow,unnamed},null,2))
} finally { if(b) await b.close() }
