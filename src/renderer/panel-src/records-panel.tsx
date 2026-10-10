/**
 * 判分记录面板：主进程留档（拉取 + judged 广播同步），点击行展开原图与逐条明细
 */
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { ipc } from '@/lib/ipc'
import type { JudgeRecord } from '@shared/types'

export function RecordsPanel(): JSX.Element {
  const [records, setRecords] = useState<JudgeRecord[]>([])
  const [detail, setDetail] = useState<JudgeRecord | null>(null)

  useEffect(() => {
    void ipc.getRecords().then(setRecords)
    return ipc.onEngineEvent((ev) => {
      if (ev.type === 'judged') {
        setRecords((r) => [ev.record, ...r])
      }
    })
  }, [])

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      {records.length === 0 ? (
        <p className="py-12 text-center text-xs text-muted-foreground">暂无记录</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead className="text-right">得分</TableHead>
              <TableHead className="text-right">置信度</TableHead>
              <TableHead className="text-right">状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow
                key={r.id}
                className={detail?.id === r.id ? 'bg-muted/50' : ''}
                onClick={() => setDetail(detail?.id === r.id ? null : r)}
              >
                <TableCell>{r.time}</TableCell>
                <TableCell className="text-right font-medium">{r.score}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {(r.confidence * 100).toFixed(0)}%
                </TableCell>
                <TableCell className="text-right">
                  {r.lowConfidence ? (
                    <Badge variant="destructive">低置信</Badge>
                  ) : (
                    <Badge variant="secondary">正常</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      setDetail(detail?.id === r.id ? null : r)
                    }}
                  >
                    {detail?.id === r.id ? '收起' : '明细'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {detail && (
        <div className="flex flex-col gap-2.5 border-t pt-3">
          <img
            src={detail.thumbnail}
            alt="答题区截图"
            className="max-h-52 w-full rounded border object-contain"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>条目</TableHead>
                <TableHead>作答</TableHead>
                <TableHead className="text-right">判定</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.items.map((it, i) => (
                <TableRow key={i}>
                  <TableCell className="w-16">{it.label}</TableCell>
                  <TableCell className="font-mono text-xs">{it.response || '（未识别）'}</TableCell>
                  <TableCell className="text-right">
                    {it.correct ? (
                      <Badge variant="secondary">对</Badge>
                    ) : (
                      <Badge variant="destructive">错</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
