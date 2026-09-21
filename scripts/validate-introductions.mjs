import fs from 'node:fs'
import path from 'node:path'
const root = new URL('..', import.meta.url).pathname
const vocab = JSON.parse(fs.readFileSync(path.join(root, 'src/data/vocabulary.json'), 'utf8'))
const chaptersDir = path.join(root, 'src/data/chapters')
const chapters = fs.readdirSync(chaptersDir).filter(f => /^b\dc\d+\.json$/.test(f)).sort().map(f => JSON.parse(fs.readFileSync(path.join(chaptersDir, f), 'utf8')))

const irregular = {
  is:'be', are:'be', am:'be', was:'be', were:'be', been:'be', being:'be',
  has:'have', had:'have', does:'do', did:'do', done:'do', doing:'do',
  goes:'go', went:'go', gone:'go', going:'go', says:'say', said:'say',
  children:'child', men:'man', women:'woman', people:'person', feet:'foot', teeth:'tooth', mice:'mouse', geese:'goose',
  knives:'knife', wives:'wife', took:'take', taken:'take', ran:'run', ate:'eat', eaten:'eat', drank:'drink', drunk:'drink',
  saw:'see', seen:'see', came:'come', gave:'give', given:'give', got:'get', gotten:'get', made:'make', found:'find', told:'tell',
  thought:'think', bought:'buy', brought:'bring', sat:'sit', slept:'sleep', wrote:'write', written:'write', read:'read', swam:'swim',
  sang:'sing', drew:'draw', drawn:'draw', knew:'know', known:'know', broke:'break', broken:'break', wore:'wear', worn:'wear',
  forgot:'forget', heard:'hear', felt:'feel', stood:'stand', spoke:'speak', spoken:'speak', began:'begin', better:'good', worse:'bad'
}
const norm = s => s.toLowerCase().replace(/[’]/g,"'").replace(/[‑–—]/g,'-')
const surfaceIds = new Map()
for (const w of vocab) for (const form of norm(w.word).split(/,\s*/)) {
  const f=form.trim(); surfaceIds.set(f,[...(surfaceIds.get(f)||[]),w.id])
}
const lemma = new Map()
const phrases = new Map()
for (const w of vocab) for (const form of norm(w.word).split(/,\s*/)) {
  const f=form.trim(); if (f.includes(' ')) { if (!phrases.has(f)) phrases.set(f,w.id) } else if (!lemma.has(f)) lemma.set(f,w.id)
}
for (const w of vocab) lemma.set(w.id,w.id)
function firstExisting(cs){ for(const c of [...new Set(cs)]) if(lemma.has(c)) return lemma.get(c) }
function lemmaOf(token){
  const t=norm(token); if(lemma.has(t)) return lemma.get(t); if(irregular[t] && lemma.has(irregular[t])) return lemma.get(irregular[t])
  const c=[]
  if(t.endsWith('ies')&&t.length>3)c.push(t.slice(0,-3)+'y')
  if(t.endsWith('es')&&t.length>3){c.push(t.slice(0,-1));c.push(t.slice(0,-2))} else if(t.endsWith('s')&&t.length>3)c.push(t.slice(0,-1))
  if(t.endsWith('ied')&&t.length>3)c.push(t.slice(0,-3)+'y')
  if(t.endsWith('ing')&&t.length>4){const s=t.slice(0,-3);c.push(s,s.replace(/(.)\1$/,'$1'),s+'e')}
  if(t.endsWith('ed')&&t.length>3){const s=t.slice(0,-2);c.push(s,s.replace(/(.)\1$/,'$1'),s+'e')}
  if(t.endsWith('er')&&t.length>4)c.push(t.slice(0,-2)); if(t.endsWith('est')&&t.length>5)c.push(t.slice(0,-3)); if(t.endsWith('ly')&&t.length>4)c.push(t.slice(0,-2))
  return firstExisting(c)
}
function prevWords(spans,i,count=2){const out=[];for(let j=i-1;j>=0&&out.length<count;j--)if(spans[j].isWord)out.push(norm(spans[j].raw));return out}
function contextual(raw,id,ids,spans,i){
  if(ids.includes('like')&&ids.includes('like-2')){const form=norm(raw);if(form!=='like')return 'like-2';const prev=prevWords(spans,i,2);if(prev.some(w=>['am','is','are','was','were','be','been','being'].includes(w)))return 'like';return 'like-2'}
  if(ids.includes('second')&&ids.includes('second-2')){const [prev]=prevWords(spans,i,1);if(['one','a','an'].includes(prev))return 'second-2';return 'second'}
  return id
}
function idsInSentence(en){
  const spans=[]; const re=/[A-Za-z]+(?:[-‑'’][A-Za-z]+)*/g; let last=0; let m
  while((m=re.exec(en))){if(m.index>last)spans.push({raw:en.slice(last,m.index),isWord:false});spans.push({raw:m[0],isWord:true});last=m.index+m[0].length}
  if(last<en.length)spans.push({raw:en.slice(last),isWord:false})
  const found=[]
  for(let i=0;i<spans.length;i++){
    const sp=spans[i]; if(!sp.isWord)continue; const lower=norm(sp.raw); let matched=false
    for(let len=3;len>=2&&!matched;len--){let cand=lower,j=i,words=1;while(words<len){const sep=spans[j+1],n=spans[j+2];if(!sep||!n||sep.isWord||!n.isWord||sep.raw!==' ')break;cand+=' '+norm(n.raw);j+=2;words++}if(words!==len)continue;const pid=phrases.get(cand);if(!pid)continue;const ids=surfaceIds.get(cand)||[pid];found.push(contextual(cand,pid,ids,spans,i));i=j;matched=true}
    if(matched)continue; const id=lemmaOf(lower); if(!id)continue; const ids=surfaceIds.get(norm(vocab.find(v=>v.id===id)?.word||lower))||[id]; found.push(contextual(sp.raw,id,ids,spans,i))
  }
  return new Set(found)
}
let missing=[]
for(const ch of chapters){const seen=new Set();for(const s of ch.sentences)for(const id of idsInSentence(s.en))seen.add(id);for(const id of ch.new)if(!seen.has(id))missing.push(`${ch.id}: ${id}`)}
if(missing.length){console.error(`Vocabulary-introduction validation failed (${missing.length}):\n${missing.join('\n')}`);process.exit(1)}
console.log(`Vocabulary-introduction validation passed: all ${vocab.length} target words appear in their assigned introduction chapters.`)
