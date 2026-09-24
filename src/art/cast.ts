import type { FigureProps } from './characters'

// The recurring cast. Presets keep each person's look identical in every scene.

export type Person = Omit<FigureProps, 'x' | 'y'>

export const MINA: Person = {
  build: 'child', skin: '#efc6a0', hair: '#34221c', hairStyle: 'ponytail',
  top: '#4f8a7b', bottom: '#4f8a7b', outfit: 'dress', collar: '#f6ecd8', legs: '#3c3b48', shoes: '#8a3b2e',
}
export const MOM: Person = {
  build: 'adult', skin: '#e8b894', hair: '#4a2f25', hairStyle: 'bun',
  top: '#c9766f', bottom: '#56617e', outfit: 'skirt', legs: '#e8b894', shoes: '#5a3a2c',
}
export const DAD: Person = {
  build: 'adult', skin: '#e0ae88', hair: '#2f2622', hairStyle: 'short', beard: true,
  top: '#5f7891', bottom: '#3e4450', outfit: 'pants', shoes: '#4a3328',
}
export const BROTHER: Person = {
  build: 'teen', skin: '#e9bb95', hair: '#2e211b', hairStyle: 'short',
  top: '#d0703f', bottom: '#3d4a5c', outfit: 'pants', shoes: '#f1ece2',
}
export const GRANDMOTHER: Person = {
  build: 'elder', skin: '#eac2a0', hair: '#cfc8bf', hairStyle: 'bun', glasses: true,
  top: '#8d5a7a', bottom: '#6b4a5f', outfit: 'dress', collar: '#efe3cf', legs: '#eac2a0', shoes: '#4a3328',
}
export const GRANDFATHER: Person = {
  build: 'elder', skin: '#e2b391', hair: '#d6d0c7', hairStyle: 'bald', beard: true,
  top: '#7c7a57', bottom: '#4b4a44', outfit: 'pants', shoes: '#4a3328',
}
