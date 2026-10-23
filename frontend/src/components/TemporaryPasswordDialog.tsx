import { useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TemporaryPasswordDialogProps {
  credentials: { loginId: string; password: string } | null
  onClose: () => void
}

/**
 * FR-AUTH-04/06: the one-time temporary password, shown to HR once to hand over.
 * It is never stored in the browser and cannot be shown again.
 */
export function TemporaryPasswordDialog({ credentials, onClose }: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!credentials) return
    await navigator.clipboard.writeText(credentials.password)
    setCopied(true)
  }

  return (
    <Dialog
      open={credentials !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false)
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Temporary password</DialogTitle>
          <DialogDescription>
            Hand these credentials to the employee. They must set a new password when they first log in.
            This password will not be shown again.
          </DialogDescription>
        </DialogHeader>
        {credentials && (
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 rounded-lg bg-muted p-4">
            <dt className="text-sm text-muted-foreground">Employee ID</dt>
            <dd className="font-mono font-medium">{credentials.loginId}</dd>
            <dt className="text-sm text-muted-foreground">Password</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono font-medium">{credentials.password}</span>
              <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy password">
                {copied ? <CheckIcon /> : <CopyIcon />}
              </Button>
            </dd>
          </dl>
        )}
        <DialogFooter>
          <Button
            onClick={() => {
              setCopied(false)
              onClose()
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
