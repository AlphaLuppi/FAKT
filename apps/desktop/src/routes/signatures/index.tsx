import type { ReactElement } from "react";
import { Route, Routes } from "react-router";
import { VerifyRoute } from "./Verify.js";

export function SignaturesRouter(): ReactElement {
  return (
    <Routes>
      <Route path=":eventId/verify" element={<VerifyRoute />} />
    </Routes>
  );
}
