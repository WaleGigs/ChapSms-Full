"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  ArrowRight,
  Megaphone,
  MessageCircleMore,
  X,
} from "lucide-react";

import {
  LOGIN_ANNOUNCEMENT_KEY,
  useAuth,
} from "@/context/AuthContext";

/*
 * Give the dashboard time to paint and become interactive before
 * displaying a non-critical announcement.
 */
const NOTICE_DELAY_MS = 1400;

export default function WelcomeNoticeModal({
  whatsappChannelUrl =
    process.env
      .NEXT_PUBLIC_WHATSAPP_CHANNEL_URL ||
    "",
}) {
  const {
    user,
  } = useAuth();

  const [open, setOpen] =
    useState(false);

  useEffect(() => {
    if (
      !user ||
      user?.role === "admin"
    ) {
      return undefined;
    }

    let shouldShow = false;

    try {
      const pending =
        window.sessionStorage.getItem(
          LOGIN_ANNOUNCEMENT_KEY
        );

      if (pending) {
        shouldShow = true;

        /*
         * Consume once. It will not repeatedly appear if the user
         * changes route while already logged in.
         */
        window.sessionStorage.removeItem(
          LOGIN_ANNOUNCEMENT_KEY
        );
      }
    } catch {
      shouldShow = false;
    }

    if (!shouldShow) {
      return undefined;
    }

    let frameOne = 0;
    let frameTwo = 0;
    let timer = 0;

    /*
     * Two animation frames guarantee that React has committed the
     * authenticated dashboard before we even start the notice delay.
     */
    frameOne =
      window.requestAnimationFrame(
        () => {
          frameTwo =
            window.requestAnimationFrame(
              () => {
                timer =
                  window.setTimeout(
                    () => {
                      setOpen(true);
                    },
                    NOTICE_DELAY_MS
                  );
              }
            );
        }
      );

    return () => {
      if (frameOne) {
        window.cancelAnimationFrame(
          frameOne
        );
      }

      if (frameTwo) {
        window.cancelAnimationFrame(
          frameTwo
        );
      }

      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [user]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(
      event
    ) {
      if (
        event.key === "Escape"
      ) {
        setOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open]);

  function closeNotice() {
    setOpen(false);
  }

  function handleWhatsAppClick(
    event
  ) {
    if (
      !whatsappChannelUrl
    ) {
      event.preventDefault();
      return;
    }

    closeNotice();
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-slate-950/75 px-4 py-6 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          closeNotice();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-announcement-title"
        aria-describedby="login-announcement-description"
        className="relative my-auto w-full max-w-[430px] overflow-hidden rounded-[30px] border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-[0_35px_100px_-25px_rgba(15,23,42,0.75)]"
      >
        <button
          type="button"
          onClick={
            closeNotice
          }
          aria-label="Close announcement"
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X size={20} />
        </button>

        <div className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-blue-600 px-6 pb-9 pt-11 text-center text-white sm:px-8">
          <div className="pointer-events-none absolute -left-14 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-20 -right-10 h-52 w-52 rounded-full bg-indigo-400/30 blur-3xl" />

          <div className="relative">
            <span className="mx-auto flex h-18 w-18 items-center justify-center rounded-full border border-white/30 bg-white/10 p-5 shadow-xl backdrop-blur">
              <Megaphone
                size={32}
              />
            </span>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.26em] text-blue-100">
              ChapsSmS announcement
            </p>

            <h2
              id="login-announcement-title"
              className="mx-auto mt-3 max-w-sm text-3xl font-black tracking-tight"
            >
              Welcome back
            </h2>
          </div>
        </div>

        <div className="px-5 pb-6 pt-7 sm:px-8 sm:pb-8">
          <p
            id="login-announcement-description"
            className="mx-auto max-w-sm text-center text-sm leading-7 text-[var(--muted-foreground)] sm:text-base"
          >
            Join our official WhatsApp channel to receive service updates, maintenance notices, availability information and important ChapsSmS announcements.
          </p>

          <div className="mt-6 space-y-3">
            <a
              href={
                whatsappChannelUrl ||
                undefined
              }
              target="_blank"
              rel="noopener noreferrer"
              onClick={
                handleWhatsAppClick
              }
              aria-disabled={
                !whatsappChannelUrl
              }
              className={`group flex min-h-[72px] items-center gap-4 rounded-2xl px-4 text-white shadow-lg transition sm:px-5 ${
                whatsappChannelUrl
                  ? "bg-gradient-to-r from-emerald-600 to-green-500 hover:-translate-y-0.5 hover:shadow-xl"
                  : "cursor-not-allowed bg-slate-500 opacity-60"
              }`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <MessageCircleMore
                  size={24}
                />
              </span>

              <span className="min-w-0 flex-1 text-left">
                <span className="block font-black">
                  Join WhatsApp Channel
                </span>

                <span className="mt-0.5 block text-xs text-white/80 sm:text-sm">
                  Updates and announcements
                </span>
              </span>

              <ArrowRight
                size={19}
                className="shrink-0 transition group-hover:translate-x-1"
              />
            </a>

            <button
              type="button"
              onClick={
                closeNotice
              }
              className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--muted)] px-5 text-sm font-black text-[var(--foreground)] transition hover:opacity-90"
            >
              Continue to dashboard
            </button>
          </div>

          {!whatsappChannelUrl ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Add{" "}
              NEXT_PUBLIC_WHATSAPP_CHANNEL_URL{" "}
              to your frontend environment variables to activate the WhatsApp button.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
