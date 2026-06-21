import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as yaml from 'js-yaml'
import { z } from 'zod'

export async function readYaml<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf-8')
  const parsed = yaml.load(raw)
  return schema.parse(parsed)
}

export async function writeYaml<T>(filePath: string, data: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const content = yaml.dump(data, { indent: 2, lineWidth: -1, noRefs: true })
  await fs.writeFile(filePath, content, 'utf-8')
}
