import { compile_and_run } from "./utils";

describe("functions should be definable", () => {
  test("func add(a, b) {return a + b;} add(10,15) should give 25", () => {
    const result = compile_and_run(`
      func add(a, b) {
        return a + b
      }
      add(10, 15)
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(25);
  });
});

describe("functions can have multiple return values", () => {
  test("func add(a, b) {return a + b;} add(10,15) should give 25", () => {
    const result = compile_and_run(`
      func identity(a, b) {
        return a, b
      }
      a, b := identity(10, 15)
      display(a)
      display(b)
      a + b
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([10, 15]);
    expect(result[0].final_value).toStrictEqual(25);
  });
});

describe("It should be possible to return from a loop", () => {
  test("Function should return the correct value within loop", () => {
    const result = compile_and_run(`
      func add(a) {
        x := 0
        for i := 0; i < a; i = i+1 {
          if (i >= 5) {
            return x
          }
          x = x + 1
        }
        return a
      }
      add(30)
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(5);
  });

  test("Adding the result of a function to other values should work even with a while loop (operand stack not disturbed)", () => {
    const result = compile_and_run(`
      func add(a) {
        x := 0;
        for i := 0; i < a; i = i + 1 {
          if (i >= 5) {
            return x
          }
          x = x + 1
        }
        return a
      }
      30 + add(30) + 70
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(105);
  });
});
