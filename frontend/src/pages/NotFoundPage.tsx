import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/states'

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <EmptyState
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Button asChild>
            <Link to="/">Go to home</Link>
          </Button>
        }
      />
    </div>
  )
}
