import { useEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "lucide-react";

/**
 * §14a — floating "back to top" button pinned to the side edge of long
 * scrollable screens. It watches BOTH the window scroll (mobile layout)
 * and an optional inner scroll container (the desktop center column), shows
 * itself only after scrolling down a bit, and smooth-scrolls back up.
 */
export default function ScrollTopFab({ scrollRef }: { scrollRef?: RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef?.current ?? null;
    const check = () => {
      const winY = window.scrollY;
      const innerY = el?.scrollTop ?? 0;
      setVisible(winY > 300 || innerY > 300);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    el?.addEventListener("scroll", check, { passive: true });
    return () => {
      window.removeEventListener("scroll", check);
      el?.removeEventListener("scroll", check);
    };
  }, [scrollRef]);

  const toTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    scrollRef?.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="scroll-top-fab"
          initial={{ opacity: 0, scale: 0.6, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 10 }}
          onClick={toTop}
          aria-label="Scroll to top"
          className="fixed right-3 bottom-28 lg:bottom-8 z-[45] w-11 h-11 rounded-full bg-black/70 backdrop-blur-md border border-cyan-400/50 text-cyan-200 shadow-[0_0_18px_rgba(6,182,212,0.35)] flex items-center justify-center active:scale-90 transition"
        >
          <ArrowUp size={18} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
