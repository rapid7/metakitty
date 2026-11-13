export function StatsPageHeader({ title, description, generatedAt }: { title: string; description?: string; generatedAt?: string }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {generatedAt && (
          <p className="text-xs text-muted-foreground">
            Generated <time dateTime={generatedAt}>{new Date(generatedAt).toUTCString()}</time>
          </p>
        )}
      </div>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
