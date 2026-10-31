import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

const NotFound = () => {
  return (
    <div
      className="flex min-h-[70svh] items-center justify-center flex-col gap-3 p-6"
      data-testid="not-found"
    >
      <div className="flex items-center z-10">
        <div className="flex flex-col ml-4 items-center justify-center p-4">
          <span className="text-6xl font-semibold leading-none mb-4 text-primary/50">
            404
          </span>
          <span className="text-2xl font-bold mb-2">Không tìm thấy trang</span>
        </div>
      </div>

      <p className="text-lg text-muted-foreground mb-4 text-center z-10">
        Trang này có thể đã đổi địa chỉ. Hãy quay về không gian làm việc của bạn.
      </p>
      <div className="z-10">
        <Link to="/">
          <Button className="mt-4">Về tổng quan</Button>
        </Link>
      </div>
    </div>
  )
}

export default NotFound
