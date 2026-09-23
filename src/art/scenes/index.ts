import { BOOK1 } from './book1'
import { BOOK2 } from './book2'
import { BOOK3 } from './book3'
import { BOOK4 } from './book4'
import { BOOK5 } from './book5'
import { BOOK6 } from './book6'
import { BOOK7 } from './book7'
import { BOOK8 } from './book8'
import type { Scene } from './types'

export type { Scene } from './types'

/** One illustration per chapter, drawn from that chapter's own events. */
export const CHAPTER_SCENES: Record<string, Scene> = {
  ...BOOK1,
  ...BOOK2,
  ...BOOK3,
  ...BOOK4,
  ...BOOK5,
  ...BOOK6,
  ...BOOK7,
  ...BOOK8,
}
