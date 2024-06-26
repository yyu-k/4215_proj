import { compile_and_run } from "./utils";

describe("Arity of function call must be identical to Closure arity", () => {
  test("A user defined function call should execute if the number of arguments is equivalent to that in the Closure", () => {
    const program1 = `
      func add(a, b) {
        return a + b
      }
      add(5, 10)
    `;
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(15);
  });

  test("A user defined function call should throw if the number of arguments is more than that in the Closure", () => {
    const program1 = `
      func add(a, b) {
        return a + b
      }
      add(5, 10, 15)
    `;
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("errored");
    expect((result[0].state as any).error.message).toBe(
      "Mismatch in arity between number of called arguments and number of arguments in Closure",
    );
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(null);
  });

  test("A user defined function call should throw if the number of arguments is less than that in the Closure", () => {
    const program1 = `
      func add(a, b) {
        return a + b
      }
      add(5)
    `;
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("errored");
    expect((result[0].state as any).error.message).toBe(
      "Mismatch in arity between number of called arguments and number of arguments in Closure",
    );
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(null);
  });

  test("A builtin function call should execute if the number of arguments is equivalent to that in the Closure", () => {
    const program1 = `
      pa := pair(3, 4)
      head(pa)
    `;
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(3);
  });

  test("A builtin function call should throw if the number of arguments is more than that in the Closure", () => {
    const program1 = `
      pa := pair(3, 4)
      head(pa, 5)
    `;
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("errored");
    expect((result[0].state as any).error.message).toBe(
      "Mismatch in arity between number of called arguments and number of arguments in Closure",
    );
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(null);
  });

  test("A user defined function call should throw if the number of arguments is less than that in the Closure", () => {
    const program1 = `
      pa := pair(3, 4)
      head()
    `;
    const result = compile_and_run(program1);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("errored");
    expect((result[0].state as any).error.message).toBe(
      "Mismatch in arity between number of called arguments and number of arguments in Closure",
    );
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(null);
  });
});
