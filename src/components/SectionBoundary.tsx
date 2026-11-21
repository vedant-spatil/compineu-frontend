import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; label?: string };
type State = { failed: boolean };

/**
 * Catches a render error in one section so a bad field shows a short message in that section instead of a white
 * screen. The rest of the page keeps working.
 */
export default class SectionBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Kept for the browser console. Nothing is shown to the user beyond the short message.
    console.error("Section failed to render", this.props.label ?? "", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-lg bg-surface p-5 text-sm text-ink-600 shadow-sm ring-1 ring-line">
        Couldn&apos;t display this section.
      </div>
    );
  }
}
