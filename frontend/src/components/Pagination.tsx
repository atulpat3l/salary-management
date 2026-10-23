import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  noun?: string
}

export function Pagination({ page, totalPages, total, onPageChange, noun = 'results' }: PaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-4 text-sm text-muted-foreground">
      <span>
        {total.toLocaleString()} {noun}
      </span>
      <div className="flex items-center gap-2">
        <span>
          Page {totalPages === 0 ? 0 : page} of {totalPages.toLocaleString()}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}
