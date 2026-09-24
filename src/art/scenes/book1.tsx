import { Bush, Flower, Grass, Ground, Hills, Moon, Puddle, Sky, Stars, Tree } from '../kit'
import { CRIMSON, INK, outline } from '../tokens'
import { Bird, Cast, Nino, Figure } from '../characters'
import { BROTHER, DAD, MINA, MOM } from '../cast'
import { Bed, Bowl, Chair, Clock, Door, Frame, Lamp, LightBeam, Room, Rug, Shelf, Table, Window } from '../interior'
import { BrickWall, Fence, House, Pot, StreetLamp } from '../outdoor'
import type { Scene } from './types'

export const BOOK1: Record<string, Scene> = {
  b1c1: {
    alt: 'صبح در اتاق مینا: پرندهٔ قرمز روی لبهٔ پنجرهٔ باز نشسته و نینو، جوجهٔ زرد کوچک، از کنار کتاب قرمز به سمت آن می‌پرد؛ مینا دستش را دراز کرده و صدایش می‌زند.',
    draw: () => (
      <>
        <Room wall="warm" pattern="#e2b9a0" floorY={318} />
        <Window x={96} y={66} w={176} h={150} view="morning" open curtain="#d98e7a" />
        <Bird x={214} y={222} s={1.05} />
        <LightBeam from={[96, 272, 232]} to={[180, 520, 420]} />
        <Frame x={330} y={70} w={74} h={58} />
        <Shelf x={560} y={126} w={160} />
        <Rug x={330} y={372} w={300} color="#c98e6e" />
        <Bed x={452} y={352} w={250} blanket="#e0a894" />
        <g transform="translate(560 262) rotate(-8)">
          <rect x="-24" y="-16" width="48" height="32" rx="3" fill={CRIMSON} {...outline(2)} />
          <path d="M-18 -16 V16" stroke="#8d1a36" strokeWidth="2.4" />
        </g>
        <Nino x={352} y={286} s={.9} pose="leap" />
        <Cast who={MINA} x={712} y={396} flip arms={['down', 'reach']} expression="surprised" />
      </>
    ),
  },
  b1c2: {
    alt: 'خانواده برای پیدا کردن نینو اتاق به اتاق می‌گردد: پدر در را باز می‌کند، مادر با فنجان نگران است، برادر با چراغ‌قوه زیر صندلی را نگاه می‌کند و مینا اسباب‌بازی نینو را در بغل گرفته است.',
    draw: () => (
      <>
        <Room wall="#e7e3cf" pattern="#c9cfb2" floorY={322} />
        <Door x={70} y={322} w={92} h={196} open glow="#e9e3d4" />
        <Window x={560} y={58} w={150} h={116} view="day" curtain="#8fa5b0">
          <Bird x={112} y={96} s={.8} />
        </Window>
        <Frame x={372} y={72} w={80} h={60} color="#8a6a50" />
        <Lamp x={482} y={322} h={150} on={false} />
        <Rug x={420} y={378} w={360} color="#8fa5b0" border="#f1e6cf" />
        <Cast who={DAD} x={214} y={384} flip arms={['down', 'reach']} expression="worried" />
        <Cast who={MOM} x={324} y={392} arms={['hold', 'hip']} holding={{ item: 'cup' }} expression="worried" />
        <Chair x={560} y={384} color="#b07a4f" />
        <Cast who={BROTHER} x={498} y={396} arms={['down', 'out']} pose="kneel" holding={{ item: 'flashlight' }} expression="worried" />
        <Cast who={MINA} x={680} y={404} arms={['chest', 'down']} holding={{ item: 'toy', hand: 'left' }} expression="sad" />
      </>
    ),
  },
  b1c3: {
    alt: 'صبحِ بی‌نینو: نور صبح از پنجره روی تخت افتاده؛ مینا بیدار شده و دستش را به جای خالیِ نینو در پایین تخت دراز می‌کند و کاسهٔ غذای نینو خالی مانده است.',
    draw: () => (
      <>
        <Room wall="warm" pattern="#e8c8a8" floorY={320} />
        <Window x={560} y={62} w={170} h={150} view="morning" curtain="#e4b36a" />
        <LightBeam from={[560, 730, 226]} to={[250, 560, 420]} opacity={.9} />
        <Clock x={420} y={96} hour={7} minute={5} />
        <Frame x={96} y={78} w={80} h={60}>
          <circle cx="34" cy="26" r="12" fill="#242321" />
          <path d="M24 18 l2 -10 6 6 M44 18 l-2 -10 -6 6" fill="#242321" />
        </Frame>
        <Bed x={120} y={360} w={330} blanket="#9fb7c9" pattern="#f5efe6" />
        <Figure {...MINA} x={232} y={350} arms={['down', 'reach']} pose="sit" expression="sad" shadow={false} />
        <path d="M188 306 C250 294 360 292 438 298 L438 336 L188 336Z" fill="#9fb7c9" {...outline(2.2)} />
        <rect x={118} y={334} width={330} height={16} rx="4" fill="#9a6b47" {...outline(2.2)} />
        <path d="M200 312 C260 300 350 304 420 310" fill="none" stroke="#f5efe6" strokeWidth="3" strokeDasharray="2 12" strokeLinecap="round" />
        <g transform="translate(384 296)" fill="none" stroke={INK} strokeWidth="2.4" strokeDasharray="7 7" opacity=".45">
          <path d="M-40 0 C-44 -26 -10 -34 18 -30 C40 -26 44 -6 40 0" />
          <path d="M-30 -24 L-26 -38 L-18 -28 M-10 -30 L-8 -42 L0 -32" />
        </g>
        <Bowl x={560} y={372} />
        <Shelf x={610} y={272} w={140} books={['#d9a441', '#b8574a', '#5f7891']} />
      </>
    ),
  },
  b1c4: {
    alt: 'حیاطِ خیس بعد از باران، در نور غروب: مینا زیر میز چوبی را نگاه می‌کند، برادرش با چراغ‌قوه کمک می‌کند و پرنده‌ای از پشت گلدان بیرون می‌پرد؛ چراغ حیاط روشن است و در باغچه بسته.',
    draw: () => (
      <>
        <Sky time="evening" />
        <Hills y={236} color="#aab69a" seed={4} far />
        <BrickWall x={0} y={292} w={800} h={96} color="#c99a7c" />
        <Tree x={120} y={300} s={1.05} leaf="#7da275" dark="#5b8458" />
        <StreetLamp x={620} y={330} h={214} on />
        <Ground y={296} fill="#8fae78" />
        <path d="M0 330 C200 316 420 340 800 322 V420 H0Z" fill="#7c9f68" />
        <Puddle x={300} y={372} w={62} />
        <Puddle x={560} y={396} w={48} />
        <Fence x={690} y={336} w={110} color="#e9dcc2" h={70} />
        <Bush x={90} y={342} s={1.1} />
        <Flower x={150} y={352} color="#d9546a" />
        <Flower x={176} y={356} color="#e8a23b" s={.9} />
        {[[86, 300], [110, 312], [138, 296], [66, 318]].map(([dx, dy], index) => <ellipse key={index} cx={dx} cy={dy} rx="2.4" ry="3.2" fill="#e8f2f6" opacity=".9" />)}
        <Table x={384} y={378} w={170} h={62} top="#a87a50" />
        <Cast who={MINA} x={318} y={392} arms={['down', 'reach']} pose="kneel" flip expression="worried" />
        <Cast who={BROTHER} x={470} y={396} flip arms={['down', 'out']} holding={{ item: 'flashlight' }} expression="calm" />
        <Pot x={640} y={396} s={1} color="#c46b4f">
          <path d="M-18 -44 C-26 -80 -6 -92 0 -60 C6 -96 30 -80 18 -44Z" fill="#6f9a6b" {...outline(1.6)} />
        </Pot>
        <Bird x={704} y={300} flying s={.9} />
        <Grass x={250} y={402} /><Grass x={590} y={410} /><Grass x={40} y={396} />
      </>
    ),
  },
  b1c5: {
    alt: 'شبِ اول: مینا در آستانهٔ درِ روشن خانه ایستاده و آرام نینو را صدا می‌زند؛ کاسهٔ کوچکی غذا بیرون گذاشته و ماه بالای حیاطِ تاریک می‌درخشد.',
    draw: () => (
      <>
        <Sky time="night" />
        <Stars count={60} seed={11} bottom={230} />
        <Moon x={640} y={82} r={30} />
        <Hills y={262} color="#2f3a4f" seed={6} far />
        <Ground y={300} fill="#2c3a37" />
        <Tree x={690} y={316} s={1.1} leaf="#35503f" dark="#26392e" trunk="#2f2826" />
        <House x={90} y={330} w={330} h={196} wall="#6b6474" roof="#5a3a3c" door="#3e3346" lit windows={2} />
        <path d="M232 330 L200 420 H332 L300 330Z" fill="#ffe3a3" opacity=".35" />
        <rect x={233} y={260} width={66} height={70} fill="#ffe3a3" />
        <Cast who={MINA} x={266} y={338} arms={['mouth', 'down']} expression="sad" s={.82} shadow={false} />
        <rect x={210} y={330} width={112} height={10} rx="3" fill="#8e8698" {...outline(2)} />
        <Bowl x={362} y={372} food color="#8fa5b0" />
        <Fence x={470} y={352} w={220} color="#6c6a7a" h={62} />
        <Bush x={560} y={372} fill="#3c5645" dark="#2c4236" />
        <path d="M0 400 C200 386 600 410 800 392 V420 H0Z" fill="#243130" />
      </>
    ),
  },
}

