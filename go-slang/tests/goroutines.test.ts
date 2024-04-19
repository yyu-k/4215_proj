import { compile_and_run } from "./utils";

describe("goroutines", () => {
  test("builtin functions called as goroutines should execute immediately", () => {
    const result = compile_and_run(`
      go display(12)
    `);
    expect(result).toHaveLength(2);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(undefined);
    expect(result[1].state.state).toStrictEqual("finished");
    expect(result[1].output).toStrictEqual([12]);
    expect(result[1].final_value).toStrictEqual(12);
  });

  test("builtin functions called as goroutines with the wrong number of arguments should error", () => {
    const result = compile_and_run(`
      go display(12, 13)
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("errored");
    expect((result[0].state as any).error.message).toBe(
      "Mismatch in arity between number of called arguments and number of arguments in Closure",
    );
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(null);
  });

  test("non-functions called as goroutines should error", () => {
    const result = compile_and_run(`
      a := 1
      go a()
    `);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("errored");
    expect((result[0].state as any).error.message).toBe(
      "Attempt to call a non-closure",
    );
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(null);
  });

  // TODO: should we be able to call functions before they are defined?
  test("main machine should end before other machines without synchronization with larger instruction counts", () => {
    const program = `
      func add(a, b) {
        return a + b;
      }
      go add(1, 2)
      add(10, 15)
    `;
    const result = compile_and_run(program, 30);
    expect(result).toHaveLength(2);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(25);
    expect(result[1].state.state).toStrictEqual("default");
    expect(result[1].output).toStrictEqual([]);
    expect(result[1].final_value).toStrictEqual(null);
  });

  test("goroutines can be created with function expressions", () => {
    const program = `
      result := Channel(0)
      go func(result, a, b) {
        result <- a + b
      }(result, 1, 2)
      <-result
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(2);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(3);
    expect(result[1].state.state).toStrictEqual("default");
    expect(result[1].output).toStrictEqual([]);
    expect(result[1].final_value).toStrictEqual(null);
  });
});
