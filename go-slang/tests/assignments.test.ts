import { parser } from "../parser/parser";
import { compile_program } from "../compiler";
import { run } from "../scheduler";

const heap_size = 50000;
const compile_and_run = (program_str: string) => {
  const ast = parser.parse(program_str);
  const instructions = compile_program(ast);
  return run(instructions, heap_size);
};

describe("short assignments", () => {
  test("single variables", () => {
    const program = `
      a := 1
      b := 2
      display(a)
      display(b)
      a + b
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([1, 2]);
    expect(result[0].final_value).toStrictEqual(3);
  });

  test("multiple variables", () => {
    const program = `
      a, b := 1, 2
      display(a)
      display(b)
      a + b
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([1, 2]);
    expect(result[0].final_value).toStrictEqual(3);
  });
});

describe("assignment expressions", () => {
  test("single variables", () => {
    const program = `
      var a int
      var b int
      a = 1
      b = 2
      display(a)
      display(b)
      a + b
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([1, 2]);
    expect(result[0].final_value).toStrictEqual(3);
  });

  test("multiple variables", () => {
    const program = `
      a, b := 2, 1
      a, b = b, a
      display(a)
      display(b)
      a + b
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].output).toStrictEqual([1, 2]);
    expect(result[0].final_value).toStrictEqual(3);
  });
});

describe("multiple array assignments", () => {
  test("multiple array assignments", () => {
    const program = `
      x := [10]{}
      x[0], x[1], x[2] = 9, 12, 15
      x[1] + x[2] - x[0]
    `;
    const result = compile_and_run(program);
    expect(result).toHaveLength(1);
    expect(result[0].state.state).toStrictEqual("finished");
    expect(result[0].final_value).toStrictEqual(18);
  });
});