import { Bush, Flower, Glow, Ground, Heart, Hills, Moon, Pine, Rain, Sky, Sparkle, Stars, StringLights, Tree } from '../kit'
import { CRIMSON, PAPER, outline } from '../tokens'
import { Cast, Figure, Nino } from '../characters'
import { DAD, GRANDFATHER, GRANDMOTHER, MINA, MOM } from '../cast'
import { Armchair, Blanket, Door, Fireplace, Frame, Lamp, Room, Window } from '../interior'
import { BrickWall, Car, House, Mountains, StoneHouse } from '../outdoor'
import type { Scene } from './types'

const DOCTOR = { build: 'adult' as const, skin: '#e0ae88', hair: '#6a6a6a', hairStyle: 'short' as const, glasses: true, top: '#fbfaf5', bottom: '#3e4450', outfit: 'coat' as const }
const NURSE = { build: 'adult' as const, skin: '#d9a07a', hair: '#2c1d17', hairStyle: 'bun' as const, top: '#8fc0c8', bottom: '#8fc0c8', outfit: 'dress' as const, legs: '#d9a07a' }
const UNCLE = { build: 'adult' as const, skin: '#e2b391', hair: '#3a2a22', hairStyle: 'short' as const, beard: true, top: '#a86d5a', bottom: '#3e4450', outfit: 'pants' as const }

