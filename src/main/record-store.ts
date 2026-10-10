/**
 * 判分记录：内存态留档，主进程为唯一数据源
 */
import type { JudgeRecord } from '../shared/types'

const records: JudgeRecord[] = []

export function getRecords(): JudgeRecord[] {
  return records
}

export function addRecord(record: JudgeRecord): void {
  records.unshift(record)
}
