import { Heap } from "go-slang";

export function getErrorDescription(err: unknown) {
  if (err instanceof Error) {
    return err.message;
  }

  return String(err);
}

export function getHeapJSValueString(heap: Heap, address: number) {
  const value = heap.address_to_JS_value(address);
  const valueStr =
    value === null
      ? "nil"
      : value === undefined
        ? "undefined"
        : typeof value === "string" &&
            value.startsWith("<") &&
            value.endsWith(">")
          ? value
          : JSON.stringify(value);
  return valueStr;
}
