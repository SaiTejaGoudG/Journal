import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert a MongoDB document's _id to a plain `id` string */
export function docToDict(doc: any) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}
