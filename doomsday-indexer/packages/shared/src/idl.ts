import { Idl } from '@coral-xyz/anchor'
import doomsdayIdl from './utils/doomsday.idl.json'

export function getDoomsdayIdl(): Idl {
  return doomsdayIdl as unknown as Idl
}
