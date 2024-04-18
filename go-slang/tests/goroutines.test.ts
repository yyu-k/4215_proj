import { compile_and_run } from "./utils";

describe("goroutines", () => {
  test("builtin functions called as goroutines should execute immediately", () => {
    const result = compile_and_run(`
      go display(12)
    `);
    expect(result).toHaveLength(2);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    // TODO: is `false` wrong here?
    expect(result[0].final_value).toStrictEqual(false);
    // TODO: should this be `finished`?
    expect(result[1].state.state).toStrictEqual("default");
    expect(result[1].output).toStrictEqual([12]);
    expect(result[1].final_value).toStrictEqual(null);
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
});
