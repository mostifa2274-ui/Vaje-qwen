export type ChapterMotif =
  | 'cat' | 'bird' | 'search' | 'window' | 'garden' | 'moon' | 'street' | 'people'
  | 'ball' | 'music' | 'city' | 'calendar' | 'count' | 'clock' | 'cake' | 'cats'
  | 'market' | 'bread' | 'cafe' | 'money' | 'speech' | 'note' | 'phone' | 'heart'
  | 'school' | 'plan' | 'office' | 'suitcase' | 'train' | 'compass' | 'farm'
  | 'ocean' | 'mountain' | 'hands' | 'doctor' | 'grandmother' | 'stars' | 'door'

export interface ChapterArtScene {
  sky: string
  ground: string
  accent: string
  secondary: string
  primary: ChapterMotif
  detail: ChapterMotif
  night?: boolean
}

export const CHAPTER_ART: Record<string, ChapterArtScene> = {
  b1c1: { sky:'#efe4cf', ground:'#cfd7c2', accent:'#b82347', secondary:'#d79f47', primary:'cat', detail:'bird' },
  b1c2: { sky:'#e8dfcf', ground:'#d8d6c4', accent:'#8d3f4e', secondary:'#657b68', primary:'search', detail:'people' },
  b1c3: { sky:'#f2e6ce', ground:'#d7d0be', accent:'#c2764a', secondary:'#64745d', primary:'window', detail:'cat' },
  b1c4: { sky:'#e8e1cf', ground:'#cbd8bf', accent:'#71905f', secondary:'#c46b6b', primary:'garden', detail:'cat' },
  b1c5: { sky:'#293246', ground:'#4d5360', accent:'#e4c86a', secondary:'#d6b7a2', primary:'moon', detail:'window', night:true },

  b2c1: { sky:'#dce5e0', ground:'#c7c8bd', accent:'#9a525c', secondary:'#627885', primary:'street', detail:'search' },
  b2c2: { sky:'#e4e6dc', ground:'#d2cdbc', accent:'#786f60', secondary:'#b75b58', primary:'people', detail:'door' },
  b2c3: { sky:'#dce8dc', ground:'#bfcfae', accent:'#d07943', secondary:'#557a62', primary:'ball', detail:'people' },
  b2c4: { sky:'#e9dfd5', ground:'#d0c9b7', accent:'#8a5574', secondary:'#c2764a', primary:'music', detail:'street' },
  b2c5: { sky:'#d8e2e0', ground:'#c5c9c4', accent:'#637982', secondary:'#b85e57', primary:'city', detail:'people' },

  b3c1: { sky:'#eee5d2', ground:'#d3cbbd', accent:'#a85a54', secondary:'#d49d50', primary:'calendar', detail:'clock' },
  b3c2: { sky:'#e8e0cf', ground:'#d6d0c2', accent:'#6e8064', secondary:'#bb6f4f', primary:'count', detail:'cat' },
  b3c3: { sky:'#e9e0cf', ground:'#d0c8b8', accent:'#7d6b61', secondary:'#b95e55', primary:'clock', detail:'calendar' },
  b3c4: { sky:'#f0e2cd', ground:'#d8cfbd', accent:'#bd5d63', secondary:'#d29b4e', primary:'cake', detail:'calendar' },
  b3c5: { sky:'#e5ddd0', ground:'#d1c7b8', accent:'#494845', secondary:'#c78657', primary:'cats', detail:'search' },
  b3c6: { sky:'#eadcc7', ground:'#cfc7b8', accent:'#c17655', secondary:'#756c63', primary:'calendar', detail:'moon' },

  b4c1: { sky:'#eadfd3', ground:'#d6c7b7', accent:'#a85d52', secondary:'#cf9446', primary:'market', detail:'search' },
  b4c2: { sky:'#f0dfc8', ground:'#d8c6af', accent:'#c47d49', secondary:'#8e6657', primary:'bread', detail:'market' },
  b4c3: { sky:'#e7ddd1', ground:'#d4c8b8', accent:'#8e5d58', secondary:'#c18a57', primary:'cafe', detail:'speech' },
  b4c4: { sky:'#ebe0d4', ground:'#d0c6b8', accent:'#b58b46', secondary:'#7a6d62', primary:'money', detail:'market' },
  b4c5: { sky:'#3a3b42', ground:'#55504c', accent:'#d7bb67', secondary:'#aa5a5e', primary:'cat', detail:'street', night:true },

  b5c1: { sky:'#e7dfd2', ground:'#d1c9ba', accent:'#925d65', secondary:'#617887', primary:'speech', detail:'phone' },
  b5c2: { sky:'#efe5d7', ground:'#d7cfbf', accent:'#a85a54', secondary:'#6a7d6a', primary:'note', detail:'search' },
  b5c3: { sky:'#e3e0d7', ground:'#d1c9bc', accent:'#627889', secondary:'#a65b63', primary:'phone', detail:'note' },
  b5c4: { sky:'#eee3d4', ground:'#d4cbbb', accent:'#b85b62', secondary:'#c99653', primary:'heart', detail:'people' },

  b6c1: { sky:'#dce3e1', ground:'#c7cdca', accent:'#657b84', secondary:'#a65f58', primary:'school', detail:'note' },
  b6c2: { sky:'#e0e4df', ground:'#cbd0c8', accent:'#6d7b67', secondary:'#b36559', primary:'plan', detail:'school' },
  b6c3: { sky:'#dce1df', ground:'#c9ccc7', accent:'#687984', secondary:'#b96a52', primary:'office', detail:'note' },
  b6c4: { sky:'#dde2df', ground:'#c8cdc6', accent:'#6d7780', secondary:'#a95a62', primary:'phone', detail:'school' },

  b7c1: { sky:'#dce4df', ground:'#c3cec0', accent:'#7b6858', secondary:'#b96d4f', primary:'suitcase', detail:'train' },
  b7c2: { sky:'#dbe5e2', ground:'#bdc9bd', accent:'#5f7481', secondary:'#b26455', primary:'train', detail:'street' },
  b7c3: { sky:'#d9e3de', ground:'#bfcbb9', accent:'#697c69', secondary:'#c0804d', primary:'compass', detail:'mountain' },
  b7c4: { sky:'#dce6dc', ground:'#b8caa9', accent:'#7d7657', secondary:'#b8664b', primary:'farm', detail:'garden' },
  b7c5: { sky:'#d8e6e7', ground:'#b9d0ca', accent:'#547b8d', secondary:'#c57f4f', primary:'ocean', detail:'suitcase' },

  b8c1: { sky:'#dcdde7', ground:'#c0c3cf', accent:'#6f6c82', secondary:'#9a605c', primary:'mountain', detail:'door' },
  b8c2: { sky:'#e2dfe7', ground:'#cdc8d1', accent:'#8d6a78', secondary:'#b9825e', primary:'hands', detail:'grandmother' },
  b8c3: { sky:'#dde1e7', ground:'#c9cbd0', accent:'#69788d', secondary:'#b55f5e', primary:'doctor', detail:'street' },
  b8c4: { sky:'#e3dfe7', ground:'#cec8d0', accent:'#766a84', secondary:'#b57a5b', primary:'grandmother', detail:'speech' },
  b8c5: { sky:'#293047', ground:'#464b5b', accent:'#e1c66f', secondary:'#9c7792', primary:'stars', detail:'note', night:true },
  b8c6: { sky:'#eee2d4', ground:'#d4c9b9', accent:'#a9545c', secondary:'#d09b53', primary:'door', detail:'cat' },
}
