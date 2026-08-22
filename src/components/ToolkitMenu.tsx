import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Menu, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTIONS, type SectionId, type Section } from "@/lib/toolkit-sections";

export function SectionIcon({ section, active }: { section: Section; active: boolean }) {
  const index = SECTIONS.indexOf(section);
  return (
    <div className="relative shrink-0">
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center",
        active ? "bg-primary text-primary-foreground" : section.isAI ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
      )}>
        {section.isAI ? <Sparkles className="w-4 h-4" /> : <section.icon className="w-4 h-4" />}
      </div>
      <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-foreground text-background text-[9px] font-bold flex items-center justify-center ring-2 ring-card">
        {index + 1}
      </span>
    </div>
  );
}

// The list of 7 steps, shared by the home page's drawer and the toolkit
// page's own drawer/sidebar — one implementation, not two to keep in sync.
export function ToolkitNavList({ activeId, onSelect }: { activeId?: SectionId; onSelect: (id: SectionId) => void }) {
  return (
    <div>
      <div className="flex items-center gap-3 px-1 mb-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary" /> AI-powered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-border" /> Do it yourself
        </span>
      </div>
      <div className="rounded-2xl bg-background neu-raised overflow-hidden divide-y divide-border">
        {SECTIONS.map((section) => {
          const isActive = section.id === activeId;
          return (
            <button
              key={section.id}
              onClick={() => onSelect(section.id)}
              className={cn(
                "w-full flex items-center gap-3 pl-3 pr-4 py-3.5 text-left transition-colors border-l-4",
                section.isAI ? "border-l-primary" : "border-l-transparent",
                isActive ? "bg-primary/10" : "bg-card hover:bg-secondary/30 active:bg-secondary/30"
              )}
            >
              <SectionIcon section={section} active={isActive} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn("text-sm font-semibold truncate", isActive ? "text-primary" : "text-foreground")}>
                    {section.label}
                  </p>
                  {section.isAI && (
                    <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold tracking-wide uppercase">AI</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{section.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Self-contained hamburger button + slide-in drawer overlay. Drop this
// anywhere (home page header, toolkit page header) — it owns its own
// open/close state and just needs to know what happens when a step is
// picked (navigate there, or update local state, depending on the page).
export function ToolkitMenuButton({ activeId, onSelect, className, label }: { activeId?: SectionId; onSelect: (id: SectionId) => void; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "shrink-0 flex items-center justify-center bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors",
          label
            ? "gap-2 pl-3 pr-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap"
            : "w-11 h-11 rounded-full",
          className
        )}
        aria-label="Open toolkit menu"
      >
        <Menu className="w-5 h-5" />
        {label}
      </button>
      {open && createPortal(
        // Rendered into document.body via portal rather than in place: a
        // `fixed` element inside an ancestor with backdrop-filter/filter/
        // transform is positioned relative to THAT ancestor, not the
        // viewport (a real CSS spec behavior, not a Tailwind quirk) — the
        // sticky mobile header uses backdrop-blur, which broke this drawer's
        // full-screen coverage when it was rendered inline.
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-foreground/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-[340px] bg-background shadow-2xl overflow-y-auto animate-in slide-in-from-left duration-150">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Investigation Toolkit</h2>
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary/50"
                aria-label="Close menu"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="p-3">
              <ToolkitNavList
                activeId={activeId}
                onSelect={(id) => { onSelect(id); setOpen(false); }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Convenience wrapper for the home page: navigates to /toolkit with the
// picked step pre-selected, instead of managing local page state.
export function HomeToolkitMenuButton({ className, label = "Toolkit" }: { className?: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <ToolkitMenuButton
      className={className}
      label={label}
      onSelect={(id) => navigate("/toolkit", { state: { openSection: id } })}
    />
  );
}
