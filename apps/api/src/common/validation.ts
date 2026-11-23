import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
export function validate<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((issue) => issue.message).join("; "),
    );
  return result.data;
}
