import { ArrowRight, Check } from "lucide-react";

import { Appearance } from "@/components/Common/Appearance";
import { Logo } from "@/components/Common/Logo";
import { Footer } from "./Footer";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="finai-auth min-h-svh p-3 sm:p-5 lg:flex lg:items-center lg:p-6">
      <div className="finai-auth-frame mx-auto grid min-h-[calc(100svh-1.5rem)] w-full max-w-[1580px] overflow-hidden lg:h-[min(880px,calc(100svh-3rem))] lg:min-h-[760px] lg:grid-cols-[minmax(0,1.18fr)_minmax(430px,.82fr)]">
        <aside className="finai-auth-visual relative hidden overflow-hidden lg:flex lg:flex-col">
          <img
            src="/images/finai-data-story.png"
            alt="Minh họa dữ liệu được sắp xếp thành góc nhìn rõ ràng"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="finai-auth-visual-shade absolute inset-0" />
          <div className="relative z-10 flex items-center justify-between p-8 xl:p-10">
            <Logo asLink={false} />
            <span className="rounded-full border border-white/35 bg-white/75 px-4 py-2 text-xs font-semibold text-[#173b46] backdrop-blur-md">
              Không gian dữ liệu của doanh nghiệp
            </span>
          </div>

          <div className="relative z-10 mt-auto max-w-3xl p-8 pt-4 xl:p-10 xl:pt-5">
            <div className="finai-auth-message max-w-xl">
              <p className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-[.16em] text-white/80 uppercase">
                <span className="h-px w-8 bg-[#f3b25c]" /> Từ dữ liệu đến quyết
                định
              </p>
              <h2 className="text-4xl leading-[1.08] font-semibold tracking-[-.045em] text-white xl:text-[3.3rem]">
                Nhìn rõ câu chuyện
                <br />
                đằng sau mỗi con số.
              </h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-white/80">
                Tập trung bảng tính, đặt câu hỏi bằng tiếng Việt và đọc kết quả
                trong một luồng làm việc liền mạch.
              </p>
            </div>

            <div className="finai-auth-journey mt-6 grid grid-cols-3 overflow-hidden rounded-[22px] border border-white/20 bg-[#0d3440]/75 backdrop-blur-xl">
              {[
                {
                  image: "/images/chon_du_lieu.png",
                  alt: "Biểu tượng bảng dữ liệu Excel",
                  kicker: "Nguồn",
                  title: "Chọn dữ liệu",
                },
                {
                  image: "/images/dat_cau_hoi.png",
                  alt: "Minh họa đặt câu hỏi",
                  kicker: "Tương tác",
                  title: "Đặt câu hỏi",
                },
                {
                  image: "/images/doc_goc_nhin.png",
                  alt: "Biểu đồ minh họa kết quả",
                  kicker: "Kết quả",
                  title: "Biểu đồ",
                },
              ].map(({ image, alt, kicker, title }, index) => (
                <div
                  key={title}
                  className="finai-auth-step relative flex min-w-0 items-center gap-4 p-4 text-white"
                >
                  <div className="finai-auth-step-image shrink-0 overflow-hidden rounded-2xl bg-white">
                    <img
                      src={image}
                      alt={alt}
                      className="size-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-[.12em] text-[#f5c579] uppercase">
                      {kicker}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-5">
                      {title}
                    </p>
                  </div>
                  {index < 2 && (
                    <ArrowRight className="absolute top-1/2 -right-2 z-10 size-4 text-[#f5c579]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="finai-auth-side flex min-w-0 flex-col bg-card p-5 sm:p-8 lg:p-10 xl:p-14">
          <div className="flex items-center justify-between gap-4">
            <div className="lg:hidden">
              <Logo asLink={false} />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                <Check className="size-4 text-primary" /> Kết nối bảo mật
              </span>
              <Appearance />
            </div>
          </div>
          <main className="flex flex-1 items-center justify-center py-7 sm:py-9">
            <div className="finai-auth-form w-full max-w-[460px]">
              {children}
            </div>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
