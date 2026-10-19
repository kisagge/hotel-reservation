export function AdminPageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-display-m font-bold">{title}</h1>
        {subtitle && <p className="text-body-m text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
