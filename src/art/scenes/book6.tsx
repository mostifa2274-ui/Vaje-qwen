import { Rain } from '../kit'
import { CRIMSON, PAPER, outline } from '../tokens'
import { Cast, Chicken, Figure, Nino, Student } from '../characters'
import { DAD, MINA } from '../cast'
import { Clock, MissingNote, Printer, Room, Screen, Table, WallMap, Window } from '../interior'
import { Blackboard, Building, Flask, Globe, SchoolDesk } from '../outdoor'
import type { Scene } from './types'

const TEACHER = { build: 'adult' as const, skin: '#e8b894', hair: '#5b3a2a', hairStyle: 'bob' as const, glasses: true, top: '#6f9ab0', bottom: '#56617e', outfit: 'skirt' as const, legs: '#e8b894', collar: '#fbfaf5' }
const SCIENTIST = { build: 'adult' as const, skin: '#d9a07a', hair: '#2c1d17', hairStyle: 'long' as const, glasses: true, top: '#fbfaf5', bottom: '#3e4450', outfit: 'coat' as const }

export const BOOK6: Record<string, Scene> = {
  b6c1: {
    alt: 'در کلاس علوم، معلم دربارهٔ پرنده‌ها و حیوانات مزرعه درس می‌دهد و روی تخته جوجه‌ای کشیده؛ مینا ایستاده و با دقت از کتاب قرمزش به انگلیسی می‌خواند و هم‌کلاسی‌ها گوش می‌دهند.',
    draw: () => (
      <>
        <Room wall="#e3e6d9" pattern="#cfd5c2" floorY={330} floor="#c9a57c" />
        <Blackboard x={70} y={60} w={330} h={150}>
          <ellipse cx="174" cy="88" rx="28" ry="21" />
          <circle cx="198" cy="64" r="14" />
          <path d="M211 64 L228 70 L211 75Z M194 50 q6 -12 12 0 q7 -9 10 3" />
          <path d="M30 40 H110 M30 62 H96 M30 84 H104" />
          <path d="M250 36 H300 M250 56 H292 M250 76 H306 M250 96 H284" />
        </Blackboard>
        <Window x={600} y={60} w={140} h={130} view="day" curtain={null} />
        <Clock x={500} y={90} hour={9} minute={10} />
        <Globe x={520} y={250} s={1.1} />
        <rect x={470} y={250} width="100" height="12" rx="3" fill="#a87a50" {...outline(2)} />
        <Figure {...TEACHER} x={440} y={392} flip arms={['down', 'point']} expression="smile" />
        <Student x={130} y={380} top="#e2b440" style="curly" skin="#d9a07a" />
        <SchoolDesk x={130} y={404} />
        <Student x={270} y={380} top="#c9766f" style="bob" />
        <SchoolDesk x={270} y={404} />
        <Cast who={MINA} x={620} y={408} arms={['hold', 'hold']} holding={{ item: 'book' }} expression="talk" />
        <SchoolDesk x={700} y={410} />
      </>
    ),
  },
  b6c2: {
    alt: 'نقشهٔ معلم: معلم و مینا کنار نقشهٔ دیواریِ خیابان‌های اطراف مدرسه ایستاده‌اند که خیابان‌های گشته‌شده روی آن علامت خورده؛ دو عکس نینو را مقایسه می‌کنند تا واضح‌ترین را انتخاب کنند.',
    draw: () => (
      <>
        <Room wall="#e6e3d4" pattern="#d4cfb9" floorY={330} floor="#c9a57c" />
        <WallMap x={80} y={56} w={300} h={196} pins={11} />
        <Window x={600} y={66} w={140} h={130} view="day" curtain="#c9766f" />
        <Figure {...TEACHER} x={440} y={392} arms={['point', 'down']} flip expression="talk" />
        <Cast who={MINA} x={330} y={404} arms={['down', 'hold']} holding={{ item: 'paper' }} expression="calm" />
        <Table x={620} y={400} w={220} h={86} />
        <g transform="translate(580 292) rotate(-8) scale(.55)"><rect x="-50" y="-78" width="100" height="112" rx="4" fill={PAPER} {...outline(2)} /><Nino x={0} y={22} s={.7} /></g>
        <g transform="translate(650 292) rotate(6) scale(.55)"><rect x="-50" y="-78" width="100" height="112" rx="4" fill={PAPER} {...outline(2)} /><Nino x={0} y={22} s={.7} flip /></g>
        <path d="M636 238 l8 9 l16 -20" fill="none" stroke={CRIMSON} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  b6c3: {
    alt: 'محل کار پدر: دفتری مدرن با دیوارهای شیشه‌ای و صفحه‌هایی که نقشهٔ شهر را نشان می‌دهند؛ پدر آگهی نینو را چاپ می‌کند و مینا آن را کنار در اصلی دفتر می‌چسباند.',
    draw: () => (
      <>
        <Room wall="#eef1ef" floorY={330} floor="#b9b5ac" />
        <rect x={40} y={40} width={720} height={250} fill="#cfe3ea" opacity=".45" />
        {[40, 220, 400, 580, 760].map(gx => <path key={gx} d={`M${gx} 40 V290`} stroke="#8fa5b0" strokeWidth="6" />)}
        <path d="M40 40 H760 M40 290 H760" stroke="#8fa5b0" strokeWidth="6" />
        <Building x={70} y={290} w={70} h={180} color="#c9d6dc" rows={6} cols={2} />
        <Building x={150} y={290} w={60} h={130} color="#d7dde0" rows={4} cols={2} />
        <Screen x={250} y={90} w={130} h={84} stand={false}>
          <rect width="130" height="84" fill="#e2ebe0" />
          <path d="M0 40 C40 30 80 56 130 44" fill="none" stroke="#8fb8c8" strokeWidth="8" />
          <path d="M30 0 V84 M90 0 V84 M0 20 H130 M0 66 H130" stroke="#fff" strokeWidth="4" />
          <circle cx="62" cy="52" r="6" fill={CRIMSON} />
        </Screen>
        <Screen x={430} y={90} w={130} h={84} stand={false}>
          <rect width="130" height="84" fill="#eef2f4" />
          <path d="M14 70 V50 M34 70 V36 M54 70 V44 M74 70 V24 M94 70 V32 M114 70 V16" stroke="#6f9ab0" strokeWidth="10" />
        </Screen>
        <MissingNote x={666} y={170} s={.8} rotate={3} />
        <Table x={330} y={400} w={260} h={96} top="#dfe3e6" legs="#8d949c" />
        <Printer x={290} y={304} />
        <Cast who={DAD} x={420} y={400} flip arms={['down', 'hold']} holding={{ item: 'paper' }} expression="smile" />
        <Cast who={MINA} x={620} y={408} arms={['down', 'up']} expression="happy" />
        <Figure build="adult" skin="#e8b894" hair="#6a4a3a" hairStyle="bun" top="#8d5a7a" bottom="#3e4450" x={130} y={400} arms={['hold', 'down']} holding={{ item: 'phone', hand: 'left' }} expression="talk" s={.9} />
      </>
    ),
  },
  b6c4: {
    alt: 'در آزمایشگاه دانشگاه، شبِ بارانی: دانشمند جوجهٔ زردِ کوچک و جوانی را نشان می‌دهد و مینا حلقهٔ آبی دور پایش را نگاه می‌کند؛ نشانه‌ها فرق دارند و این جوجه نینو نیست.',
    draw: () => (
      <>
        <Room wall="#dfe6e6" pattern="#c9d4d4" floorY={330} floor="#b9b5ac" />
        <Window x={80} y={60} w={160} h={140} view="night" curtain={null} tree={false}>
          <Rain width={160} height={140} count={30} />
        </Window>
        {[280, 330, 380].map((fx, index) => <Flask key={fx} x={fx} y={178} color={['#7fbfd0', '#e98f84', '#a9c58c'][index]} s={.8} />)}
        <rect x={260} y={178} width="150" height="10" rx="3" fill="#a87a50" {...outline(2)} />
        <Table x={420} y={400} w={320} h={100} top="#e9ecee" legs="#8d949c" />
        <g><Chicken x={430} y={296} s={.62} feathers="#e8c45c" wing="#cca341" /><path d="M422 302 H438" stroke="#5f84b0" strokeWidth="3.5" strokeLinecap="round" /></g>
        <Flask x={540} y={296} color="#7fbfd0" s={.9} />
        <Figure {...SCIENTIST} x={610} y={396} flip arms={['down', 'point']} expression="smile" />
        <Cast who={MINA} x={300} y={408} arms={['down', 'reach']} holding={{ item: 'umbrella', hand: 'left' }} accent="#5f7891" expression="calm" />
        <g transform="translate(700 90)"><rect x="-40" y="-26" width="80" height="52" rx="3" fill={PAPER} {...outline(1.8)} /><path d="M-30 -12 H30 M-30 0 H20 M-30 12 H26" stroke="#8a8378" strokeWidth="2" /><circle cx="28" cy="-14" r="6" fill={CRIMSON} /></g>
      </>
    ),
  },
}
