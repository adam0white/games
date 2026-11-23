import type { Run } from "@adam0white/human-framework";
import { claimLabNotice, createLab } from "@adam0white/lab-client";

export interface GameLab {
  feedback(onClose: () => void): boolean;
  recording(): boolean;
  setRecording(on: boolean): void;
  event(kind: string, detail: string): void;
  captureSave(value: unknown): void;
  destroy(): void;
}

/** Keep transport, privacy preferences and stored-note receipts in the lab SDK. */
export function initLab(
  getRun: () => Run,
  getExport: () => unknown,
  fileMode = false,
): GameLab {
  if (fileMode)
    return {
      feedback: () => false,
      recording: () => false,
      setRecording: () => {},
      event: () => {},
      captureSave: () => {},
      destroy: () => {},
    };
  // Localhost remains off. Do not enable sendFromLocalhost for agent playtests.
  const lab = createLab({ game: "child" });
  const generations = new WeakMap<Run, number>();
  let nextGeneration = 0;
  const runKey = () => {
    const run = getRun();
    let generation = generations.get(run);
    if (generation === undefined) {
      generation = ++nextGeneration;
      generations.set(run, generation);
    }
    return generation;
  };
  const stopTracking = lab.trackRun(getExport, { runKey });
  let destroyed = false;
  let notice: HTMLElement | null = null;
  let feedbackObserver: MutationObserver | null = null;

  void claimLabNotice()
    .catch(() => false)
    .then((show) => {
      if (!show || destroyed) return;
      notice = document.createElement("aside");
      notice.setAttribute("aria-label", "Play recording");
      Object.assign(notice.style, {
        position: "fixed",
        left: "12px",
        right: "12px",
        bottom: "max(12px, env(safe-area-inset-bottom))",
        zIndex: "1000",
        maxWidth: "36rem",
        margin: "0 auto",
        padding: "16px",
        background: "#fffaf0",
        color: "#303c36",
        border: "1px solid #456c65",
        borderRadius: "12px",
        boxShadow: "0 4px 24px #303c3626",
      });
      const text = document.createElement("p");
      text.textContent =
        "We record and link play across games on this device. You can change Recording in the menu.";
      text.style.margin = "0 0 12px";
      const privacy = document.createElement("a");
      privacy.href = "https://human.adamwhite.work/lab/privacy/";
      privacy.target = "_blank";
      privacy.rel = "noopener";
      privacy.textContent = "Privacy";
      privacy.style.marginRight = "16px";
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "Continue";
      close.style.minHeight = "44px";
      close.onclick = () => notice?.remove();
      notice.append(text, privacy, close);
      document.body.append(notice);
    });

  return {
    feedback(onClose) {
      if (destroyed) return false;
      if (feedbackObserver) return true;
      // SDK 0.5.8 has no close callback. Its private veil is appended to body
      // and removed on dismissal; keep this dependency in the adapter.
      const connectedVeils = () =>
        [...document.querySelectorAll<HTMLElement>(".hflab-veil")].filter(
          (veil) => veil.isConnected,
        );
      if (connectedVeils().length === 0) {
        try {
          lab.openSendDialog({ getRun: getExport, feedbackChoices: true });
        } catch {
          // The SDK may have appended its veil before throwing.
        }
      }
      if (connectedVeils().length === 0) return false;
      feedbackObserver = new MutationObserver(() => {
        if (!feedbackObserver || connectedVeils().length > 0) return;
        feedbackObserver.disconnect();
        feedbackObserver = null;
        if (!destroyed) onClose();
      });
      feedbackObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
      return true;
    },
    recording: () => lab.telemetryOn,
    setRecording(on) {
      if (!destroyed) lab.setTelemetryOff(!on);
    },
    event(kind, detail) {
      if (destroyed) return;
      if (kind === "screen") lab.screen(detail);
      else if (kind === "milestone") lab.milestone(detail);
      else if (kind === "warn" || kind === "error") lab.log(kind, detail);
      else lab.log("game", `${kind}: ${detail}`);
    },
    captureSave(value) {
      if (!destroyed) lab.captureSave(value);
    },
    destroy() {
      destroyed = true;
      feedbackObserver?.disconnect();
      feedbackObserver = null;
      stopTracking();
      lab.dispose();
      notice?.remove();
    },
  };
}
