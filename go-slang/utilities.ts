// **********************
// using arrays as stacks
// **********************/

// add values destructively to the end of
// given array; return the array
export function push<T>(array: T[], ...items: T[]) {
  // fixed by Liew Zhao Wei, see Discussion 5
  for (let item of items) {
    array.push(item);
  }
  return array;
}

// return the last element of given array
// without changing the array
export function peek<T>(array: T[], address: number) {
  return array.slice(-1 - address)[0];
}

// for debugging: return a string that shows the bits
// of a given word
export function word_to_string(word: number) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setFloat64(0, word);
  let binStr = "";
  for (let i = 0; i < 8; i++) {
    binStr += ("00000000" + view.getUint8(i).toString(2)).slice(-8) + " ";
  }
  return binStr;
}

export function is_boolean(x: unknown): x is boolean {
  return typeof x === "boolean";
}

export function is_number(x: unknown): x is number {
  return typeof x === "number";
}

export function is_string(x: unknown): x is string {
  return typeof x === "string";
}

export function is_undefined(x: unknown): x is undefined {
  return typeof x === "undefined";
}

export function is_null(x: unknown): x is null {
  return x === null;
}
