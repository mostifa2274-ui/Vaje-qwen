import type { ReactNode } from 'react'
import { ArtIds, Bush, Clip, Cloud, Defs, Finish, Flower, Glow, Ground, Hills, Moon, Pine, Sky, Sparkle, Stars, StringLights, Sun, Tree } from './kit'
import { CRIMSON, PAPER, outline } from './tokens'
import { Bird, Cast, Chicken, Figure, Flock, Nino } from './characters'
import { BROTHER, DAD, GRANDMOTHER, MINA, MOM } from './cast'
import { MissingNote } from './interior'
import { Blackboard, BrickWall, Building, Fountain, House, Lighthouse, Mountains, Rails, Sea, Shop, Stall, StoneHouse, StreetLamp, Train } from './outdoor'

const BANNER_WIDTH = 800
const BANNER_HEIGHT = 300

/** A wide, text-free banner that heads each book on the learning map. */
const BOOK_BANNERS: Record<number, () => ReactNode> = {
  1: () => (
    <>
      <Sky time="morning" width={800} height={300} />
      <Sun x={690} y={60} r={28} />
      <Cloud x={200} y={50} s={.8} />
      <Hills y={200} color="#b9cda8" seed={2} far />
      <Ground y={214} fill="#a9c58c" />
      <House x={70} y={250} w={260} h={170} wall="#efd9c0" roof="#b8574a" door="#5f7891" windows={2} />
      <path d="M0 250 H800 V300 H0Z" fill="#9fbf85" />
      <Tree x={520} y={252} s={.9} />
      <Bird x={600} y={90} s={1.1} flying />
      <Flower x={360} y={262} color="#d9546a" /><Flower x={384} y={266} color="#e8a23b" s={.9} />
      <Nino x={470} y={282} s={.72} />
      <Cast who={MINA} x={410} y={292} s={.92} arms={['down', 'hold']} holding={{ item: 'book' }} expression="happy" />
    </>
  ),
  2: () => (
    <>
      <Sky time="day" width={800} height={300} />
      <Cloud x={560} y={46} s={.8} />
      <Building x={-10} y={220} w={140} h={180} color="#d7c4ae" rows={4} cols={3} />
      <Building x={120} y={220} w={120} h={140} color="#c7cfc6" rows={3} cols={3} />
      <Building x={650} y={220} w={160} h={190} color="#c9b7a4" rows={4} cols={3} />
      <Tree x={470} y={230} s={.8} />
      <Ground y={220} fill="#d8cdb6" />
      <Shop x={250} y={236} w={170} h={140} awning={['#6f9a6b', PAPER]} />
      <Fountain x={560} y={262} />
      <StreetLamp x={220} y={272} h={180} />
      <Cast who={MINA} x={440} y={290} s={.9} pose="walk" arms={['down', 'hold']} holding={{ item: 'photo' }} expression="worried" />
      <Flock x={600} y={70} count={4} s={.7} />
    </>
  ),
  3: () => (
    <>
      <Clip name="banner-day" path="M0 0 H430 L370 300 H0Z">
        <Sky time="morning" width={800} height={300} />
        <Sun x={120} y={80} r={28} />
      </Clip>
      <Clip name="banner-night" path="M430 0 H800 V300 H370Z">
        <Sky time="night" width={800} height={300} />
        <Stars count={40} seed={9} bottom={180} />
        <Moon x={690} y={70} r={24} />
      </Clip>
      <Hills y={206} color="#95a98c" seed={7} far />
      <Ground y={220} fill="#8ea27d" />
      <path d="M0 260 C200 250 600 272 800 256 V300 H0Z" fill="#d8cdb6" />
      <g transform="translate(400 120)">
        <circle r="54" fill={PAPER} {...outline(3)} />
        {Array.from({ length: 12 }, (_, index) => {
          const angle = index * Math.PI / 6
          return <circle key={index} cx={(Math.sin(angle) * 42).toFixed(1)} cy={(-Math.cos(angle) * 42).toFixed(1)} r={index % 3 ? 2 : 3.4} fill="#2b2a26" />
        })}
        <path d="M0 0 V-30 M0 0 L22 10" {...outline(4)} />
        <circle r="5" fill={CRIMSON} />
      </g>
      <Cast who={DAD} x={250} y={288} s={.9} pose="walk" arms={['down', 'hold']} holding={{ item: 'photo' }} expression="calm" />
      <Cast who={MINA} x={310} y={292} s={.9} pose="walk" arms={['hold', 'down']} holding={{ item: 'book', hand: 'left' }} expression="calm" />
      <StreetLamp x={620} y={274} h={170} on />
    </>
  ),
  4: () => (
    <>
      <Sky time="morning" width={800} height={300} />
      <Sun x={710} y={60} r={24} />
      <Building x={-20} y={200} w={200} h={150} color="#e0cdb2" rows={3} cols={4} />
      <Building x={600} y={200} w={220} h={170} color="#d7c4ae" rows={3} cols={4} />
      <Ground y={200} fill="#d8cdb6" />
      <Stall x={40} y={250} w={220} awning={[CRIMSON, PAPER]} goods={['apples', 'oranges']} />
      <Stall x={540} y={250} w={220} awning={['#6f9a6b', PAPER]} goods={['bananas', 'greens']} />
      <BrickWall x={280} y={250} w={240} h={70} color="#cf9f7f" />
      {[
        ['#f3c84b', '#dfad32'],
        ['#e6b96a', '#c99a55'],
        ['#f1d88b', '#dfc16b'],
        ['#fff1bb', '#e4c875'],
        ['#d9a45a', '#b7803e'],
      ].map(([feathers, wing], index) => (
        <Chicken key={index} x={306 + index * 48} y={180 + (index % 2) * 2} s={.32} feathers={feathers} wing={wing} flip={index % 2 === 0} />
      ))}
      <path d="M0 262 H800 V300 H0Z" fill="#cdbfa6" />
      <Cast who={MINA} x={400} y={296} s={.8} arms={['down', 'point']} expression="calm" />
    </>
  ),
  5: () => (
    <>
      <Sky time="day" width={800} height={300} />
      <Cloud x={640} y={50} s={.8} />
      <BrickWall x={40} y={250} w={720} h={170} color="#d7a483" />
      <MissingNote x={150} y={150} s={.9} rotate={-5} />
      <MissingNote x={300} y={140} s={.86} rotate={4} />
      <MissingNote x={610} y={150} s={.9} rotate={-3} />
      <Bird x={520} y={62} s={.9} flying />
      <Ground y={250} fill="#cdbfa6" />
      {[70, 220, 540, 700].map((fx, index) => <Flower key={fx} x={fx} y={262} color={index % 2 ? '#e8a23b' : '#d9546a'} s={.8} />)}
      <Cast who={MINA} x={440} y={292} s={.9} arms={['up', 'down']} expression="happy" />
      <MissingNote x={462} y={170} s={.62} rotate={2} />
      <Figure build="elder" skin="#e2b391" hair="#d6d0c7" hairStyle="bald" glasses top="#8b7a5a" bottom="#4b4a44" x={360} y={290} arms={['hip', 'chest']} expression="smile" s={.82} />
    </>
  ),
  6: () => (
    <>
      <Sky time="day" width={800} height={300} />
      <rect x={0} y={0} width={800} height={240} fill="#e3e6d9" />
      <Blackboard x={60} y={40} w={300} h={130}>
        <ellipse cx="170" cy="78" rx="28" ry="21" />
        <circle cx="194" cy="56" r="14" />
        <path d="M207 56 L224 62 L207 67Z M190 42 q6 -12 12 0 q7 -9 10 3" />
        <path d="M30 36 H110 M30 58 H96 M30 80 H104" />
      </Blackboard>
      <g transform="translate(560 40)">
        <rect x="0" y="0" width="160" height="130" rx="4" fill="#efe2cc" {...outline(2.2)} />
        <rect x="10" y="10" width="140" height="110" fill="#bcd6df" />
        <Tree x={50} y={120} s={.5} />
      </g>
      <rect x={0} y={240} width={800} height={60} fill="#c9a57c" />
      <Figure build="adult" skin="#e8b894" hair="#5b3a2a" hairStyle="bob" glasses top="#6f9ab0" bottom="#56617e" outfit="skirt" legs="#e8b894" collar="#fbfaf5" x={440} y={292} s={.9} flip arms={['down', 'point']} expression="smile" />
      <Cast who={MINA} x={520} y={296} s={.9} arms={['hold', 'hold']} holding={{ item: 'book' }} expression="talk" />
      <Cast who={BROTHER} x={620} y={296} s={.8} arms={['down', 'wave']} expression="smile" />
    </>
  ),
  7: () => (
    <>
      <Sky time="dusk" width={800} height={300} />
      <Glow x={560} y={150} r={170} />
      <circle cx={560} cy={156} r={34} fill="#f5b86a" />
      <Sea y={160} height={300} />
      <Lighthouse x={720} y={170} s={.55} on />
      <path d="M0 196 C200 186 520 210 800 196 V300 H0Z" fill="#8fae84" />
      <Rails y={222} />
      <Train x={60} y={222} cars={2} color="#5f7891" trim={CRIMSON} s={.72} windowLit />
      <path d="M0 240 C220 232 520 250 800 238 V300 H0Z" fill="#7da275" />
      <Cast who={MINA} x={560} y={292} s={.86} arms={['down', 'wave']} expression="happy" hat={CRIMSON} />
      <Cast who={MOM} x={630} y={290} s={.82} arms={['hip', 'down']} expression="smile" />
      <Flock x={300} y={60} count={3} s={.7} />
    </>
  ),
  8: () => (
    <>
      <Sky time="night" width={800} height={300} />
      <Stars count={80} seed={17} bottom={220} />
      <Glow x={560} y={70} r={60} kind="moon" />
      <Sparkle x={560} y={70} r={16} />
      <Mountains y={250} colors={['#2f3a57', '#28324c']} snow peaks={[[100, 150], [330, 190], [620, 160], [780, 120]]} />
      <path d="M0 250 C200 236 600 262 800 244 V300 H0Z" fill="#26343a" />
      <StoneHouse x={120} y={262} w={170} h={100} lit smoke={false} />
      <Pine x={60} y={270} s={.7} fill="#2c3f38" />
      <Pine x={330} y={272} s={.6} fill="#2c3f38" />
      <StringLights x1={440} x2={760} y={214} sag={6} />
      <Bush x={720} y={284} fill="#35503f" dark="#26392e" />
      <Figure {...GRANDMOTHER} x={520} y={290} s={.85} flip arms={['down', 'up']} expression="smile" />
      <Cast who={MINA} x={440} y={292} s={.86} arms={['hold', 'down']} holding={{ item: 'book', hand: 'left' }} expression="happy" />
    </>
  ),
}

export function BookBanner({ book }: { book: number }) {
  const draw = BOOK_BANNERS[book]
  if (!draw) return null
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}`} width={BANNER_WIDTH} height={BANNER_HEIGHT} preserveAspectRatio="xMidYMid slice">
      <ArtIds prefix={`book${book}`}>
        <Defs />
        {draw()}
        <Finish width={BANNER_WIDTH} height={BANNER_HEIGHT} />
      </ArtIds>
    </svg>
  )
}
