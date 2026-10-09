import assert from 'node:assert/strict'
import fs from 'node:fs'
import { browser, evidence, root } from './lib/pages-origin-browser.mjs'

const endpoint = 'https://randomuser.me/api/1.4/?results=3&nat=au'
const report = { origin:'https://yapweijun1996.github.io', publication:'unpublished local app bundle under the real GitHub Pages origin', source:'one live Random User request plus one synthetic HTTP-200 semantic fixture', checks:[], errors:[] }
const unnamed = (nodes) => nodes.filter((node) => !node.ignored && ['button','combobox','textbox','spinbutton','searchbox','tab','radio','link'].includes(node.role?.value) && !(node.name?.value || '').trim())
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const trusted = (row) => uuid.test(row?.login?.uuid || '') && row?.nat === 'AU' && typeof row?.name?.first === 'string' && typeof row?.name?.last === 'string' && /^https:\/\/randomuser\.me\/api\/portraits\/(?:men|women)\/\d+\.jpg$/.test(row?.picture?.large || '')
const semantic = (b) => b.ev(`(() => { const shell=document.querySelector('.demo-preview'); const card=shell?.querySelector('[data-domain-card="random-user-people"]'); return { layout:shell?.dataset.previewLayout||'', fallback:shell?.dataset.ssotFallback||'', state:card?.dataset.resultState||'', requestBound:card?.dataset.requestBound||'', requestContract:card?.dataset.requestContract||'', count:Number(card?.dataset.requestCount||0), nationality:card?.dataset.requestNationality||'', providerCount:Number(card?.dataset.providerRecordCount||0), validCount:Number(card?.dataset.validProfileCount||0), malformed:Number(card?.dataset.malformedProfileCount||0), duplicates:Number(card?.dataset.duplicateProfileCount||0), wrongNationality:Number(card?.dataset.wrongNationalityCount||0), supplementalMalformed:Number(card?.dataset.supplementalMalformedCount||0), primaryUuid:card?.dataset.primaryProfileUuid||'', text:card?.innerText||'' }; })()`)
const fixtureProfile = (id, overrides={}) => ({ gender:'female', name:{ first:'Alex', last:'Example' }, location:{ city:'Sydney', state:'New South Wales', country:'Australia' }, email:'generated@example.com', login:{ uuid:id, username:'fixture', password:'hidden', md5:'hash' }, dob:{ age:36 }, phone:'0000', id:{ name:'TFN', value:'123456789' }, picture:{ large:'https://randomuser.me/api/portraits/women/1.jpg' }, nat:'AU', ...overrides })
let active
try {
  const live=await browser(`${root}/dist`); active=live
  await live.nav('people')
  assert.equal(await live.ev(`document.querySelector('.endpoint-box code')?.textContent||''`),endpoint)
  const before=live.requestCount
  const result=await live.run(); assert.equal(result.ok,true,result.error)
  assert.equal(live.requestCount-before,1,'Random User verifier must issue exactly one live provider request')
  assert.equal(result.data?.info?.version,'1.4')
  assert.equal(result.data?.info?.page,1)
  assert.equal(result.data?.info?.results,3)
  assert.equal(result.data?.results?.length,3)
  assert(result.data.results.every(trusted),'Random User generated-profile contract drifted')
  const expectedPrimary=result.data.results[0].login.uuid.toLowerCase()
  const dom=await semantic(live)
  assert.deepEqual({layout:dom.layout,fallback:dom.fallback,state:dom.state,requestBound:dom.requestBound,requestContract:dom.requestContract,count:dom.count,nationality:dom.nationality,providerCount:dom.providerCount,validCount:dom.validCount,malformed:dom.malformed,duplicates:dom.duplicates,wrongNationality:dom.wrongNationality,supplementalMalformed:dom.supplementalMalformed,primaryUuid:dom.primaryUuid},{layout:'synthetic-people',fallback:'false',state:'ready',requestBound:'true',requestContract:'exact-randomuser-1.4-v2',count:3,nationality:'au',providerCount:3,validCount:3,malformed:0,duplicates:0,wrongNationality:0,supplementalMalformed:0,primaryUuid:expectedPrimary})
  assert(dom.text.toLowerCase().includes('synthetic test profiles'))
  assert(dom.text.toLowerCase().includes('intentionally omits generated email, phone, street address'))
  assert.equal(dom.text.includes(result.data.results[0].email),false,'Generated email must not be foregrounded in semantic UI')
  assert.equal(dom.text.includes(result.data.results[0].phone),false,'Generated phone must not be foregrounded in semantic UI')
  await live.viewport(390,844)
  const mobile=await live.ev(`({documentOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,previewOverflow:document.querySelector('.demo-preview').scrollWidth>document.querySelector('.demo-preview').clientWidth+1})`)
  assert.equal(mobile.documentOverflow||mobile.previewOverflow,false,JSON.stringify(mobile))
  const ax=await live.call('Accessibility.getFullAXTree'); assert.equal(unnamed(ax.nodes).length,0)
  assert.deepEqual(live.errors,[])
  report.checks.push({id:'people',source:'live provider',exactRequest:endpoint,returnedProfiles:3,primaryUuid:expectedPrimary,semanticState:dom.state,requestBound:dom.requestBound,browserCorsReadable:true,mobileOverflow:false,unnamedControls:0,generatedContactHidden:true})
  await live.close(); active=undefined

  const first='11111111-1111-4111-8111-111111111111'
  const fixtureBody={results:[fixtureProfile(first),fixtureProfile(first,{name:{first:'Duplicate',last:'Fixture'},dob:{age:'36'},picture:{large:'https://randomuser.me/api/portraits/women/2.jpg'}}),fixtureProfile('33333333-3333-4333-8333-333333333333',{nat:'US',name:{first:'Wrong',last:'Nationality'},picture:{large:'https://randomuser.me/api/portraits/men/3.jpg'}})],info:{seed:'fixture-seed',results:3,page:1,version:'1.4'}}
  const fixture=await browser(`${root}/dist`,{fixtures:new Map([[endpoint,{body:fixtureBody}]])}); active=fixture
  await fixture.nav('people')
  const fixtureBefore=fixture.requestCount
  const fixtureResult=await fixture.run(); assert.equal(fixtureResult.ok,true,fixtureResult.error)
  const fixtureDom=await semantic(fixture)
  assert.deepEqual({state:fixtureDom.state,requestBound:fixtureDom.requestBound,validCount:fixtureDom.validCount,malformed:fixtureDom.malformed,duplicates:fixtureDom.duplicates,wrongNationality:fixtureDom.wrongNationality,supplementalMalformed:fixtureDom.supplementalMalformed,primaryUuid:fixtureDom.primaryUuid},{state:'partial',requestBound:'true',validCount:1,malformed:0,duplicates:1,wrongNationality:1,supplementalMalformed:1,primaryUuid:first})
  assert.equal(fixtureDom.text.includes('Duplicate Fixture'),false)
  assert.equal(fixtureDom.text.includes('Wrong Nationality'),false)
  assert.equal(fixtureDom.text.includes('generated@example.com'),false)
  const fixtureRequests=fixture.fixtureRequests.filter((request)=>request.url===endpoint&&request.method==='GET').length
  assert.equal(fixtureRequests,1)
  assert.equal(fixture.requestCount-fixtureBefore,fixtureRequests,'Fixture Random User case must send zero live provider requests')
  assert.deepEqual(fixture.errors,[])
  report.checks.push({id:'people',case:'duplicate/wrong-nationality/malformed-supplemental HTTP-200 fixture',source:'synthetic fixture',semanticState:fixtureDom.state,validProfiles:1,duplicateProfiles:1,wrongNationalityProfiles:1,supplementalMalformed:1,fabricatedIdentityHidden:true,generatedPiiHidden:true,liveProviderRequests:0})
  await fixture.close(); active=undefined
  report.verdict='PASS'
} catch(error) {
  report.verdict='FAIL'; report.error=String(error)
  if(active){report.errors.push(...active.errors.map(String));report.networkFailures=active.networkFailures}
} finally { if(active) await active.close() }
fs.writeFileSync(`${evidence}/random-user-card.json`,`${JSON.stringify(report,null,2)}\n`)
console.log(JSON.stringify({...report,evidence:`${evidence}/random-user-card.json`},null,2))
process.exit(report.verdict==='PASS'?0:1)
