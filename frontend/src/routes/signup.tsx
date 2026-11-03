import { zodResolver } from "@hookform/resolvers/zod"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { AuthLayout } from "@/components/Common/AuthLayout"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { PasswordInput } from "@/components/ui/password-input"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"

const formSchema = z
  .object({
    email: z.email({ message: "Địa chỉ email không hợp lệ" }),
    full_name: z.string().min(1, { message: "Họ và tên không được để trống" }),
    password: z
      .string()
      .min(1, { message: "Mật khẩu không được để trống" })
      .min(8, { message: "Mật khẩu tối thiểu 8 ký tự" }),
    confirm_password: z
      .string()
      .min(1, { message: "Vui lòng xác nhận mật khẩu" }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirm_password"],
  })

type FormData = z.infer<typeof formSchema>

export const Route = createFileRoute("/signup")({
  component: SignUp,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: "Đăng ký - FinAI",
      },
    ],
  }),
})

function SignUp() {
  const { signUpMutation } = useAuth()
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      email: "",
      full_name: "",
      password: "",
      confirm_password: "",
    },
  })

  const onSubmit = (data: FormData) => {
    if (signUpMutation.isPending) return
    const { confirm_password: _confirm_password, ...submitData } = data
    signUpMutation.mutate(submitData)
  }

  return (
    <AuthLayout>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
        >
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tạo tài khoản FinAI</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Bắt đầu phân tích dữ liệu và ra quyết định kinh doanh thông minh.
            </p>
          </div>

          <div className="grid gap-3">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs font-medium">Họ và tên</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="full-name-input"
                      placeholder="Nguyễn Văn A"
                      type="text"
                      {...field}
                      className="h-9 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs font-medium">Email</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="email-input"
                      placeholder="ten@doanhnghiep.vn"
                      type="email"
                      {...field}
                      className="h-9 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs font-medium">Mật khẩu</FormLabel>
                  <FormControl>
                    <PasswordInput
                      data-testid="password-input"
                      placeholder="Tối thiểu 8 ký tự"
                      {...field}
                      className="h-9 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirm_password"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs font-medium">Xác nhận mật khẩu</FormLabel>
                  <FormControl>
                    <PasswordInput
                      data-testid="confirm-password-input"
                      placeholder="Nhập lại mật khẩu"
                      {...field}
                      className="h-9 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <LoadingButton
              type="submit"
              className="mt-2 h-9 font-medium shadow-2xs"
              loading={signUpMutation.isPending}
            >
              Đăng ký tài khoản
            </LoadingButton>
          </div>

          <div className="text-center text-xs text-muted-foreground pt-1">
            Đã có tài khoản?{" "}
            <RouterLink to="/login" className="font-medium text-foreground hover:underline">
              Đăng nhập
            </RouterLink>
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
