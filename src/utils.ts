import { createHash } from "crypto";

export const md5 = (contents: string) => createHash('md5').update(contents).digest("hex");