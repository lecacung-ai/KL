import { zodResolver } from "@hookform/resolvers/zod"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { Body_login_login_access_token as AccessToken } from "@/client"
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

const formSchema = z.object({
  username: z.email({ message: "Địa chỉ email không hợp lệ" }),
  password: z
    .string()
    .min(1, { message: "Mật khẩu không được để trống" })
    .min(8, { message: "Mật khẩu tối thiểu 8 ký tự" }),
}) satisfies z.ZodType<AccessToken>

type FormData = z.infer<typeof formSchema>

export const Route = createFileRoute("/login")({
  component: Login,
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
        title: "Đăng nhập - FinAI",
      },
    ],
  }),
})

function Login() {
  const { loginMutation } = useAuth()
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const onSubmit = (data: FormData) => {
    if (loginMutation.isPending) return
    loginMutation.mutate(data)
  }

  return (
    <AuthLayout>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
        >
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Đăng nhập FinAI</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Truy cập không gian làm việc và phân tích dữ liệu tài chính.
            </p>
          </div>

          <div className="grid gap-3.5">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
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
                <FormItem className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs font-medium">Mật khẩu</FormLabel>
                    <RouterLink
                      to="/recover-password"
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Quên mật khẩu?
                    </RouterLink>
                  </div>
                  <FormControl>
                    <PasswordInput
                      data-testid="password-input"
                      placeholder="••••••••"
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
              loading={loginMutation.isPending}
              className="mt-1 h-9 font-medium shadow-2xs"
            >
              Đăng nhập
            </LoadingButton>
          </div>

          <div className="text-center text-xs text-muted-foreground pt-1">
            Chưa có tài khoản?{" "}
            <RouterLink to="/signup" className="font-medium text-foreground hover:underline">
              Đăng ký tài khoản
            </RouterLink>
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
