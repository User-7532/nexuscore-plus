export default function EmptyNote({ title, children, action }) {
  return (
    <div className="rounded-[22px] border border-dashed border-border bg-card/50 px-6 py-10 text-center">
      <p className="text-[14px] text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">{children}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}