import { Cloud, Flower, Ground, Heart, Sky, SpeechBubble, Sun } from '../kit'
import { CRIMSON, INK, PAPER, outline } from '../tokens'
import { Bird, Cast, Figure } from '../characters'
import { BROTHER, DAD, MINA, MOM } from '../cast'
import { Frame, Lamp, MissingNote, Room, Screen, Sofa, Table, Telephone, Window } from '../interior'
import { Bicycle, BrickWall, Building } from '../outdoor'
import type { Scene } from './types'

export const BOOK5: Record<string, Scene> = {
  b5c1: {
    alt: 'حرف زدن: شب، خانواده روی مبل نشسته و دربارهٔ جاهای تازهٔ جست‌وجو گفت‌وگو می‌کند؛ نقشه روی میز است و پل قدیمی با دایرهٔ قرمز علامت خورده، و شاخه‌ای به شیشهٔ پنجره می‌خورد.',
    draw: () => (
      <>
        <Room wall="#e6dcc9" pattern="#d6c6a8" floorY={330} />
        <Window x={590} y={60} w={150} h={140} view="night" curtain="#8d5a7a" tree={false}>
          <path d="M150 20 C110 40 80 60 30 110" fill="none" stroke="#3a3230" strokeWidth="6" strokeLinecap="round" />
          {[[60, 86], [96, 60], [124, 40]].map(([lx, ly], index) => <path key={index} d={`M${lx} ${ly} c8 -12 24 -8 22 2 c-8 6 -18 6 -22 -2Z`} fill="#35503f" />)}
        </Window>
        <path d="M600 110 l-14 -6 M602 124 l-16 2" stroke={INK} strokeWidth="2.4" strokeLinecap="round" opacity=".5" />
        <Lamp x={80} y={330} h={190} on />
        <Frame x={250} y={70} w={90} h={66} />
        <Sofa x={300} y={344} w={300} color="#8fa5b0" />
        <Figure {...MOM} x={230} y={320} pose="sit" arms={['hold', 'point']} expression="talk" shadow={false} />
        <Figure {...DAD} x={370} y={320} pose="sit" arms={['down', 'hold']} expression="smile" shadow={false} />
        <SpeechBubble x={186} y={96} w={74} h={42}>
          <path d="M18 22 C26 12 46 12 56 22" fill="none" stroke={CRIMSON} strokeWidth="3" />
          <path d="M22 22 V28 M52 22 V28" stroke={INK} strokeWidth="2" />
        </SpeechBubble>
        <Table x={490} y={396} w={170} h={48} />
        <g transform="translate(490 336)">
          <path d="M-60 -6 L-20 -12 L20 -6 L60 -12 L56 10 L20 14 L-20 8 L-56 14Z" fill="#efe1bf" {...outline(1.8)} />
          <path d="M-30 4 C-10 -4 10 4 30 -2" fill="none" stroke="#8fb8c8" strokeWidth="5" />
          <circle cx="4" cy="0" r="10" fill="none" stroke={CRIMSON} strokeWidth="2.4" />
        </g>
        <Cast who={BROTHER} x={640} y={402} flip arms={['down', 'hip']} expression="calm" s={.95} />
        <Cast who={MINA} x={560} y={408} arms={['hold', 'down']} holding={{ item: 'book', hand: 'left' }} expression="talk" />
      </>
    ),
  },
  b5c2: {
    alt: 'یادداشت: مینا پشت میز آشپزخانه با خودکار قرمز یادداشت «نینو گم شده است» را می‌نویسد و عکس نینو را رویش می‌کشد؛ مادر کنارش نگاه می‌کند.',
    draw: () => (
      <>
        <Room wall="warm" pattern="#e5c9a3" floorY={330} />
        <Window x={560} y={60} w={170} h={140} view="day" curtain="#e4b36a" />
        <Frame x={90} y={66} w={86} h={64} />
        <Cast who={MOM} x={170} y={372} arms={['down', 'point']} expression="smile" />
        <Figure {...MINA} x={470} y={350} pose="sit" arms={['hold', 'reach']} flip holding={{ item: 'pen' }} expression="calm" shadow={false} />
        <Table x={400} y={404} w={420} h={98} top="#b07a4f" />
        <MissingNote x={360} y={262} s={.96} rotate={-4} />
        <g transform="translate(290 294) rotate(-12)"><rect x="-3" y="-30" width="6" height="40" rx="2" fill="#e2b440" {...outline(1.4)} /><path d="M-3 -30 L0 -38 L3 -30" fill="#efc6a0" {...outline(1.2)} /></g>
        <g transform="translate(530 300) rotate(4)"><rect x="-30" y="-24" width="60" height="44" fill={PAPER} {...outline(1.6)} /><path d="M-22 -12 H22 M-22 -2 H18 M-22 8 H14" stroke="#8a8378" strokeWidth="2" /></g>
      </>
    ),
  },
  b5c3: {
    alt: 'تلفن: تلفن سیاه قدیمیِ راهرو زنگ می‌زند و مینا گوشی را برداشته است؛ مادر روی کامپیوتر عکس نینو را در سایت گربه‌های گمشدهٔ محله می‌گذارد.',
    draw: () => (
      <>
        <Room wall="#e2e4d7" pattern="#cdd1bd" floorY={330} />
        <Window x={80} y={60} w={150} h={130} view="day" curtain="#8fa5b0" />
        <Table x={200} y={396} w={170} h={110} top="#8a5a3b" />
        <Telephone x={176} y={284} ringing handset={false} />
        <Cast who={MINA} x={290} y={404} flip arms={['down', 'mouth']} holding={{ item: 'phone' }} expression="surprised" />
        <path d="M168 258 C200 230 250 250 276 268" fill="none" stroke="#2c2b29" strokeWidth="2.2" />
        <Table x={560} y={396} w={260} h={96} top="#b07a4f" />
        <Screen x={490} y={176} w={150} h={96}>
          <rect width="150" height="16" fill="#6f9ab0" />
          <rect x="10" y="24" width="56" height="62" fill="#fbfaf5" stroke={INK} strokeWidth="1.4" />
          <circle cx="38" cy="50" r="12" fill="#242321" />
          <path d="M28 44 l2 -10 6 6 M48 44 l-2 -10 -6 6" fill="#242321" />
          <circle cx="33" cy="50" r="2.2" fill="#8fd16f" /><circle cx="43" cy="50" r="2.2" fill="#8fd16f" />
          <path d="M26 76 q12 -10 24 0" fill="#242321" />
          <path d="M76 30 H138 M76 42 H130 M76 54 H134 M76 66 H120" stroke="#8a8378" strokeWidth="3" strokeLinecap="round" />
        </Screen>
        <Figure {...MOM} x={640} y={372} pose="sit" flip arms={['down', 'hold']} expression="calm" shadow={false} />
        <rect x={500} y={286} width="110" height="10" rx="3" fill="#dfe4e6" {...outline(1.6)} />
      </>
    ),
  },
  b5c4: {
    alt: 'ممنون: کنار دیواری که یادداشت‌های مینا رویش چسبیده، همسایه‌ها یادداشت را می‌خوانند و مینا از همه تشکر می‌کند؛ دوچرخه‌سواری برای دادن خبر تازه ایستاده و پرنده‌ای لیوان کاغذی را از لب دیوار انداخته است.',
    draw: () => (
      <>
        <Sky time="day" />
        <Sun x={690} y={70} r={28} />
        <Cloud x={200} y={60} s={.9} />
        <Building x={560} y={250} w={250} h={200} color="#d7c4ae" rows={4} cols={4} />
        <BrickWall x={20} y={316} w={520} h={170} color="#d7a483" />
        <MissingNote x={140} y={216} s={.9} rotate={-4} />
        <MissingNote x={300} y={206} s={.86} rotate={3} />
        <g transform="translate(470 214) rotate(-18)"><path d="M-12 -18 H12 L8 12 H-8Z" fill="#fbfaf5" {...outline(1.6)} /></g>
        <Bird x={500} y={136} s={.8} flying />
        <Ground y={316} fill="#cdbfa6" />
        {[60, 110, 170, 500, 530].map((fx, index) => <Flower key={fx} x={fx} y={324} color={index % 2 ? '#e8a23b' : '#d9546a'} s={.9} />)}
        <Figure build="adult" skin="#e8b894" hair="#8a5a3a" hairStyle="scarf" top="#6f9a6b" bottom="#56617e" outfit="skirt" legs="#e8b894" x={190} y={394} arms={['down', 'chest']} expression="smile" accent="#6f9a6b" />
        <Figure build="elder" skin="#e2b391" hair="#d6d0c7" hairStyle="bald" glasses top="#8b7a5a" bottom="#4b4a44" x={260} y={396} arms={['hip', 'down']} expression="smile" s={.95} />
        <Cast who={MINA} x={370} y={406} arms={['chest', 'chest']} expression="happy" />
        <Heart x={400} y={264} s={1.2} />
        <Bicycle x={600} y={404} color="#5f7891" />
        <Figure build="adult" skin="#d9a07a" hair="#2c1d17" hairStyle="cap" top="#e2b440" bottom="#3e4450" x={660} y={404} flip arms={['point', 'down']} expression="talk" />
      </>
    ),
  },
}
