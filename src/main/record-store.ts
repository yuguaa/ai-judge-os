/**
 * 判分记录：持久化到 userData/records.json，主进程为唯一数据源
 * 上限 50 条（缩略图 base64 体积大，收紧防文件膨胀）
 * 写入去抖：评卷循环高频追加时合并落盘，避免每张全量重写
 */
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { JudgeRecord } from '../shared/types'

const MAX_RECORDS = 50
const PERSIST_DEBOUNCE_MS = 800

let records: JudgeRecord[] | null = null
let persistTimer: NodeJS.Timeout | null = null

const filePath = (): string => join(app.getPath('userData'), 'records.json')

function load(): JudgeRecord[] {
  if (records) return records
  try {
    if (!existsSync(filePath())) {
      records = []
      return records
    }
    const parsed = JSON.parse(readFileSync(filePath(), 'utf-8')) as unknown
    records = Array.isArray(parsed) ? (parsed as JudgeRecord[]) : []
  } catch {
    // 文件损坏时从空记录开始
    records = []
  }
  return records
}

function persist(): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    if (!records) return
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(filePath(), JSON.stringify(records, null, 2), 'utf-8')
  }, PERSIST_DEBOUNCE_MS)
}

export function getRecords(): JudgeRecord[] {
  return load()
}

export function addRecord(record: JudgeRecord): void {
  const all = load()
  all.unshift(record)
  if (all.length > MAX_RECORDS) {
    all.length = MAX_RECORDS
  }
  persist()
}
