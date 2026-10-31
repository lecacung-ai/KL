import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

const ErrorComponent = () => {
  return (
    <div
      className="flex min-h-[70svh] items-center justify-center flex-col gap-3 p-6"
      data-testid="error-component"
    >
      <div className="flex items-center z-10">
        <div className="flex flex-col ml-4 items-center justify-center p-4">
          <span className="text-6xl font-semibold leading-none mb-4 text-primary/50">
            Error
          </span>
          <span className="text-2xl font-bold mb-2">Chưa thể hiển thị trang này</span>
        </div>
      </div>

      <p className="text-lg text-muted-foreground mb-4 text-center z-10">
        Đã có sự cố khi tải nội dung. Bạn có thể quay về tổng quan và thử lại.
      </p>
      <Link to="/">
        <Button>Về tổng quan</Button>
      </Link>
    </div>
  )
}

export default ErrorComponent
