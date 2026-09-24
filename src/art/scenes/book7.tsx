import { Bush, Clip, Cloud, Flower, Glow, Grass, Ground, Hills, Rain, Sand, Sky, Stars, Sun, Tree } from '../kit'
import { CRIMSON, outline } from '../tokens'
import { Bird, Cast, Figure, Flock } from '../characters'
import { BROTHER, DAD, MINA, MOM } from '../cast'
import { Bed, Frame, OpenSuitcase, Room, Window } from '../interior'
import { Barn, Bicycle, Boat, Building, Bus, Car, CompassRose, Cow, FieldRows, Hotel, House, Lighthouse, Rails, Sea, Train } from '../outdoor'
import type { Scene } from './types'

const FARMER = { build: 'adult' as const, skin: '#d9a07a', hair: '#6b5a4a', hairStyle: 'short' as const, beard: true, top: '#6f8a5a', bottom: '#5b6a86', outfit: 'pants' as const, hat: '#c9a25a' }
const FISHER = { build: 'adult' as const, skin: '#d9a07a', hair: '#3a2a22', hairStyle: 'cap' as const, beard: true, top: '#e2b440', bottom: '#3e4450', outfit: 'pants' as const }

export const BOOK7: Record<string, Scene> = {
  b7c1: {
    alt: 'آماده شدن برای سفر: چمدان باز روی زمین پر از لباس است—شلوار جین، پیراهن سفید و دامن قرمز—و مینا با کلاه قرمزش کنارش ایستاده و به عکس نینو روی دیوار نگاه می‌کند.',
    draw: () => (
      <>
        <Room wall="#ecdcc4" pattern="#dcc4a2" floorY={326} />
        <Window x={560} y={64} w={170} h={140} view="evening" curtain="#6f9ab0" />
        <Frame x={100} y={70} w={90} h={70}>
          <circle cx="39" cy="30" r="13" fill="#242321" />
          <path d="M28 22 l2 -12 6 7 M50 22 l-2 -12 -6 7" fill="#242321" />
          <circle cx="34" cy="30" r="2.2" fill="#8fd16f" /><circle cx="44" cy="30" r="2.2" fill="#8fd16f" />
          <path d="M22 58 q17 -14 34 0" fill="#242321" />
        </Frame>
        <Bed x={80} y={350} w={220} blanket="#c9766f" />
        <OpenSuitcase x={390} y={392} color="#b8574a" />
        <g transform="translate(560 392)">
          <path d="M-14 0 V-40 C-14 -50 6 -50 6 -40 V-12 H22 C30 -12 30 0 22 0Z" fill="#8a5a3b" {...outline(2)} />
          <path d="M18 0 V-40 C18 -50 38 -50 38 -40 V-12 H54 C62 -12 62 0 54 0Z" fill="#8a5a3b" {...outline(2)} />
        </g>
        <Cast who={MOM} x={250} y={400} arms={['down', 'point']} expression="smile" />
        <Cast who={MINA} x={680} y={408} flip arms={['down', 'up']} expression="happy" hat={CRIMSON} />
        <g transform="translate(730 330) rotate(-6)"><path d="M-30 -10 L-10 -16 L10 -10 L30 -16 V12 L10 18 L-10 12 L-30 18Z" fill="#efe1bf" {...outline(1.8)} /></g>
      </>
    ),
  },
  b7c2: {
    alt: 'در ایستگاه قطار: خانواده با چمدان‌ها سوار قطار می‌شوند و راننده دست تکان می‌دهد؛ اتوبوس شهری، تاکسی زرد و دوچرخهٔ قرمزِ قفل‌شده کنار سکو دیده می‌شوند.',
    draw: () => (
      <>
        <Sky time="morning" />
        <Cloud x={620} y={60} />
        <Building x={-20} y={240} w={160} h={170} color="#d7c4ae" rows={4} cols={3} />
        <Building x={660} y={240} w={170} h={150} color="#c7cfc6" rows={3} cols={3} />
        <Bus x={640} y={236} color="#5f9a8a" s={.55} />
        <Car x={520} y={238} color="#f2cb4c" s={.5} taxi flip />
        <Rails y={318} />
        <rect x={0} y={236} width={800} height={82} fill="#d8cdb6" />
        <path d="M0 236 H800" {...outline(2)} opacity=".3" />
        <Train x={30} y={318} cars={2} color="#5f7891" trim={CRIMSON} s={.9} />
        <Clip name="cab" path="M38 206 H70 V248 H38Z">
          <Figure build="adult" skin="#e0ae88" hair="#3a2a22" hairStyle="cap" top="#3e4450" bottom="#3e4450" x={56} y={318} arms={['wave', 'down']} expression="smile" s={.62} shadow={false} />
        </Clip>
        <rect y={336} width={800} height={84} fill="#cfc4ae" />
        <rect y={336} width={800} height={10} fill="#f2cb4c" opacity=".85" />
        <Bicycle x={700} y={406} color={CRIMSON} />
        <Cast who={DAD} x={250} y={402} arms={['down', 'hold']} holding={{ item: 'suitcase' }} accent="#8a5a3b" expression="smile" />
        <Cast who={MOM} x={330} y={404} arms={['hold', 'down']} holding={{ item: 'bag', hand: 'left' }} accent="#6f9ab0" expression="smile" />
        <Cast who={MINA} x={420} y={410} arms={['hold', 'wave']} holding={{ item: 'book', hand: 'left' }} expression="happy" hat={CRIMSON} />
        <Cast who={BROTHER} x={510} y={406} arms={['down', 'hold']} holding={{ item: 'bag' }} accent="#e2b440" expression="smile" />
      </>
    ),
  },
  b7c3: {
    alt: 'قطار به سمت شمال: قطار از میان مزرعه‌های سبز می‌گذرد، خورشید در شرق بالا می‌آید و ابرهای خاکستری روی تپه‌های غرب نشسته‌اند؛ گاوها کنار نرده ایستاده‌اند و قطب‌نما جهت شمال را نشان می‌دهد.',
    draw: () => (
      <>
        <Sky time="morning" />
        <Sun x={690} y={96} r={32} />
        <Cloud x={120} y={80} s={1.1} fill="#b8bfc4" />
        <Cloud x={220} y={110} s={.8} fill="#c5cbcf" />
        <Rain width={260} height={200} count={22} color="#9aa6ad" />
        <Hills y={200} color="#a9bca0" seed={13} amplitude={40} far />
        <Hills y={236} color="#9fbf85" seed={17} amplitude={26} />
        <FieldRows y={250} rows={3} color="#7fa36d" soil="#b89a6e" />
        <Ground y={316} fill="#9fbf85" />
        <Tree x={600} y={250} s={.6} />
        <Cow x={200} y={310} s={.6} /><Cow x={280} y={306} s={.5} flip />
        <path d="M120 312 H360 M120 296 H360" stroke="#e9dcc2" strokeWidth="4" />
        {[120, 180, 240, 300, 360].map(px => <path key={px} d={`M${px} 316 V288`} stroke="#e9dcc2" strokeWidth="5" />)}
        <Rails y={376} />
        <Train x={300} y={376} cars={3} color="#5f7891" trim={CRIMSON} s={.72} faces={
          <g>
            <circle cx={80} cy={-96} r="12" fill="#efc6a0" /><path d="M72 -104 q8 -8 16 0" fill="#34221c" />
            <circle cx={128} cy={-96} r="13" fill="#e0ae88" />
          </g>
        } />
        <CompassRose x={80} y={330} r={40} />
        <Flock x={430} y={130} count={3} s={.8} />
      </>
    ),
  },
  b7c4: {
    alt: 'مزرعه: کشاورز کنار انبار قرمز به مینا نشان می‌دهد جوجه‌ها کجا پناه می‌گیرند؛ ردیف‌های سبزِ سبزی پشت خانه است، درخت بلندی پر از پرنده است و گل قرمزی کنار راه روییده. باران ملایمی می‌بارد.',
    draw: () => (
      <>
        <Sky time="rain" />
        <Hills y={220} color="#a3b39a" seed={5} far />
        <Rain count={60} />
        <Ground y={260} fill="#9fbf85" />
        <House x={40} y={276} w={170} h={130} wall="#efe2cc" roof="#6f5a4e" chimney windows={2} lit />
        <Barn x={520} y={290} w={200} h={150} />
        <FieldRows y={296} rows={3} color="#6f9a6b" soil="#9c7a55" />
        <Tree x={300} y={300} s={1.2} leaf="#6f9a6b" dark="#557d56" />
        {[[260, 160], [320, 136], [352, 176], [280, 190]].map(([bx, by], index) => <Bird key={index} x={bx} y={by} s={.5} color={index === 1 ? CRIMSON : '#7d6655'} flip={index % 2 === 0} />)}
        <path d="M0 362 C240 350 520 372 800 356 V420 H0Z" fill="#8a6a4a" />
        <Figure {...FARMER} x={470} y={404} flip arms={['down', 'point']} expression="smile" />
        <Cast who={MINA} x={380} y={408} arms={['down', 'hold']} holding={{ item: 'photo' }} expression="calm" hat={CRIMSON} />
        <Flower x={240} y={396} color={CRIMSON} s={1.3} />
        <Grass x={180} y={404} /><Grass x={620} y={410} />
        <Bush x={740} y={376} />
      </>
    ),
  },
  b7c5: {
    alt: 'کنار اقیانوس در غروب: مینا با عکس نینو کنار ساحل راه می‌رود و موج به کفش‌هایش می‌رسد؛ ماهیگیر در قایقش دست تکان می‌دهد، جزیره‌ای کوچک دور از ساحل است و هتل کوچکِ کنار رودخانه چراغ‌هایش را روشن کرده.',
    draw: () => (
      <>
        <Sky time="dusk" />
        <Stars count={10} seed={31} bottom={90} />
        <Glow x={400} y={216} r={200} />
        <circle cx={400} cy={222} r={40} fill="#f5b86a" />
        <Sea y={220} />
        <path d="M300 226 H500 M330 240 H470 M360 254 H440" stroke="#f7c98a" strokeWidth="4" strokeLinecap="round" opacity=".7" />
        <path d="M560 222 C590 196 640 190 680 222Z" fill="#5d7a6a" {...outline(2)} />
        <Tree x={620} y={214} s={.3} leaf="#4f7458" dark="#3f5d48" />
        <Lighthouse x={720} y={226} s={.5} on />
        <Boat x={210} y={262} s={.8} color={CRIMSON} />
        <Figure {...FISHER} x={234} y={246} arms={['wave', 'down']} expression="smile" s={.42} shadow={false} />
        <Sand y={330} />
        <path d="M0 330 C200 316 520 346 800 324" fill="none" stroke="#f3f7f6" strokeWidth="5" opacity=".8" />
        <Hotel x={40} y={336} w={170} h={130} />
        <Cast who={MINA} x={440} y={404} pose="walk" arms={['down', 'hold']} holding={{ item: 'photo' }} expression="calm" />
        <Cast who={MOM} x={540} y={400} pose="walk" arms={['down', 'hip']} expression="smile" />
        <path d="M400 398 q20 -8 40 0 q20 -8 40 0" fill="none" stroke="#f3f7f6" strokeWidth="3" opacity=".8" />
        <g transform="translate(700 400)"><path d="M-12 0 C-12 -10 12 -10 12 0Z" fill="#e98f84" {...outline(1.4)} /><path d="M-10 -3 l20 0 M-8 -6 l16 0" stroke="#fff" strokeWidth="1.2" /></g>
      </>
    ),
  },
}

