import { Cloud, Glow, Ground, Sky, Sun, ThoughtBubble } from '../kit'
import { CRIMSON, INK, PAPER, GOLD, outline } from '../tokens'
import { Cast, Cat, Figure, Nino } from '../characters'
import { BROTHER, DAD, MINA, MOM } from '../cast'
import { Coin, Glass, Plate, Room, Shelf, Table, Window } from '../interior'
import { Building, Crate, Oven, Shop, Stall } from '../outdoor'
import type { Scene } from './types'

const BAKER = { build: 'adult' as const, skin: '#e0ae88', hair: '#3a2a22', hairStyle: 'short' as const, beard: true, top: '#f3efe6', bottom: '#56617e', outfit: 'pants' as const, apron: '#e9d6b4', hat: '#fbfaf5' }
const WAITER = { build: 'adult' as const, skin: '#d9a07a', hair: '#2c1d17', hairStyle: 'short' as const, top: '#fbfaf5', bottom: '#2f3440', outfit: 'pants' as const, apron: '#3e4450' }

export const BOOK4: Record<string, Scene> = {
  b4c1: {
    alt: 'در سوپرمارکتِ بازار، مادر با سبد خرید سیب و پرتقال برمی‌دارد و مینا زیر قفسهٔ میوه‌ها را نگاه می‌کند تا شاید نینو آنجا پنهان شده باشد.',
    draw: () => (
      <>
        <Room wall="#e4ece4" pattern="#cddbd0" floorY={330} floor="#d6d0c2" />
        <rect x={0} y={40} width={800} height={26} fill={CRIMSON} opacity=".85" />
        {Array.from({ length: 8 }, (_, index) => <rect key={index} x={index * 100 + 10} y={46} width="60" height="14" rx="3" fill={PAPER} opacity=".7" />)}
        <Shelf x={560} y={150} w={200} books={['#e9d6a0', '#cfe0e6', '#f3c2b8', '#e9d6a0', '#cfe0e6', '#f3c2b8', '#e9d6a0']} />
        <Shelf x={560} y={222} w={200} books={['#8fb8c8', '#f6e59a', '#c9e0c0', '#8fb8c8', '#f6e59a', '#c9e0c0', '#8fb8c8']} />
        <g>
          <rect x={60} y={250} width={440} height={80} fill="#b98a5e" {...outline(2.2)} />
          <Crate x={70} y={250} w={130} goods="apples" />
          <Crate x={210} y={250} w={130} goods="bananas" />
          <Crate x={350} y={250} w={140} goods="oranges" />
          <Crate x={120} y={192} w={120} goods="carrots" />
          <Crate x={280} y={192} w={140} goods="greens" />
          <rect x={60} y={330} width={440} height="10" fill="#8a5a3b" />
        </g>
        <Cast who={MOM} x={600} y={396} flip arms={['hold', 'down']} holding={{ item: 'basket', hand: 'right' }} expression="calm" />
        <Cast who={MINA} x={440} y={404} arms={['reach', 'down']} pose="kneel" expression="worried" />
        <Figure build="adult" skin="#efc6a0" hair="#c9c3bb" hairStyle="bob" glasses top="#8fa5b0" bottom="#6b4a5f" outfit="skirt" legs="#efc6a0" x={720} y={392} arms={['hold', 'down']} holding={{ item: 'bag', hand: 'left' }} expression="smile" s={.9} accent="#c9766f" />
      </>
    ),
  },
  b4c2: {
    alt: 'در نانوایی گرم، نانوا نان داغ را از تنور بیرون آورده؛ روی پیشخوان نان، پنیر و کره است و از دیگ سوپ بخار بلند می‌شود. مینا تکه‌ای نان داغ در دست دارد.',
    draw: () => (
      <>
        <Room wall="#efd9bd" pattern="#e2c49c" floorY={332} floor="#c9a57c" />
        <Oven x={70} y={332} w={220} h={220} />
        <Shelf x={340} y={112} w={200} books={['#d49a55', '#c9894a', '#d49a55', '#e0ad6a', '#c9894a', '#d49a55']} />
        <Shelf x={340} y={176} w={200} books={['#e0ad6a', '#d49a55', '#c9894a', '#d49a55', '#e0ad6a', '#c9894a']} />
        <Figure {...BAKER} x={390} y={330} arms={['hold', 'up']} holding={{ item: 'bread', hand: 'right' }} expression="happy" />
        <rect x={300} y={262} width={420} height={80} fill="#b07a4f" {...outline(2.2)} />
        <rect x={292} y={252} width={436} height={14} rx="3" fill="#8a5a3b" {...outline(2)} />
        <Plate x={600} y={250} food="none" />
        <path d="M586 246 L614 246 L610 232 L590 236Z" fill="#fbf2c8" {...outline(1.6)} />
        <path d="M560 250 L590 248 L580 232Z" fill="#f2d36e" {...outline(1.6)} />
        <g transform="translate(680 250)">
          <path d="M-26 0 V-30 H26 V0Z" fill="#6f7a7c" {...outline(2)} />
          <ellipse cx="0" cy="-30" rx="26" ry="6" fill="#d7863f" {...outline(1.6)} />
          <path d="M-10 -40 q-6 -14 0 -26 q6 -12 0 -24 M8 -40 q-6 -14 0 -26" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
        </g>
        <path d="M470 246 C466 230 506 226 504 246Z" fill="#d49a55" {...outline(1.6)} />
        <Cast who={MOM} x={560} y={404} flip arms={['down', 'hip']} expression="smile" />
        <Cast who={MINA} x={470} y={410} arms={['down', 'mouth']} holding={{ item: 'bread' }} expression="happy" />
      </>
    ),
  },
  b4c3: {
    alt: 'در کافه، مینا کنار پنجره آب‌پرتقال سرد می‌نوشد، مادر چای و پدر قهوه دارد و برادرش کیک شکلاتی می‌خورد؛ بیرون، نزدیک در بازار، گربه‌ای قهوه‌ای ظاهر شده و مینا از جا بلند شده است.',
    draw: () => (
      <>
        <Room wall="#e9d8c4" pattern="#dcc2a8" floorY={336} floor="#a87a50" />
        <Window x={300} y={56} w={430} h={184} view="day" curtain={null} tree={false}>
          <Stall x={20} y={184} w={180} awning={['#6f9a6b', PAPER]} goods={['apples', 'bananas']} />
          <Stall x={230} y={184} w={180} awning={[CRIMSON, PAPER]} goods={['oranges', 'greens']} />
          <Cat x={214} y={182} s={.5} coat="#9a6440" eyes="#e3c74a" pose="walk" stripes="#7a4a2e" />
        </Window>
        <Cast who={MOM} x={120} y={372} pose="sit" arms={['hold', 'down']} holding={{ item: 'cup' }} expression="smile" s={.95} shadow={false} />
        <Cast who={DAD} x={220} y={372} pose="sit" arms={['hold', 'hold']} holding={{ item: 'map' }} expression="calm" s={.95} shadow={false} />
        <Table x={250} y={400} w={320} h={86} top="#8a5a3b" legs="#6b4a33" />
        <Glass x={320} y={306} juice="#f2a33a" s={.9} />
        <rect x={312} y={276} width="7" height="7" fill="#e6f3f6" {...outline(1)} />
        <g transform="translate(160 306)"><path d="M-10 -14 H10 L8 0 H-8Z" fill="#fbfaf5" {...outline(1.6)} /><path d="M10 -10 C15 -10 15 -3 9 -3" fill="none" {...outline(1.4)} /></g>
        <g transform="translate(236 306)"><path d="M-10 -14 H10 L8 0 H-8Z" fill="#6b4a33" {...outline(1.6)} /><path d="M-4 -20 q-3 -6 0 -12 M3 -20 q-3 -6 0 -12" fill="none" stroke="#fff" strokeWidth="2" opacity=".7" /></g>
        <Plate x={380} y={310} food="cake" />
        <Cast who={BROTHER} x={430} y={398} pose="sit" arms={['down', 'hold']} expression="happy" s={.9} />
        <Cast who={MINA} x={560} y={404} flip arms={['down', 'point']} expression="surprised" />
      </>
    ),
  },
  b4c4: {
    alt: 'در کافهٔ کنار بازار، مادر صورت‌حساب را بررسی می‌کند و سکه‌ها را کنار آن می‌گذارد؛ پیش‌خدمت نان رایگانی برای مینا آورده و یک سکهٔ پوند کنار کفش مینا غلت خورده است.',
    draw: () => (
      <>
        <Room wall="#dfe3d6" pattern="#c9d1bf" floorY={336} floor="#b9926a" />
        <Window x={560} y={66} w={180} h={150} view="day" curtain="#c9766f">
          <Building x={20} y={150} w={60} h={110} color="#d7c4ae" rows={4} cols={2} />
          <Building x={96} y={150} w={70} h={90} color="#c7cfc6" rows={3} cols={2} />
        </Window>
        <g transform="translate(120 70)">
          <rect x="0" y="0" width="150" height="120" rx="4" fill="#3f4a44" {...outline(2)} />
          <path d="M16 24 H110 M16 44 H96 M16 64 H104 M16 84 H90" stroke="#f3f1e8" strokeWidth="3" strokeLinecap="round" />
          <circle cx="128" cy="24" r="5" fill={GOLD} /><circle cx="128" cy="64" r="5" fill={GOLD} />
        </g>
        <Cast who={MOM} x={200} y={374} pose="sit" arms={['hold', 'hold']} holding={{ item: 'paper' }} expression="calm" s={.95} shadow={false} />
        <Table x={330} y={402} w={360} h={86} cloth="#f6ecd8" />
        <g transform="translate(282 314) rotate(-6)"><rect x="-22" y="-8" width="44" height="14" rx="2" fill="#fbfaf5" {...outline(1.4)} /><path d="M-16 -2 H12" stroke="#8a8378" strokeWidth="1.4" /></g>
        <Coin x={320} y={306} /><Coin x={338} y={308} r={8} color="#cfc8bb" /><Coin x={356} y={305} />
        <g transform="translate(412 306)"><rect x="-10" y="-40" width="20" height="40" rx="5" fill="#cfe7ef" fillOpacity=".7" {...outline(1.6)} /><rect x="-6" y="-48" width="12" height="9" rx="2" fill="#5f7891" {...outline(1.4)} /></g>
        <g transform="translate(470 304)"><rect x="-20" y="-24" width="40" height="24" rx="2" fill="#f3c2b8" {...outline(1.6)} /><path d="M-20 -14 H20 M0 -24 V0" stroke={CRIMSON} strokeWidth="3" /></g>
        <Figure {...WAITER} x={560} y={396} flip arms={['down', 'hold']} holding={{ item: 'bread', hand: 'right' }} expression="happy" />
        <Cast who={MINA} x={440} y={410} arms={['down', 'hold']} expression="surprised" />
        <Coin x={386} y={404} r={8} />
        <path d="M360 406 H372 M354 398 H368" stroke={INK} strokeWidth="1.8" strokeLinecap="round" opacity=".4" />
      </>
    ),
  },
  b4c5: {
    alt: 'صبح زود کنار نانوایی، گربه‌ای سیاه درست شبیه نینو ایستاده، اما چشم‌هایش زرد است نه سبز و لکهٔ سفید کنار گوشش را ندارد؛ مینا ایستاده و نینوی واقعی را به یاد می‌آورد.',
    draw: () => (
      <>
        <Sky time="morning" />
        <Sun x={120} y={80} r={26} />
        <Cloud x={420} y={70} s={.8} />
        <Building x={560} y={300} w={240} h={230} color="#d7c4ae" rows={4} cols={4} />
        <Ground y={300} fill="#d8cdb6" />
        <Shop x={40} y={310} w={260} h={200} wall="#efd9bd" awning={['#c98d6c', PAPER]} display={<g><path d="M20 70 C18 50 60 48 58 70Z" fill="#d49a55" /><path d="M70 70 C68 50 110 48 108 70Z" fill="#c9894a" /></g>} />
        <Glow x={170} y={250} r={80} kind="lamp" />
        <Figure {...BAKER} x={252} y={318} arms={['hip', 'down']} expression="calm" s={.85} shadow={false} />
        <rect y={310} width={800} height={110} fill="#cdbfa6" />
        <Cat x={360} y={384} s={.9} coat="#242321" shade="#141312" eyes="#f0c63a" />
        <Cast who={MINA} x={560} y={404} flip arms={['reach', 'down']} expression="sad" />
        <ThoughtBubble x={660} y={140} r={60}>
          <g transform="translate(660 186) scale(.62)"><Nino x={0} y={0} /></g>
        </ThoughtBubble>
      </>
    ),
  },
}
