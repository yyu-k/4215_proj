import { compile_and_run } from "./utils";

describe("literals", () => {
  test("boolean true", () => {
    const program = `
      true
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(true);
  });

  test("boolean false", () => {
    const program = `
      false
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(false);
  });

  test("nil", () => {
    const program = `
      nil
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    // `nil` is represented by `null` in JavaScript
    expect(result[0].final_value).toStrictEqual(null);
  });
});