export const BOOK8: Record<string, Scene> = {
  b8c1: {
    alt: 'کوه: خانواده از جادهٔ باریک و پیچ‌درپیچ بالا می‌رود تا به خانهٔ سنگیِ مادربزرگ نزدیک قله برسد؛ از دودکش دود بلند است، درخت بلندی کنار خانه است و گل‌های صورتی جلوی در روییده‌اند.',
    draw: () => (
      <>
        <Sky time="day" />
        <Mountains y={250} colors={['#a9b4c4', '#8f9cb0']} peaks={[[110, 170], [320, 220], [600, 190], [770, 150]]} />
        <Hills y={260} color="#8fae84" seed={23} amplitude={60} />
        <path d="M0 420 L0 300 C200 250 420 190 560 150 L800 110 V420Z" fill="#7da275" />
        <path d="M120 420 C200 380 380 380 360 330 C340 290 460 270 520 250 C560 236 580 228 604 214" fill="none" stroke="#d8cdb6" strokeWidth="26" strokeLinecap="round" />
        <path d="M120 420 C200 380 380 380 360 330 C340 290 460 270 520 250 C560 236 580 228 604 214" fill="none" stroke="#c4b69a" strokeWidth="2" strokeDasharray="10 10" />
        <Pine x={260} y={300} s={.8} /><Pine x={420} y={250} s={.7} /><Pine x={700} y={180} s={.8} />
        <Tree x={730} y={214} s={1} leaf="#6f9a6b" />
        <StoneHouse x={520} y={216} w={170} h={110} lit={false} />
        {[[540, 222], [566, 224], [650, 222]].map(([fx, fy], index) => <Flower key={index} x={fx} y={fy} color="#e98fb0" s={.7} />)}
        <Figure {...GRANDMOTHER} x={590} y={222} arms={['down', 'wave']} expression="happy" s={.42} shadow={false} />
        <Figure {...GRANDFATHER} x={622} y={222} arms={['wave', 'down']} expression="happy" s={.42} shadow={false} />
        <Cast who={DAD} x={350} y={340} arms={['down', 'hold']} holding={{ item: 'suitcase' }} accent="#8a5a3b" s={.7} pose="walk" />
        <Cast who={MINA} x={300} y={372} arms={['point', 'down']} flip expression="happy" s={.75} pose="walk" hat={CRIMSON} />
        <Cast who={MOM} x={230} y={398} arms={['down', 'hold']} holding={{ item: 'bag' }} accent="#6f9ab0" s={.78} pose="walk" />
      </>
    ),
  },
  b8c2: {
    alt: 'دست‌ها و پاها: کنار آتش بخاری، مینا خسته زیر پتو روی مبل نشسته و چشم‌هایش بسته می‌شود؛ مادربزرگ قصهٔ گربه‌ای را می‌خواند که در کوه راهش را گم کرد و به خانه برگشت.',
    draw: () => (
      <>
        <Room wall="#e8d3b8" pattern="#d9bb97" floorY={332} floor="#9c6f48" />
        <Fireplace x={170} y={332} w={200} h={180} lit />
        <Frame x={500} y={70} w={90} h={66}>
          <path d="M0 54 L30 16 L50 36 L66 22 L90 54Z" fill="#8f9cb0" />
        </Frame>
        <Lamp x={740} y={332} h={180} on />
        <Armchair x={420} y={392} color="#6f8a8a" />
        <Figure {...MINA} x={420} y={362} pose="sit" arms={['chest', 'chest']} expression="sleep" shadow={false} />
        <Blanket x={420} y={346} w={150} color="#c9766f" />
        <Armchair x={620} y={392} color="#8d5a7a" />
        <Figure {...GRANDMOTHER} x={620} y={362} pose="sit" arms={['hold', 'hold']} holding={{ item: 'book', hand: 'left' }} expression="talk" shadow={false} />
      </>
    ),
  },
  b8c3: {
    alt: 'دکتر: در درمانگاه شهرِ پایین کوه، دکتر با گوشی پزشکی عموی مینا را معاینه می‌کند و پرستار کنارش است؛ مینا خیالش راحت شده و از پنجره جادهٔ کوهستانی و ماشین خانواده پیداست.',
    draw: () => (
      <>
        <Room wall="#e3eeec" pattern="#cfe0dc" floorY={332} floor="#bfc6c4" />
        <Window x={560} y={60} w={180} h={150} view="day" curtain={null} tree={false}>
          <Mountains y={150} colors={['#a9b4c4', '#8f9cb0']} peaks={[[40, 90], [150, 120]]} />
          <path d="M0 140 C60 120 100 130 180 100" fill="none" stroke="#d8cdb6" strokeWidth="10" />
          <Car x={90} y={128} s={.28} color="#5f7891" />
        </Window>
        <g transform="translate(120 90)">
          <rect x="0" y="0" width="70" height="70" rx="6" fill={PAPER} {...outline(2)} />
          <path d="M35 14 V56 M14 35 H56" stroke={CRIMSON} strokeWidth="12" />
        </g>
        <rect x={250} y={290} width={200} height={50} rx="8" fill="#9fb8c4" {...outline(2)} />
        <Figure {...UNCLE} x={330} y={330} pose="sit" arms={['down', 'down']} expression="worried" shadow={false} />
        <Figure {...DOCTOR} x={440} y={398} flip arms={['down', 'reach']} holding={{ item: 'stethoscope' }} expression="smile" />
        <Figure {...NURSE} x={560} y={400} arms={['hold', 'down']} holding={{ item: 'paper', hand: 'left' }} expression="smile" s={.95} />
        <Cast who={MINA} x={200} y={408} arms={['down', 'wave']} expression="happy" />
        <Heart x={234} y={250} s={1} fill="#e98f84" />
      </>
    ),
  },
  b8c4: {
    alt: 'حرف‌های مادربزرگ: شبِ بارانی کنار آتش، مینا از مادربزرگ می‌پرسد نینو برمی‌گردد یا نه؛ مادربزرگ آرام جواب می‌دهد و مینا دفترچه و قلمش را در دست دارد تا روزی نویسنده شود.',
    draw: () => (
      <>
        <Room wall="night" floorY={332} floor="#5a4336" />
        <Glow x={580} y={250} r={320} kind="fire" />
        <Window x={90} y={60} w={160} h={150} view="night" curtain="#5a4a66" tree={false}>
          <Rain width={160} height={150} count={30} />
        </Window>
        <Fireplace x={580} y={332} w={220} h={190} lit />
        <Figure {...GRANDMOTHER} x={400} y={398} pose="sit" arms={['chest', 'point']} expression="talk" />
        <Cast who={MINA} x={290} y={404} pose="kneel" arms={['hold', 'hold']} holding={{ item: 'book' }} expression="calm" />
      </>
    ),
  },
  b8c5: {
    alt: 'ستاره‌ها: آسمانِ صاف شب پر از ستاره است و مادربزرگ ستارهٔ کوچک و درخشانی را بالای دیوار باغ نشان می‌دهد؛ چراغ‌های جشن تابستانی در شهرِ پایین می‌درخشد و مینا روی جلد کتابش می‌نویسد «نینو، به خانه بیا».',
    draw: () => (
      <>
        <Sky time="night" />
        <Stars count={90} seed={41} bottom={300} />
        <Glow x={520} y={96} r={70} kind="moon" />
        <Sparkle x={520} y={96} r={18} fill="#fff3c4" />
        <Moon x={120} y={80} r={22} />
        <Mountains y={300} colors={['#2f3a57', '#28324c']} snow={false} peaks={[[80, 120], [300, 160], [540, 130], [760, 110]]} />
        <path d="M0 290 C200 280 600 300 800 286 V360 H0Z" fill="#1f2a40" />
        <Glow x={450} y={300} r={130} kind="lamp" />
        {Array.from({ length: 9 }, (_, index) => <rect key={index} x={250 + index * 44} y={286 - (index % 3) * 10} width="30" height={30 + (index % 3) * 10} fill="#2c3552" />)}
        {Array.from({ length: 26 }, (_, index) => <circle key={index} cx={250 + (index * 37) % 400} cy={300 + (index % 4) * 9} r={2.4} fill={['#f6d68d', '#e98f84', '#9fd0c0'][index % 3]} />)}
        <StringLights x1={240} x2={660} y={276} sag={8} />
        <Ground y={352} fill="#2a2f3a" />
        <BrickWall x={0} y={396} w={800} h={44} color="#6b5a58" />
        <Figure {...GRANDMOTHER} x={610} y={400} flip arms={['down', 'up']} expression="smile" />
        <Cast who={MINA} x={470} y={404} arms={['hold', 'hold']} holding={{ item: 'book' }} expression="happy" />
        <Pine x={740} y={380} s={.8} fill="#2c3f38" />
        <Bush x={90} y={392} fill="#35503f" dark="#26392e" />
      </>
    ),
  },
  b8c6: {
    alt: 'بازگشت: شب است و درِ خانه باز شده؛ نینو، گربهٔ سیاهِ کوچک با چشم‌های سبز و لکهٔ سفید کنار گوشش، روی پلهٔ جلوی در ایستاده و مینا زانو زده و دست‌هایش را برایش باز کرده است. پدر و مادر در نورِ در ایستاده‌اند.',
    draw: () => (
      <>
        <Sky time="night" />
        <Stars count={50} seed={51} bottom={200} />
        <Moon x={700} y={70} r={24} />
        <House x={-40} y={320} w={150} h={150} wall="#4e4b5e" roof="#3a2e38" lit windows={1} />
        <House x={560} y={320} w={260} h={170} wall="#5a5668" roof="#43323c" lit windows={2} />
        <rect x={120} y={120} width={440} height={200} fill="#6b6474" {...outline(2.4)} />
        <path d="M100 120 L340 40 L580 120Z" fill="#5a3a3c" {...outline(2.4)} />
        <Glow x={340} y={260} r={220} kind="lamp" />
        <Door x={290} y={320} w={100} h={200} open color="#6b4a33" glow="#ffe8b0" />
        <Figure {...MOM} x={322} y={318} arms={['chest', 'chest']} expression="happy" s={.8} shadow={false} />
        <Figure {...DAD} x={366} y={318} arms={['down', 'wave']} expression="happy" s={.8} shadow={false} />
        <rect x={250} y={318} width={180} height={14} rx="3" fill="#8e8698" {...outline(2)} />
        <path d="M270 332 L200 420 H480 L410 332Z" fill="#ffe3a3" opacity=".3" />
        <Ground y={390} fill="#2c3a37" />
        <path d="M0 360 H250 M430 360 H800" stroke="#2c3a37" strokeWidth="60" />
        <Nino x={300} y={390} s={.95} rim="#6b7088" />
        <Cast who={MINA} x={420} y={404} flip pose="kneel" arms={['reach', 'reach']} expression="happy" />
        <Heart x={366} y={254} s={1.2} />
        <Flower x={150} y={396} color="#e98fb0" /><Flower x={540} y={398} color="#f6d68d" />
      </>
    ),
  },
}

