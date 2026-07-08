export function StatusDot({ colorClassName }: { colorClassName: string }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${colorClassName}`} />;
}
