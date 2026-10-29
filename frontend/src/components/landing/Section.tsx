import type { ReactNode } from "react";

export function Section({ id, eyebrow, title, sub, children, className = "" }: { id?: string; eyebrow?: string; title?: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-20 px-4 py-20 sm:px-6 md:py-28 ${className}`}>
      <div className="mx-auto max-w-6xl">
        {(eyebrow || title) && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            {eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>}
            {title && <h2 className="text-3xl font-semibold sm:text-4xl md:text-5xl">{title}</h2>}
            {sub && <p className="mt-4 text-lg text-muted-foreground">{sub}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
