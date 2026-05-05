// Focus mode toggle — adds/removes a CSS class on the view root that hides
// left and right panes via styles.css.
//
// Note: in the v1 plugin this used Obsidian's `HTMLElement.addClass`/
// `removeClass` extensions. We use the standard `classList` API here so the
// module stays portable across Tauri/Obsidian/test environments.

export const FOCUS_CLASS = "ams-focus-mode";

export class FocusMode {
  private active = false;
  constructor(private root: HTMLElement) {}

  toggle(): boolean {
    this.active = !this.active;
    if (this.active) this.root.classList.add(FOCUS_CLASS);
    else this.root.classList.remove(FOCUS_CLASS);
    return this.active;
  }

  isActive(): boolean {
    return this.active;
  }

  /** Re-apply (e.g. after a re-render replaces the element). */
  apply(): void {
    if (this.active) this.root.classList.add(FOCUS_CLASS);
    else this.root.classList.remove(FOCUS_CLASS);
  }
}
