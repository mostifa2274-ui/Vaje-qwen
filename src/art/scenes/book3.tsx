import { Clip, Cloud, Ground, Hills, Moon, Rain, Sky, Stars, Sun, ThoughtBubble } from '../kit'
import { CRIMSON, INK, PAPER, outline } from '../tokens'
import { Cast, Chicken, Figure, Flock, Nino, Bird } from '../characters'
import { BROTHER, DAD, MINA, MOM } from '../cast'
import { Balloon, Bowl, Cake, Calendar, Chair, Clock, Door, Frame, Glass, Lamp, Plate, Room, Table, WallMap, Window } from '../interior'
import { Board, BrickWall, Building, House, StreetLamp } from '../outdoor'
import type { Scene } from './types'

export const BOOK3: Record<string, Scene> = {
  b3c1: {
    alt: 'یک هفته جست‌وجو: شب است و باران به پنجره می‌خورد؛ مینا پشت میز در کتاب قرمزش می‌نویسد، نقشهٔ شهر روی دیوار پر از یادداشت است و روزهای هفته روی تقویم خط خورده‌اند.',
    draw: () => (
      <>
        <Room wall="#e9dcc4" pattern="#d9c6a4" floorY={330} />
        <Window x={600} y={70} w={150} h={140} view="rain" curtain="#8fa5b0" tree={false}>
          <Rain width={150} height={140} count={26} />
        </Window>
        <WallMap x={70} y={52} w={260} h={170} />
        <Calendar x={380} y={70} w={96} crossed={6} />
        <Lamp x={560} y={330} h={170} on />
        <Chair x={300} y={352} color="#9a6b47" />
        <Figure {...MINA} x={330} y={356} pose="sit" arms={['hold', 'hold']} expression="calm" shadow={false} />
        <Table x={330} y={396} w={280} h={96} />
        <g transform="translate(330 296) rotate(-4)">
          <rect x="-32" y="-8" width="64" height="18" rx="2" fill={PAPER} {...outline(1.6)} />
          <path d="M0 -8 V10" stroke="#c9bfae" strokeWidth="1.6" />
          <path d="M-26 -2 H-6 M-26 4 H-10 M6 -2 H26 M6 4 H22" stroke="#8a8378" strokeWidth="1.4" />
          <path d="M14 -24 L22 2 L18 4 L10 -22Z" fill={CRIMSON} {...outline(1.4)} />
        </g>
      </>
    ),
  },
  b3c2: {
    alt: 'مینا می‌شمارد: کنار دیوار بازار نُه پرندهٔ کوچک نشسته‌اند؛ ده پرندهٔ دیگر از روی چمن بلند می‌شوند و مینا با مداد در کتاب قرمزش آن‌ها را می‌شمارد. ساعت هشت را نشان می‌دهد.',
    draw: () => (
      <>
        <Sky time="morning" />
        <Sun x={680} y={70} r={28} />
        <Building x={520} y={250} w={170} h={200} color="#e0cdb2" rows={4} cols={3} />
        <g transform="translate(606 76)"><circle r="26" fill={PAPER} {...outline(2)} /><path d="M0 0 V-16 M0 0 L-12 8" {...outline(2.6)} /></g>
        <Flock x={140} y={70} count={5} s={1} />
        <Flock x={330} y={110} count={5} s={.8} />
        <BrickWall x={0} y={292} w={800} h={100} color="#cf9f7f" />
        <Ground y={292} fill="#b9c79a" />
        <rect y={330} width={800} height={90} fill="#d8cdb6" />
        {Array.from({ length: 9 }, (_, index) => (
          <Bird key={index} x={52 + index * 64} y={296 - (index % 2) * 4} s={.46} color={['#8d8f93', '#b78858', '#d6c7ad'][index % 3]} flip={index % 2 === 1} />
        ))}
        <Cast who={MINA} x={640} y={404} flip arms={['point', 'hold']} holding={{ item: 'book', hand: 'right' }} expression="calm" />
        <Bird x={720} y={354} s={.6} color="#8d8f93" flip />
      </>
    ),
  },
  b3c3: {
    alt: 'قبل و بعد: یک طرف تصویر صبح زود است و مینا با برادرش از خانه بیرون می‌رود؛ طرف دیگر نیمه‌شب است، چراغ‌های خیابان روشن‌اند و مینا از پنجره گوش می‌دهد.',
    draw: () => (
      <>
        <Clip name="day" path="M0 0 H470 L330 420 H0Z">
          <Sky time="morning" />
          <Sun x={90} y={120} r={30} />
          <Cloud x={260} y={70} s={.8} />
          <Hills y={260} color="#b9cda8" seed={3} far />
          <Ground y={300} fill="#a9c58c" />
          <rect y={318} width={800} height={102} fill="#d8cdb6" />
          <House x={30} y={318} w={230} h={170} wall="#e7c9b0" roof="#a9544a" />
          <Cast who={BROTHER} x={270} y={398} pose="walk" arms={['down', 'wave']} expression="smile" />
          <Cast who={MINA} x={330} y={404} pose="walk" arms={['hold', 'down']} holding={{ item: 'photo', hand: 'left' }} expression="calm" />
        </Clip>
        <Clip name="night" path="M470 0 H800 V420 H330Z">
          <Sky time="night" />
          <Stars count={40} seed={21} />
          <Moon x={700} y={80} r={24} />
          <Ground y={300} fill="#2c3a37" />
          <rect y={318} width={800} height={102} fill="#4b4d5a" />
          <House x={430} y={318} w={250} h={190} wall="#5e5b6c" roof="#4a3440" door="#3e3346" windows={2} />
          <rect x={466} y={170} width={56} height={54} fill="#f6d68d" />
          <Clip name="sill" path="M466 170 H522 V224 H466Z">
            <g transform="translate(494 272) scale(.66)"><Figure {...MINA} x={0} y={0} arms={['mouth', 'down']} expression="worried" shadow={false} /></g>
          </Clip>
          <rect x={466} y={170} width={56} height={54} fill="none" {...outline(2.2)} />
          <StreetLamp x={720} y={330} h={210} on />
          <Clock x={620} y={250} r={20} hour={12} minute={0} />
        </Clip>
        <path d="M470 0 L330 420" stroke={PAPER} strokeWidth="6" />
      </>
    ),
  },
  b3c4: {
    alt: 'جشن تولد مینا در ماه ژوئن: کیک با شمع، میوه و بادکنک روی میز است و روز سوم در تقویم دور خورده؛ مینا با شنیدن صدایی کنار در، امیدوار به در نگاه می‌کند.',
    draw: () => (
      <>
        <Room wall="#f1dcc9" pattern="#e7c1ad" floorY={326} />
        <Door x={640} y={326} w={100} h={200} open glow="#dfe9df" outside={<><path d="M0 150 Q50 130 100 150 V200 H0Z" fill="#a9c58c" /><path d="M20 60 q6 -8 14 -4 M60 90 q6 -8 14 -4" stroke="#6f9a6b" strokeWidth="3" fill="none" /></>} />
        {[[706, 170], [760, 210], [690, 240]].map(([lx, ly], index) => <path key={index} d={`M${lx} ${ly} c8 -10 20 -6 20 2 c-10 4 -16 4 -20 -2Z`} fill="#8fb08a" {...outline(1.4)} />)}
        <Calendar x={90} y={60} w={110} circled={[2]} header="#6f9a6b" />
        <Balloon x={290} y={96} color={CRIMSON} />
        <Balloon x={330} y={80} color="#e2b440" s={.9} />
        <Balloon x={366} y={104} color="#6f9ab0" s={.85} />
        <path d="M60 40 C200 90 420 90 600 40" fill="none" stroke={INK} strokeWidth="1.4" opacity=".4" />
        {Array.from({ length: 9 }, (_, index) => <path key={index} d={`M${80 + index * 60} ${54 + Math.sin(index / 2.6) * 22} l12 20 l12 -20Z`} fill={['#e2b440', CRIMSON, '#6f9ab0'][index % 3]} opacity=".85" />)}
        <Cast who={MOM} x={120} y={396} arms={['down', 'hold']} expression="smile" />
        <Cast who={DAD} x={210} y={400} arms={['hip', 'down']} expression="smile" />
        <Table x={350} y={390} w={250} h={78} cloth="#f6ecd8" />
        <Cake x={330} y={300} candles={3} />
        <Plate x={420} y={304} food="bread" />
        <circle cx={264} cy={296} r="9" fill="#c9413f" {...outline(1.4)} /><circle cx={280} cy={300} r="9" fill="#ea9a3a" {...outline(1.4)} />
        <Glass x={444} y={300} juice="#b86a3a" s={.8} />
        <Cast who={MINA} x={540} y={408} flip={false} arms={['down', 'reach']} expression="surprised" />
      </>
    ),
  },
  b3c5: {
    alt: 'هزار سرنخ: مینا و پدر جلوی تابلوی اطلاعات شهر ایستاده‌اند که پر از عکس‌ها و گزارش‌های جوجه‌های کوچک است؛ مینا همهٔ سرنخ‌ها را نگاه می‌کند، اما هیچ‌کدام نینو را واضح نشان نمی‌دهد.',
    draw: () => (
      <>
        <Room wall="#dfe1d6" pattern="#c9cdbd" floorY={330} floor="#b9ad98" />
        <Window x={600} y={60} w={150} h={130} view="day" curtain={null} tree={false}>
          <Building x={10} y={130} w={40} h={90} color="#c9b7a4" rows={4} cols={2} />
          <Building x={60} y={130} w={40} h={110} color="#b8c0c6" rows={5} cols={2} />
          <Building x={106} y={130} w={40} h={80} color="#d7c4ae" rows={3} cols={2} />
        </Window>
        <Board x={80} y={56} w={430} h={196} color="#d9bf94">
          {Array.from({ length: 11 }, (_, index) => (
            <g key={index} transform={`translate(${40 + (index % 6) * 66 + (index >= 6 ? 33 : 0)} ${56 + Math.floor(index / 6) * 92}) scale(.28)`}>
              <rect x="-54" y="-72" width="108" height="118" rx="5" fill={PAPER} {...outline(2)} />
              <Chicken x={0} y={30} s={.72} feathers={['#f3c84b', '#e6b96a', '#f1d88b'][index % 3]} wing={['#dfad32', '#c99a55', '#dfc16b'][index % 3]} flip={index % 2 === 1} />
            </g>
          ))}
        </Board>
        <rect x={60} y={300} width={470} height={30} fill="#a87a50" {...outline(2.2)} />
        <Cast who={DAD} x={200} y={404} arms={['down', 'point']} flip={false} expression="calm" />
        <Cast who={MINA} x={330} y={408} arms={['down', 'hold']} holding={{ item: 'book' }} expression="worried" />
        <ThoughtBubble x={420} y={260} r={34}>
          <g transform="translate(420 290) scale(.42)"><Nino x={0} y={0} /></g>
        </ThoughtBubble>
        <Figure build="adult" skin="#d9a07a" hair="#2c1d17" hairStyle="scarf" top="#6f9ab0" bottom="#3e4450" outfit="skirt" legs="#d9a07a" x={640} y={400} arms={['hold', 'down']} holding={{ item: 'paper', hand: 'left' }} expression="smile" accent="#6f9ab0" />
      </>
    ),
  },
  b3c6: {
    alt: 'آخر هفته: خانواده دور میز آشپزخانه نقشهٔ شهر را پهن کرده و مسیر فردا را با خودکار قرمز علامت می‌زند؛ کنار ظرف نینو یک لیوان آب گذاشته‌اند تا اگر برگشت، آماده باشد.',
    draw: () => (
      <>
        <Room wall="warm" pattern="#e2c49c" floorY={330} />
        <Window x={590} y={70} w={150} h={130} view="dusk" curtain="#c9766f" />
        <Frame x={80} y={70} w={80} h={60} />
        <Lamp x={520} y={330} h={200} on />
        <Cast who={MOM} x={160} y={390} arms={['down', 'point']} expression="talk" s={.95} />
        <Cast who={BROTHER} x={250} y={386} arms={['down', 'hold']} holding={{ item: 'pen' }} expression="smile" s={.95} />
        <Cast who={DAD} x={470} y={392} flip arms={['down', 'point']} expression="calm" s={.95} />
        <Table x={330} y={394} w={330} h={84} top="#b07a4f" />
        <g transform="translate(330 298)">
          <path d="M-120 -8 L-40 -16 L40 -8 L120 -16 L112 12 L40 18 L-40 10 L-112 18Z" fill="#efe1bf" {...outline(2)} />
          <path d="M-40 -16 L-40 10 M40 -8 L40 18" stroke="#d6c39a" strokeWidth="2" />
          <ellipse cx="-70" cy="0" rx="18" ry="8" fill="none" stroke={CRIMSON} strokeWidth="2.6" />
          <path d="M-30 4 C0 -10 30 10 70 -4" fill="none" stroke={CRIMSON} strokeWidth="2.2" strokeDasharray="5 4" />
          <path d="M70 -4 l-8 -4 M70 -4 l-6 6" stroke={CRIMSON} strokeWidth="2.2" strokeLinecap="round" />
        </g>
        <Cast who={MINA} x={380} y={404} arms={['hold', 'down']} holding={{ item: 'book', hand: 'left' }} expression="calm" />
        <Bowl x={640} y={384} food />
        <Glass x={680} y={386} juice="#d8eef4" s={.9} />
      </>
    ),
  },
}

