/**
 * 判分记录面板：主进程留档（拉取 + judged 广播同步），点击行展开原图与逐条明细
 */
import { useEffect, useState } from 'react'
import { ClipboardListIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5">
      {records.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
            <ClipboardListIcon className="size-6 text-white/30" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-white/70">暂无判分记录</p>
            <p className="text-xs text-muted-foreground">开始评卷后，每张卷的得分与判定会留档在这里</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.02]">
                <TableHead className="pl-4">时间</TableHead>
                <TableHead className="text-right">得分</TableHead>
                <TableHead className="text-right">置信度</TableHead>
                <TableHead className="text-right">状态</TableHead>
                <TableHead className="w-20 pr-4 text-right">明细</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow
                  key={r.id}
                  className={
                    detail?.id === r.id
                      ? 'cursor-pointer border-white/[0.06] bg-emerald-400/[0.06] hover:bg-emerald-400/[0.08]'
                      : 'cursor-pointer border-white/[0.05]'
                  }
                  onClick={() => setDetail(detail?.id === r.id ? null : r)}
                >
                  <TableCell className="pl-4 text-muted-foreground">{r.time}</TableCell>
                  <TableCell className="tnum text-right text-[15px] font-semibold text-white/90">
                    {r.score}
                  </TableCell>
                  <TableCell className="tnum text-right text-muted-foreground">
                    {(r.confidence * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {r.lowConfidence ? (
                      <Badge variant="destructive">低置信</Badge>
                    ) : (
                      <Badge variant="secondary">正常</Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {detail?.id === r.id ? (
                      <ChevronUpIcon className="ml-auto size-3.5 text-emerald-300" />
                    ) : (
                      <ChevronDownIcon className="ml-auto size-3.5 text-white/30" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {detail && (
        <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/60">{detail.time}</span>
            <span className="tnum text-xs text-muted-foreground">
              得分 <span className="font-semibold text-emerald-300">{detail.score}</span>
            </span>
            <span className="tnum text-xs text-muted-foreground">
              置信 {(detail.confidence * 100).toFixed(0)}%
            </span>
            <button
              className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/80"
              onClick={() => setDetail(null)}
            >
              <ChevronUpIcon className="size-3.5" />
              收起
            </button>
          </div>
          <img
            src={detail.thumbnail}
            alt="答题区截图"
            className="max-h-52 w-full rounded-lg border border-white/[0.06] object-contain"
          />
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06]">
                <TableHead className="w-20 pl-2">条目</TableHead>
                <TableHead>作答</TableHead>
                <TableHead className="pr-2 text-right">判定</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.items.map((it, i) => (
                <TableRow key={i} className="border-white/[0.05]">
                  <TableCell className="pl-2 text-muted-foreground">{it.label}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {it.response || '（未识别）'}
                  </TableCell>
                  <TableCell className="pr-2 text-right">
                    {it.correct ? (
                      <Badge variant="default">对</Badge>
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
