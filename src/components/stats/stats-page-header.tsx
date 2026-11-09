export function StatsPageHeader({ title, generatedAt }: { title: string; generatedAt: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-xs text-muted-foreground">
        Generated <time dateTime={generatedAt}>{new Date(generatedAt).toUTCString()}</time>
      </p>
    </div>
  );
}
