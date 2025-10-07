import { Idl } from '@coral-xyz/anchor'
import fs from 'fs'
import path from 'path'

export function loadIdlFromEnv(): Idl | null {
  const idlPath = process.env.IDL_PATH
  if (!idlPath) return null

  const absolutePath = path.resolve(idlPath)
  if (!fs.existsSync(absolutePath)) return null

  const raw = fs.readFileSync(absolutePath, 'utf-8')
  return JSON.parse(raw) as Idl
}
