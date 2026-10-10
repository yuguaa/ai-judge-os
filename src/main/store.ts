/**
 * 配置持久化：userData/config.json，读写全量替换
 */
import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { AppConfig } from '../shared/types'

/** 默认配置：规则文本预填英语语法填空示例 */
function defaultConfig(): AppConfig {
  return {
    regions: {},
    model: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o-mini'
    },
    rule: {
      ruleText: [
        '题型：英语语法填空，共 10 空，每空 1.5 分，满分 15 分。',
        '判分标准：全对得分；错答、漏答、多词判 0 分；大小写敏感；',
        '涂改以最后书写的词为准；无法辨认判错并标记 lowConfidence。',
        '参考答案：',
        '56 immediately',
        '57 which',
        '58 legendary',
        '59 an',
        '60 has been',
        '61 Built',
        '62 from',
        '63 participating',
        '64 visits',
        '65 who'
      ].join('\n')
    },
    autoCount: 10
  }
}

const filePath = (): string => join(app.getPath('userData'), 'config.json')

let cached: AppConfig | null = null

export function getConfig(): AppConfig {
  if (cached) return cached
  try {
    const raw = readFileSync(filePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    // 与默认值浅合并，保证新增字段有兜底
    const def = defaultConfig()
    cached = {
      regions: { ...def.regions, ...parsed.regions },
      model: { ...def.model, ...parsed.model },
      rule: { ...def.rule, ...parsed.rule },
      autoCount: parsed.autoCount ?? def.autoCount
    }
  } catch {
    cached = defaultConfig()
  }
  return cached
}

export function saveConfig(next: AppConfig): AppConfig {
  cached = next
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(filePath(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}
