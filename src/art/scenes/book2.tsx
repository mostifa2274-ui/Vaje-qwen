import { Bush, Cloud, Grass, Ground, Hills, Notes, Sky, StringLights, Sun, Tree } from '../kit'
import { CRIMSON, INK, PAPER, outline } from '../tokens'
import { Bird, Cast, Dog, Figure, Flock } from '../characters'
import { DAD, MINA, MOM } from '../cast'
import { Bench, Boxes, Building, Bus, Car, Easel, Fountain, Goal, Guitar, Hoop, House, Piano, Pool, Road, Shop, StreetLamp } from '../outdoor'
import type { Scene } from './types'

const OLD_MAN = { build: 'elder' as const, skin: '#e2b391', hair: '#d6d0c7', hairStyle: 'bald' as const, beard: true, glasses: true, top: '#8b7a5a', bottom: '#4b4a44', outfit: 'pants' as const }

export const BOOK2: Record<string, Scene> = {
  b2c1: {
    alt: 'مینا با عکس نینو در خیابانِ نزدیک پارک راه می‌رود؛ کنار در پارک کافه‌ای کوچک است، پیرمردی روی نیمکت روزنامه می‌خواند، دختری با سگ کوچکش ایستاده و کبوترها کنار فواره دانه می‌خورند.',
    draw: () => (
      <>
        <Sky time="day" />
        <Cloud x={180} y={70} s={1.1} /><Cloud x={560} y={52} s={.8} />
        <Building x={-10} y={250} w={130} h={170} color="#d7c4ae" rows={4} cols={3} />
        <Building x={640} y={250} w={170} h={150} color="#c7cfc6" rows={3} cols={4} />
        <Tree x={470} y={262} s={.9} leaf="#8db07e" dark="#6f9a6b" />
        <Tree x={700} y={268} s={1} />
        <Ground y={262} fill="#b6c99c" />
        <rect y={290} width={800} height={130} fill="#d8cdb6" />
        <path d="M0 290 H800" {...outline(2)} opacity=".35" />
        <Shop x={40} y={300} w={220} h={180} wall="#e9d8bd" awning={['#6f9a6b', PAPER]} display={<g><circle cx="30" cy="54" r="10" fill="#fbfaf5" /><circle cx="70" cy="54" r="10" fill="#fbfaf5" /></g>} />
        <path d="M430 300 V180 M600 300 V180" stroke="#3e4450" strokeWidth="7" strokeLinecap="round" />
        <path d="M430 186 C470 160 560 160 600 186" fill="none" stroke="#3e4450" strokeWidth="6" />
        <Fountain x={560} y={330} />
        {[[520, 342], [600, 346], [632, 338]].map(([bx, by], index) => <Bird key={index} x={bx} y={by} s={.5} color="#8d8f93" flip={index === 1} />)}
        <Bench x={640} y={380} w={120} />
        <Figure {...OLD_MAN} x={700} y={372} pose="sit" arms={['hold', 'hold']} holding={{ item: 'paper' }} expression="calm" shadow={false} />
        <Cast who={MINA} x={330} y={392} pose="walk" arms={['down', 'hold']} holding={{ item: 'photo' }} expression="worried" />
        <Figure build="child" skin="#d9a07a" hair="#2c1d17" hairStyle="bob" top="#e2b440" bottom="#c9766f" outfit="dress" legs="#d9a07a" x={440} y={398} arms={['down', 'out']} expression="smile" />
        <Dog x={484} y={402} s={.7} />
        <Grass x={20} y={296} /><Grass x={780} y={300} />
      </>
    ),
  },
  b2c2: {
    alt: 'مینا و پدر در خیابانِ همسایه‌ها عکس نینو را به پیرمرد همسایه نشان می‌دهند؛ دوست مدرسهٔ مینا دست تکان می‌دهد و خانوادهٔ تازه‌ای با جعبه‌های اسباب‌کشی از راه رسیده است.',
    draw: () => (
      <>
        <Sky time="day" />
        <Cloud x={620} y={60} />
        <House x={10} y={318} w={230} h={170} wall="#e7c9b0" roof="#a9544a" door="#5f7891" />
        <House x={280} y={318} w={230} h={180} wall="#d9dcc6" roof="#6f7a5a" door="#b8574a" />
        <House x={550} y={318} w={230} h={165} wall="#e9dcc0" roof="#8d5a7a" door="#6f9a6b" />
        <rect y={318} width={800} height={102} fill="#d8cdb6" />
        <path d="M0 318 H800" {...outline(2)} opacity=".35" />
        <Figure {...OLD_MAN} x={396} y={330} arms={['hold', 'down']} expression="smile" s={.9} shadow={false} />
        <Cast who={DAD} x={270} y={404} flip arms={['down', 'point']} expression="talk" />
        <Cast who={MINA} x={340} y={410} arms={['down', 'hold']} holding={{ item: 'photo' }} expression="worried" />
        <Figure build="child" skin="#e0ae88" hair="#2c1d17" hairStyle="cap" top="#5f7891" bottom="#3d4a5c" x={500} y={408} arms={['wave', 'down']} expression="happy" accent={CRIMSON} />
        <Boxes x={620} y={400} />
        <g transform="translate(166 398)">
          <path d="M-22 0 C-26 -26 -10 -30 -12 -40 C-4 -36 4 -36 12 -40 C10 -30 26 -26 22 0Z" fill="#1f1e1c" {...outline(1.8)} />
        </g>
        <Figure build="adult" skin="#e8b894" hair="#6a4a3a" hairStyle="long" top="#e2b440" bottom="#56617e" outfit="skirt" legs="#e8b894" x={750} y={404} arms={['wave', 'hip']} expression="happy" s={.92} />
      </>
    ),
  },
  b2c3: {
    alt: 'بازی در پارک: پسرها روی چمن فوتبال بازی می‌کنند و توپ قرمز به سمت مینا غلت می‌خورد؛ پشت سرشان حلقهٔ بسکتبال و استخر کوچکِ کلاس شنا دیده می‌شود.',
    draw: () => (
      <>
        <Sky time="day" />
        <Sun x={120} y={70} r={30} />
        <Hills y={222} color="#b9cda8" seed={9} far />
        <Tree x={60} y={240} s={.9} /><Tree x={740} y={236} s={.85} leaf="#8db07e" />
        <Ground y={232} fill="#9fbf85" />
        <path d="M0 232 H800 V420 H0Z" fill="none" />
        {[0, 1, 2, 3].map(index => <rect key={index} x={index * 200} y={232} width="100" height="188" fill="#fff" opacity=".07" />)}
        <Hoop x={640} y={300} />
        <Pool x={430} y={288} w={180} h={40} />
        <Goal x={80} y={330} w={150} h={84} />
        <Figure build="teen" skin="#d9a07a" hair="#2c1d17" hairStyle="short" top="#e0e6ea" bottom="#3d4a5c" outfit="shorts" legs="#d9a07a" x={250} y={380} pose="walk" arms={['out', 'up']} expression="happy" />
        <Figure build="teen" skin="#efc6a0" hair="#6b4a2e" hairStyle="curly" top={CRIMSON} bottom="#3d4a5c" outfit="shorts" legs="#efc6a0" x={360} y={372} pose="walk" flip arms={['out', 'down']} expression="surprised" />
        <g transform="translate(470 396)">
          <circle cx="0" cy="-10" r="12" fill="#d9453f" {...outline(2)} />
          <path d="M-11 -13 C-3 -9 3 -9 11 -13" fill="none" stroke="#fff" strokeWidth="1.8" />
          <path d="M-40 -6 H-22 M-44 -14 H-26" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".4" />
        </g>
        <Cast who={MINA} x={560} y={404} flip arms={['reach', 'hold']} holding={{ item: 'photo' }} expression="calm" />
        <Bush x={760} y={336} />
        <Grass x={180} y={404} /><Grass x={640} y={410} />
      </>
    ),
  },
  b2c4: {
    alt: 'آواز در خیابان: کنار کافه، مردی آواز می‌خواند، مرد دیگری گیتار می‌زند و پیانوی سیاه روی سکو است؛ مینا و مادرش با لبخند دست می‌زنند و نقاشی کنار کافه چهره می‌کشد.',
    draw: () => (
      <>
        <Sky time="evening" />
        <Building x={-20} y={300} w={180} h={250} color="#c9a896" rows={5} cols={3} lit={2} />
        <Building x={620} y={300} w={200} h={240} color="#b8b0a4" rows={5} cols={4} lit={2} />
        <Shop x={150} y={300} w={210} h={170} wall="#e7c9b0" awning={[CRIMSON, PAPER]} />
        <StringLights x1={150} x2={620} y={118} />
        <rect y={300} width={800} height={120} fill="#cdbfa6" />
        <rect x={440} y={300} width={200} height={20} fill="#9a6b47" {...outline(2)} />
        <Piano x={580} y={300} s={.8} />
        <Figure build="adult" skin="#e0ae88" hair="#2f2622" hairStyle="short" top="#3f4a5a" bottom="#2f3440" x={500} y={300} pose="sit" arms={['hold', 'hold']} expression="calm" s={.8} shadow={false} />
        <Figure build="adult" skin="#d9a07a" hair="#2f2622" hairStyle="short" top={CRIMSON} bottom="#3e4450" outfit="pants" x={420} y={372} arms={['out', 'chest']} expression="talk" />
        <Notes x={364} y={160} color={INK} s={1.1} />
        <Notes x={610} y={170} color={CRIMSON} s={.8} />
        <Figure build="adult" skin="#efc6a0" hair="#6b4a2e" hairStyle="curly" top="#6f9a6b" bottom="#3e4450" x={330} y={380} arms={['hold', 'hold']} expression="smile" />
        <Guitar x={324} y={292} s={1.1} rotate={-60} />
        <Cast who={MOM} x={170} y={402} arms={['chest', 'chest']} expression="happy" />
        <Cast who={MINA} x={240} y={408} flip arms={['chest', 'chest']} expression="happy" />
        <Easel x={700} y={404}>
          <circle cx="42" cy="32" r="16" fill="#242321" />
          <path d="M30 22 l2 -12 7 8 M54 22 l-2 -12 -7 8" fill="#242321" />
          <circle cx="36" cy="30" r="2.4" fill="#8fd16f" /><circle cx="48" cy="30" r="2.4" fill="#8fd16f" />
        </Easel>
      </>
    ),
  },
  b2c5: {
    alt: 'شهر بزرگ است: مینا در میان ساختمان‌های بلند و خیابان شلوغ ایستاده و عکس نینو را نشان می‌دهد؛ زن و شوهری کنارش هستند و اتوبوس در ایستگاه توقف کرده است.',
    draw: () => (
      <>
        <Sky time="dusk" />
        <Flock x={560} y={70} count={4} s={.8} />
        {[[-10, 150, 290, '#8d8aa8'], [130, 120, 340, '#9f98b0'], [240, 150, 260, '#8b92a8'], [380, 120, 360, '#a79aa8'], [490, 150, 300, '#8f8ca4'], [630, 180, 330, '#9d98ae']].map(([bx, bw, bh, color], index) => (
          <Building key={index} x={bx as number} y={300} w={bw as number} h={bh as number} color={color as string} rows={Math.round((bh as number) / 50)} cols={3} lit={3} windowColor="#b8c2d6" />
        ))}
        <Road y={316} h={104} color="#7f8187" />
        <StreetLamp x={120} y={320} h={220} on />
        <StreetLamp x={700} y={320} h={220} on />
        <Bus x={560} y={374} color="#d9a441" s={.8} />
        <Car x={150} y={410} color="#5f7891" s={.7} flip />
        <Figure build="adult" skin="#e0ae88" hair="#2f2622" hairStyle="short" top="#6f9a6b" bottom="#3e4450" x={300} y={398} arms={['down', 'hip']} expression="smile" s={.95} />
        <Figure build="adult" skin="#e8b894" hair="#8a5a3a" hairStyle="scarf" top="#8d5a7a" bottom="#56617e" outfit="skirt" legs="#e8b894" x={352} y={400} arms={['hold', 'down']} holding={{ item: 'bag', hand: 'left' }} expression="smile" s={.95} accent="#e2b440" />
        <Cast who={MINA} x={430} y={410} arms={['down', 'hold']} holding={{ item: 'photo' }} expression="worried" />
      </>
    ),
  },
}

