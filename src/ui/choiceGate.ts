/** Prevent a repeated click during the brief response reveal. Story changes stay immediate. */
export function createChoiceGate(onReady: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let locked = false;
  return {
    get locked() {
      return locked;
    },
    pause(reducedMotion: boolean) {
      this.cancel();
      if (reducedMotion) return;
      locked = true;
      timer = setTimeout(() => {
        timer = null;
        locked = false;
        onReady();
      }, 420);
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      locked = false;
    },
  };
}
