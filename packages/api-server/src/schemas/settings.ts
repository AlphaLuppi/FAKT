import { z } from "zod";

export const settingKeySchema = z
  .string()
  .min(1, "key requise")
  .max(200)
  .regex(/^[a-zA-Z0-9._-]+$/, "key doit être alphanum . _ -");

export const setSettingSchema = z.object({
  value: z.string().max(10_000),
});

export type SetSettingBody = z.infer<typeof setSettingSchema>;
