import { compile_and_run } from "./utils";
import { parse } from "../index";

describe("program", () => {
  test("should be executable without a block", () => {
    const program = `
      a := 1
      a
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(1);
  });

  test("should be executable without a block with no extraneous whitespace", () => {
    const program = `a:=1;a`;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(1);
  });

  test("should be executable with a block", () => {
    const program = `{
      a := 1
      a
    }`;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(1);
  });
});

describe("statements", () => {
  test("do not require semicolons", () => {
    const program = `
      func add(a, b) {
        result := a + b
        return result
      }
      a := 1
      b := 2
      add(a, b)
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(3);
  });

  test("error when multiple statements are on the same line without semicolons", () => {
    const program = `
      a := 1 b := 2
      a + b
    `;
    expect(() => parse(program)).toThrow();
  });

  test("do not error when multiple statements are on the same line with semicolons", () => {
    const program = `
      a := 1; b := 2
      a + b
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(3);
  });

  test("do not error when empty statements are on the same line", () => {
    const program = `
      a := 1; ; ;;
      a
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(1);
  });
});

describe("variable declarations", () => {
  test("do not need to be coupled with an assignment if the type is declared, regardless of whether the type is checked", () => {
    const program = `
      var x int
      x = 200
      x
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([]);
    expect(result[0].final_value).toStrictEqual(200);
  });
});
