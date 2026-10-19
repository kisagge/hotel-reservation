/** Guest screens are designed at 390px; keep them in a phone-width column on larger screens. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-canvas">{children}</div>;
}
