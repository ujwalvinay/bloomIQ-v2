import { z } from "zod";

export const signupBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email().max(255),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});
