import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "../app/App";

afterEach(cleanup);

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("sign-up page is reachable", () => {
  it("/signup shows the sign-up form, not the sign-in page", () => {
    at("/signup");
    expect(screen.getByRole("heading", { name: /create an account/i })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /^sign in$/i })).toBeNull();
    expect(screen.getByText(/administrator access/i)).toBeTruthy();
  });

  it("sign-up keeps the same page as sign-in: the brand panel stays, only the form changes", () => {
    for (const path of ["/login", "/signup"]) {
      at(path);
      expect(screen.getByText(/know who is reading your policyholder data/i)).toBeTruthy();
      expect(screen.getByText(/humans decide/i)).toBeTruthy();
      cleanup();
    }
  });

  it("the sign-in page links to /signup", () => {
    at("/login");
    const link = screen.getByRole("link", { name: /create an account/i });
    expect(link.getAttribute("href")).toBe("/signup");
  });

  it("the show-password control is the eye icon, not text, on both pages", () => {
    for (const path of ["/login", "/signup"]) {
      at(path);
      const btn = screen.getByRole("button", { name: /show password/i });
      expect(btn.textContent).toBe("");
      expect(btn.querySelector("svg")).not.toBeNull();
      cleanup();
    }
  });

  it("the sign-up eye toggles both password fields", () => {
    const { container } = at("/signup");
    const fields = () => Array.from(container.querySelectorAll("input")).filter((i) => i.autocomplete === "new-password");
    expect(fields().map((i) => i.type)).toEqual(["password", "password"]);
    fireEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(fields().map((i) => i.type)).toEqual(["text", "text"]);
    expect(screen.getByRole("button", { name: /hide password/i }).textContent).toBe("");
  });

  it("the sign-up page links back to /login", () => {
    at("/signup");
    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link.getAttribute("href")).toBe("/login");
  });
});
