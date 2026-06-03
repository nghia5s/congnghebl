import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders local Dcoin landing page", () => {
  render(<App />);
  expect(screen.getByText(/Dcoin nội bộ/i)).toBeInTheDocument();
});
